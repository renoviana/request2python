# Architecture

## Overview

request2code is a zero-dependency Firefox DevTools extension. There is no build step — files load directly in the browser. The extension is split into two layers:

- **`lib/converters.js`** — pure functions only. No DOM, no browser APIs. Dual-loadable: `<script>` in the browser and `require()` in Node.js (Jest tests).
- **`panel.js`** — UI wiring. Uses DOM and `browser.devtools.*` APIs. Not testable in Node.js.

## Entry flow

```
manifest.json
  └── devtools_page: devtools.html
        └── devtools.js
              └── browser.devtools.panels.create("request2code", ..., "panel.html")
                    └── panel.html
                          ├── <script src="lib/converters.js">
                          └── <script src="panel.js">
```

`panel.html` loads `converters.js` first so that `i18n`, `converters`, and `getResourceType` are available as globals when `panel.js` runs.

## Data flow

```
browser.devtools.network.onRequestFinished
  └── allRequests.push(entry)         ← HAR entry stored as-is
        └── renderList()              ← rebuilds request list DOM

user clicks a request item
  └── selectRequest(i)
        ├── converters[selectedLang].convert(entry, currentLang)  ← produces source string
        ├── converters[selectedLang].highlight(code)              ← produces HTML string
        ├── DOMParser.parseFromString(html, 'text/html')          ← safe parse
        ├── codeEl.replaceChildren(...)                           ← render code tab
        └── renderResponseBody(entry)
              └── entry.getContent((body, encoding) => ...)       ← async, Firefox API
```

## HAR entry shape

```js
entry = {
  request: {
    method: string,
    url: string,
    headers: [{ name, value }],
    postData: { text, params } | null,
  },
  response: {
    status: number,
    statusText: string,
    content: { mimeType: string },
  },
  _resourceType: string,        // Firefox-specific, may be undefined
  getContent: (callback) => {}  // async, Firefox DevTools API
}
```

## Converter registry

`converters.js` exports a `converters` object keyed by the `<select id="lang-select">` option values:

```js
converters = {
  python:   { label: 'Python',     convert: harToPython, highlight: highlightPython },
  js_fetch: { label: 'JS (fetch)', convert: harToFetch,  highlight: highlightJS     },
  curl:     { label: 'cURL',       convert: harToCurl,   highlight: highlightCurl   },
  php:      { label: 'PHP',        convert: harToPhp,    highlight: highlightPhp    },
  go:       { label: 'Go',         convert: harToGo,     highlight: highlightGo     },
}
```

`selectRequest` uses `converters[selectedLang]` — adding a new language is entirely additive.

## Syntax highlighting

All highlighters are built by `makeHighlighter(commentPrefix, strQuote, rules)`:

1. Split code into lines.
2. For each line: detect and split off any trailing comment.
3. Extract string literals into numbered placeholders (`\x00S0S\x00`).
4. HTML-encode the remaining code.
5. Apply keyword/function/number/variable regex rules (these operate on already-encoded text, so no XSS surface).
6. Restore string placeholders as `<span class="str">...</span>` (strings were encoded in step 3).
7. Append comment span if present.

This order ensures that:
- String contents cannot interfere with regex rules.
- All user-controlled content is entity-encoded before any span tags are inserted.

## State

`panel.js` holds five mutable top-level variables:

| Variable | Purpose |
|---|---|
| `allRequests` | Full array of HAR entries received |
| `selectedIndex` | Index of the currently selected entry, -1 if none |
| `selectedLang` | Current output language key (`'python'`, etc.) |
| `typeFilter` | Active resource type filter (`'all'`, `'xhr'`, …) |
| `currentLang` | UI language (`'pt_br'`, `'en'`, `'es'`) |

Response view state (`responseViewMode`, `responseRawText`, `responseParsed`) is also top-level, updated by `renderResponseBody` and `applyResponseMode`.
