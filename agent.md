# request2code

Firefox DevTools extension that captures network requests and converts them to executable code snippets. Currently generates Python (`requests` library) with the architecture ready to support additional target languages.

## What it does

1. Hooks into `browser.devtools.network.onRequestFinished` to intercept all HTTP traffic while DevTools is open.
2. Parses each HAR entry and converts it to a Python `requests` call (headers, cookies, body, method).
3. Displays the generated code with syntax highlighting in a split-panel DevTools tab.
4. Shows the response body in three modes: formatted JSON, interactive tree, and raw text.
5. Provides one-click copy for both the generated code and the response body.

## File structure

```
request2code/
├── manifest.json      # WebExtension manifest (MV2, gecko-only)
├── devtools.html      # Entry point required by manifest's devtools_page key
├── devtools.js        # Registers the DevTools panel via browser.devtools.panels.create
├── panel.html         # Full UI — layout, CSS variables, tab structure
└── panel.js           # All application logic (~540 lines)
```

No build step, no dependencies, no bundler. The extension loads directly in Firefox.

## Architecture

### Entry flow

```
manifest.json
  └── devtools_page: devtools.html
        └── devtools.js
              └── browser.devtools.panels.create("request2code", ..., "panel.html")
                    └── panel.html + panel.js
```

### panel.js sections (in order)

| Lines | Responsibility |
|-------|---------------|
| 1–50  | Python string/dict serialization helpers (`pyStr`, `pyDict`, `jsonToPy`) |
| 51–142 | HAR-to-Python converter (`harToPython`) — handles all body types |
| 144–181 | Syntax highlighter (`highlight`) — escapes then applies regex spans |
| 183–195 | DOM element references |
| 199–222 | JSON tree helpers (`esc`, `valueEl`, `keyPrefixNodes`) |
| 224–290 | Recursive tree builder (`buildNode`, `buildJsonTree`) |
| 292–390 | Request list rendering (`renderList`) and filter logic |
| 391–445 | Response panel (`renderResponseBody`, `selectRequest`) |
| 447–535 | Event wiring: tabs, resize, copy, network listener |

### Key functions

**`harToPython(entry)`** — core converter. Reads a HAR `entry` object and returns a Python source string. Body dispatch order:
1. `application/json` → `json=` kwarg
2. `application/x-www-form-urlencoded` → `data=` dict
3. `multipart/form-data` → `files=` dict
4. Everything else → `data=` raw bytes

**`highlight(code)`** — XSS-safe. Calls its own `escape()` on each line *before* any regex substitution, so all user-visible content is entity-encoded before span tags are injected.

**`buildNode(value, key)`** — recursive. Returns a `<div class="jt-row">` subtree for any JSON value. Uses `keyPrefixNodes` and `valueEl` (DOM methods only, no `innerHTML`).

## Security notes

All dynamic content uses DOM APIs (`textContent`, `append`, `replaceChildren`). The only `innerHTML`-equivalent path is `codeEl` via `range.createContextualFragment(highlight(code))`, which is safe because `highlight()` HTML-encodes the source string before inserting span tags.

Network data (`statusText`, MIME type, response body) is never interpolated into HTML strings.

## Adding a new target language

1. Write a converter function analogous to `harToPython(entry)` in `panel.js`.
2. Add a language selector to the toolbar in `panel.html`.
3. Call the matching converter in `selectRequest()` instead of (or alongside) `harToPython`.
4. Optionally add a corresponding `highlight*` function for the new language.

The HAR entry schema (from `browser.devtools.network.onRequestFinished`) is documented at:  
https://firefox-source-docs.mozilla.org/devtools-user/network_monitor/index.html

## Manifest notes

- Uses **Manifest V2** (MV3 DevTools panels are not yet fully supported in Firefox).
- `browser_specific_settings.gecko.data_collection_permissions` is set to empty `required`/`optional` arrays — the extension collects no user data.
- Minimum Firefox version: **109.0** (required for stable `devtools.panels` API).

## Development workflow

Load as a temporary extension:

```
about:debugging → This Firefox → Load Temporary Add-on → select manifest.json
```

Changes to `panel.js` or `panel.html` take effect after closing and reopening the DevTools panel (no full reload needed for most edits). Changes to `manifest.json` or `devtools.js` require reloading the extension from `about:debugging`.

Lint before submitting to AMO:

```
npx web-ext lint
```
