# Adding a new target language

All converter logic lives in `lib/converters.js`. Adding a new language requires four steps — no changes to `panel.js` needed beyond the HTML selector.

## 1. Write a string-escaping helper

Each language needs a function that safely escapes a value for inclusion in a string literal:

```js
function rustStr(s) {
  return JSON.stringify(String(s)); // or custom escaping as needed
}
```

## 2. Write the HAR converter

The converter receives a HAR `entry` object and returns a source code string.

```js
function harToRust(entry) {
  const req = entry.request;
  const lines = [];

  // Build headers, body, etc. from req.headers, req.postData, req.method, req.url
  // ...

  return lines.join('\n');
}
```

### HAR entry fields used by existing converters

```js
entry.request.method          // 'GET', 'POST', ...
entry.request.url             // full URL string
entry.request.headers         // [{ name, value }]
entry.request.postData        // { text: string, params: [{name, value}] } | null
entry.request.postData.text   // raw body text
entry.request.postData.params // multipart params
```

### Cookie handling pattern

All converters extract the `Cookie` header separately so it can use a language-appropriate mechanism:

```js
const cookieHeader = req.headers.find(h => h.name.toLowerCase() === 'cookie');
const headers = {};
for (const h of req.headers) {
  if (h.name.toLowerCase() !== 'cookie') headers[h.name] = h.value;
}
```

## 3. Write the syntax highlighter

Use `makeHighlighter(commentPrefix, strQuote, rules)`:

```js
const highlightRust = makeHighlighter('//', '"', [
  [/\b(let|mut|fn|use|pub|struct|impl|return|true|false|None|Some)\b/g, '<span class="kw">$1</span>'],
  [/\b(println!|format!|reqwest::\w+)\b/g,                              '<span class="fn">$1</span>'],
  [/\b(\d+(?:\.\d+)?)\b/g,                                              '<span class="num">$1</span>'],
  [/^(\s*)(\w+)(\s*=)/gm,                                               '$1<span class="var">$2</span>$3'],
]);
```

Parameters:
- `commentPrefix` — single-line comment prefix (`'//'`, `'#'`), or `null` if not applicable.
- `strQuote` — `'"'` or `"'"` — the character used for string literals. Strings are extracted before rules run, so rules cannot accidentally match quote characters inside `<span class="...">` attributes.
- `rules` — array of `[regex, replacement]` pairs applied in order to the non-string, non-comment part of each line.

Available CSS classes: `kw` (keyword), `fn` (function/builtin), `str` (string — auto-applied), `num` (number), `cm` (comment — auto-applied), `var` (variable).

## 4. Register the converter

Add an entry to the `converters` object at the bottom of `lib/converters.js`:

```js
const converters = {
  python:   { label: 'Python',     convert: harToPython, highlight: highlightPython },
  js_fetch: { label: 'JS (fetch)', convert: harToFetch,  highlight: highlightJS     },
  curl:     { label: 'cURL',       convert: harToCurl,   highlight: highlightCurl   },
  php:      { label: 'PHP',        convert: harToPhp,    highlight: highlightPhp    },
  go:       { label: 'Go',         convert: harToGo,     highlight: highlightGo     },
  rust:     { label: 'Rust',       convert: harToRust,   highlight: highlightRust   }, // new
};
```

Add the option to the `<select id="lang-select">` in `panel.html`:

```html
<select id="lang-select">
  <option value="python">Python</option>
  <option value="js_fetch">JS (fetch)</option>
  <option value="curl">cURL</option>
  <option value="php">PHP</option>
  <option value="go">Go</option>
  <option value="rust">Rust</option>  <!-- new -->
</select>
```

Export the new functions at the bottom of `lib/converters.js` (for tests):

```js
if (typeof module !== 'undefined') {
  module.exports = {
    // existing exports...
    rustStr, harToRust, highlightRust,
  };
}
```

## 5. Add tests

Create or extend a test file in `test/`. Follow the pattern in `test/converters.test.js`:

```js
const { rustStr, harToRust } = require('../lib/converters');

describe('harToRust', () => {
  test('GET produces a reqwest call', () => {
    const code = harToRust(entry());
    expect(code).toContain('reqwest');
  });
  // ...
});
```

Run tests with:

```bash
npm test
```
