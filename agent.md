# request2code

Firefox DevTools extension that captures network requests and converts them to executable code snippets. Supports Python, JavaScript (fetch), cURL, PHP, and Go.

Published at: https://addons.mozilla.org/pt-BR/firefox/addon/request2code/

## What it does

1. Hooks into `browser.devtools.network.onRequestFinished` to intercept all HTTP traffic while DevTools is open.
2. Parses each HAR entry and converts it to code (headers, cookies, body, method) for the selected language.
3. Displays the generated code with syntax highlighting in a split-panel DevTools tab.
4. Shows the response body in three modes: formatted JSON, interactive tree, and raw text.
5. Provides one-click copy for both the generated code and the response body.

## File structure

```
request2code/
├── manifest.json        # WebExtension manifest (MV2, gecko-only)
├── devtools.html        # Entry point required by manifest's devtools_page key
├── devtools.js          # Registers the DevTools panel via browser.devtools.panels.create
├── panel.html           # Full UI — layout, CSS variables, tab structure (~490 lines)
├── panel.js             # UI logic — JSON tree, tabs, resize, event wiring (~405 lines)
├── lib/
│   └── converters.js    # Pure functions: i18n, all HAR converters, syntax highlighters,
│                        # getResourceType, converters registry (~495 lines)
├── test/
│   ├── converters.test.js
│   ├── highlight.test.js
│   └── i18n.test.js
└── docs/
    ├── architecture.md
    └── adding-converters.md
```

No build step, no runtime dependencies, no bundler. The extension loads directly in Firefox.

## Architecture

### Entry flow

```
manifest.json
  └── devtools_page: devtools.html
        └── devtools.js
              └── browser.devtools.panels.create("request2code", ..., "panel.html")
                    └── panel.html
                          ├── <script src="lib/converters.js">   ← pure functions
                          └── <script src="panel.js">            ← UI wiring
```

### lib/converters.js sections

| Lines | Responsibility |
|-------|---------------|
| 1–73  | i18n strings for pt_br, en, es |
| 75–184 | Python converter: `pyStr`, `pyDict`, `jsonToPy`, `harToPython` |
| 186–243 | JS (fetch) converter: `jsStr`, `jsObj`, `harToFetch` |
| 245–272 | cURL converter: `shStr`, `harToCurl` |
| 274–319 | PHP converter: `phpStr`, `harToPhp` |
| 321–371 | Go converter: `goStr`, `harToGo` |
| 373–446 | Syntax highlighters via `makeHighlighter` factory |
| 448–456 | `converters` registry (maps selector value → `{ label, convert, highlight }`) |
| 458–494 | `getResourceType` and CommonJS export |

### panel.js sections

| Lines | Responsibility |
|-------|---------------|
| 1–23  | State vars, i18n helpers (`t`, `applyTranslations`) |
| 25–39 | DOM element references |
| 42–126 | JSON tree builder (`valueEl`, `keyPrefixNodes`, `buildNode`, `buildJsonTree`) |
| 128–178 | Tab and response view mode logic |
| 180–233 | Request list rendering (`renderList`) and filter logic |
| 235–307 | Response panel (`renderResponseBody`, `selectRequest`) |
| 309–404 | Event wiring: clear, copy, filter, type buttons, resize, network listener, i18n selector |

### Key functions

**`harToPython(entry, lang)`** — core Python converter. Body dispatch order:
1. `application/json` → `json=` kwarg
2. `application/x-www-form-urlencoded` → `data=` dict
3. `multipart/form-data` → `files=` dict
4. Everything else → `data=` raw string

**`makeHighlighter(commentPrefix, strQuote, rules)`** — factory used by all language highlighters. Strings are extracted to placeholders before code rules run, preventing rules from matching quote characters inside span class attributes. HTML-encodes content before injecting span tags (XSS-safe).

**`converters`** — registry object keyed by `<select id="lang-select">` option values:
```js
{ python, js_fetch, curl, php, go }
// each: { label, convert, highlight }
```

**`buildNode(value, key)`** — recursive DOM builder for the JSON tree viewer. Uses only DOM APIs (`textContent`, `append`) — no innerHTML.

**`selectRequest(i)`** — calls `converters[selectedLang].convert(entry, currentLang)` then `highlight(code)`, renders via `DOMParser` into `codeEl`.

## Security notes

All dynamic content uses DOM APIs (`textContent`, `append`, `replaceChildren`). The only `innerHTML`-equivalent path is `codeEl` via `DOMParser.parseFromString(highlight(code), 'text/html')`, which is safe because `makeHighlighter` HTML-encodes the source string before inserting span tags.

Network data (`statusText`, MIME type, response body) is never interpolated into HTML strings.

## i18n

Three locales: `pt_br`, `en`, `es`. Detected from `navigator.language` at startup, overridable via the UI selector. The `t(key)` helper reads from `i18n[currentLang]`. Elements with `data-i18n` / `data-i18n-ph` attributes are translated by `applyTranslations()`.

## Adding a new target language

See [docs/adding-converters.md](docs/adding-converters.md).

## Manifest notes

- Uses **Manifest V2** (MV3 DevTools panels are not yet fully supported in Firefox).
- `browser_specific_settings.gecko.data_collection_permissions` is set to empty `required`/`optional` arrays.
- Minimum Firefox version: **142.0**.

## Development workflow

Load as a temporary extension:

```
about:debugging → This Firefox → Load Temporary Add-on → select manifest.json
```

Changes to `panel.js` or `panel.html` take effect after closing and reopening the DevTools panel. Changes to `manifest.json` or `devtools.js` require reloading the extension from `about:debugging`.

Run tests:

```bash
npm test
```

Lint before submitting to AMO:

```bash
npx web-ext lint
```
