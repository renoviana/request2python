# Architecture

## Overview

request2code is a zero-dependency browser DevTools extension available for Firefox and Chrome. There is no build step — files load directly in the browser.

The codebase is split into two self-contained folders:

| Folder | Browser | Manifest | API namespace |
|---|---|---|---|
| `firefox/` | Firefox 142+ | MV2 | `browser.*` |
| `chrome/` | Chrome (modern) | MV3 | `chrome.*` |

Each folder can be zipped independently for store submission.

## Code split between versions

Three files differ between Firefox and Chrome:

| File | Firefox | Chrome |
|---|---|---|
| `manifest.json` | MV2, `browser_specific_settings.gecko`, `__MSG__` name | MV3, no gecko block, hardcoded name |
| `devtools.js` | `browser.devtools.panels.create` | `chrome.devtools.panels.create` |
| `panel.js` | `browser.devtools.network.*` | `chrome.devtools.network.*` |

Everything else is identical: `panel.html`, `devtools.html`, and `lib/converters.js`. When editing shared logic, update both `firefox/lib/converters.js` and `chrome/lib/converters.js`.

## Internal layers

- **`lib/converters.js`** — pure functions only. No DOM, no browser APIs. Dual-loadable: `<script>` in the browser and `require()` in Node.js (Jest tests).
- **`panel.js`** — UI wiring. Uses DOM and `[browser|chrome].devtools.*` APIs. Not testable in Node.js.

## Entry flow (both browsers)

```
manifest.json
  └── devtools_page: devtools.html
        └── devtools.js
              └── [browser|chrome].devtools.panels.create("request2code", ..., "panel.html")
                    └── panel.html
                          ├── <script src="lib/converters.js">
                          └── <script src="panel.js">
```

`panel.html` loads `converters.js` first so that `i18n`, `converters`, and `getResourceType` are available as globals when `panel.js` runs.

## Data flow

```
[browser|chrome].devtools.network.onRequestFinished
  └── allRequests.push(entry)         ← HAR entry stored as-is
        └── renderList()              ← rebuilds request list DOM

user clicks a request item
  └── selectRequest(i)
        ├── converters[selectedLang].convert(entry, currentLang)  ← produces source string
        ├── converters[selectedLang].highlight(code)              ← produces HTML string
        ├── DOMParser.parseFromString(html, 'text/html')          ← safe parse
        ├── codeEl.replaceChildren(...)                           ← render code tab
        └── renderResponseBody(entry)
              └── entry.getContent((body, encoding) => ...)       ← async, DevTools API
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
  _resourceType: string,        // may be undefined in some browsers
  getContent: (callback) => {}  // async, DevTools API (same shape in both browsers)
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
5. Apply keyword/function/number/variable regex rules (operating on already-encoded text — no XSS surface).
6. Restore string placeholders as `<span class="str">...</span>` (strings were encoded in step 3).
7. Append comment span if present.

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
