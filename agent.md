# request2code

Browser DevTools extension that captures network requests and converts them to executable code snippets. Supports Python, JavaScript (fetch), cURL, PHP, and Go. Available for Firefox and Chrome.

Firefox (published): https://addons.mozilla.org/pt-BR/firefox/addon/request2code/

## What it does

1. Hooks into the browser's DevTools network API to intercept all HTTP traffic while DevTools is open.
2. Parses each HAR entry and converts it to code (headers, cookies, body, method) for the selected language.
3. Displays the generated code with syntax highlighting in a split-panel DevTools tab.
4. Shows the response body in three modes: formatted JSON, interactive tree, and raw text.
5. Provides one-click copy for both the generated code and the response body.

## Repository structure

```
request2code/
├── firefox/               # Firefox extension (MV2, browser.* API)
│   ├── manifest.json      # gecko-only settings, default_locale, strict_min_version
│   ├── devtools.html      # Entry point required by manifest's devtools_page key
│   ├── devtools.js        # browser.devtools.panels.create(...)
│   ├── panel.html         # Full UI — layout, CSS variables, tab structure
│   ├── panel.js           # UI logic — uses browser.devtools.network.*
│   ├── lib/
│   │   └── converters.js  # Pure functions: i18n, converters, highlighters
│   ├── _locales/          # __MSG_extName__ / __MSG_extDescription__ strings
│   │   ├── en/
│   │   ├── es/
│   │   ├── pt/
│   │   └── pt_BR/
│   └── test/
│       ├── converters.test.js
│       ├── highlight.test.js
│       └── i18n.test.js
├── chrome/                # Chrome extension (MV3, chrome.* API)
│   ├── manifest.json      # manifest_version: 3, no browser_specific_settings
│   ├── devtools.html      # identical to firefox/devtools.html
│   ├── devtools.js        # chrome.devtools.panels.create(...)
│   ├── panel.html         # identical to firefox/panel.html
│   ├── panel.js           # same as firefox/panel.js — uses chrome.devtools.network.*
│   └── lib/
│       └── converters.js  # identical copy of firefox/lib/converters.js
└── docs/
    ├── architecture.md
    └── adding-converters.md
```

Each folder is self-contained and can be zipped independently for store submission.

No build step, no runtime dependencies, no bundler.

## Differences between Firefox and Chrome versions

| | Firefox | Chrome |
|---|---|---|
| Manifest version | 2 | 3 |
| API namespace | `browser.*` | `chrome.*` |
| Browser settings | `browser_specific_settings.gecko` | none |
| Extension name/desc | `__MSG_*__` via `_locales/` | hardcoded in manifest |
| Min version | Firefox 142.0 | any modern Chrome |

Only three files differ between the two versions:
- `manifest.json`
- `devtools.js` — `browser.*` vs `chrome.*`
- `panel.js` — `browser.devtools.network.*` vs `chrome.devtools.network.*`

`lib/converters.js`, `panel.html`, and `devtools.html` are identical. When changing shared logic, update both copies.

## Architecture

### Entry flow (both browsers)

```
manifest.json
  └── devtools_page: devtools.html
        └── devtools.js
              └── [browser|chrome].devtools.panels.create("request2code", ..., "panel.html")
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

**`makeHighlighter(commentPrefix, strQuote, rules)`** — factory used by all language highlighters. Strings are extracted to placeholders before code rules run. HTML-encodes content before injecting span tags (XSS-safe).

**`converters`** — registry object keyed by `<select id="lang-select">` option values:
```js
{ python, js_fetch, curl, php, go }
// each: { label, convert, highlight }
```

**`selectRequest(i)`** — calls `converters[selectedLang].convert(entry, currentLang)` then `highlight(code)`, renders via `DOMParser` into `codeEl`.

## Security notes

All dynamic content uses DOM APIs (`textContent`, `append`, `replaceChildren`). The only `innerHTML`-equivalent path is `codeEl` via `DOMParser.parseFromString(highlight(code), 'text/html')`, which is safe because `makeHighlighter` HTML-encodes the source string before inserting span tags.

## i18n

Three locales: `pt_br`, `en`, `es`. Detected from `navigator.language` at startup, overridable via the UI selector. The `t(key)` helper reads from `i18n[currentLang]`. Elements with `data-i18n` / `data-i18n-ph` attributes are translated by `applyTranslations()`.

Firefox also uses `_locales/` for the extension name and description shown in the browser UI (`__MSG_extName__`, `__MSG_extDescription__`). The Chrome version uses hardcoded strings in `manifest.json`.

## Adding a new target language

See [docs/adding-converters.md](docs/adding-converters.md). Changes must be applied to both `firefox/lib/converters.js` and `chrome/lib/converters.js`.

## Development workflow

### Firefox
```
about:debugging → This Firefox → Load Temporary Add-on → select firefox/manifest.json
```

### Chrome
```
chrome://extensions → enable Developer mode → Load unpacked → select chrome/ folder
```

### After changes
- `panel.js` / `panel.html`: close and reopen the DevTools panel
- `manifest.json` / `devtools.js`: reload the extension from the browser's extensions page

### Tests
```bash
npm test
```
Tests live in `firefox/test/` and import from `firefox/lib/converters.js`. The Jest glob `**/test/**/*.test.js` in `package.json` finds them automatically.

### Publishing

**Firefox (AMO):**
```bash
cd firefox && npx web-ext lint && npx web-ext build
```

**Chrome (CWS):** zip the `chrome/` folder and submit via the Chrome Developer Dashboard.
