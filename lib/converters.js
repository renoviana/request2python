// Pure functions: i18n, converters, highlighters, resource-type classifier.
// Loaded as a plain <script> in the browser; required via CommonJS in tests.

// ─── i18n ─────────────────────────────────────────────────────────────────────

const i18n = {
  en: {
    filterPlaceholder: 'Filter by URL...',
    preserveLog:       'Preserve log',
    clearBtn:          'Clear',
    typeAll:           'All',
    typeOther:         'Other',
    tabCode:           'Code',
    tabResponse:       'Response',
    copyCode:          'Copy code',
    copiedCode:        '✓ Copied!',
    placeholderText:   'Select a request to see the code',
    viewFormatted:     'Formatted',
    viewTree:          'Tree',
    copyResponse:      'Copy',
    copiedResponse:    '✓ Copied!',
    loading:           'Loading...',
    noContent:         '(no content)',
    notJson:           '(not JSON — use Raw or Formatted)',
    treeItems:         'items',
    treeKeys:          'keys',
    multipartComment:  "# multipart/form-data — adjust 'files' as needed",
  },
  es: {
    filterPlaceholder: 'Filtrar por URL...',
    preserveLog:       'Mantener log',
    clearBtn:          'Limpiar',
    typeAll:           'Todo',
    typeOther:         'Otro',
    tabCode:           'Código',
    tabResponse:       'Respuesta',
    copyCode:          'Copiar código',
    copiedCode:        '✓ Copiado!',
    placeholderText:   'Selecciona una solicitud para ver el código',
    viewFormatted:     'Formateado',
    viewTree:          'Árbol',
    copyResponse:      'Copiar',
    copiedResponse:    '✓ Copiado!',
    loading:           'Cargando...',
    noContent:         '(sin contenido)',
    notJson:           '(no es JSON — usa Raw o Formateado)',
    treeItems:         'elementos',
    treeKeys:          'claves',
    multipartComment:  "# multipart/form-data — ajusta 'files' según sea necesario",
  },
  pt_br: {
    filterPlaceholder: 'Filtrar por URL...',
    preserveLog:       'Manter log',
    clearBtn:          'Limpar',
    typeAll:           'Tudo',
    typeOther:         'Outro',
    tabCode:           'Código',
    tabResponse:       'Resposta',
    copyCode:          'Copiar código',
    copiedCode:        '✓ Copiado!',
    placeholderText:   'Selecione uma requisição para ver o código',
    viewFormatted:     'Formatado',
    viewTree:          'Árvore',
    copyResponse:      'Copiar',
    copiedResponse:    '✓ Copiado!',
    loading:           'Carregando...',
    noContent:         '(sem conteúdo)',
    notJson:           '(não é JSON — use Raw ou Formatado)',
    treeItems:         'itens',
    treeKeys:          'chaves',
    multipartComment:  "# multipart/form-data — ajuste 'files' conforme necessário",
  },
};

// ─── Python ──────────────────────────────────────────────────────────────────

function pyStr(s) {
  const v = String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `'${v}'`;
}

function pyDict(obj, indent = 4) {
  const pad = ' '.repeat(indent);
  const lines = ['{'];
  for (const [k, v] of Object.entries(obj)) {
    lines.push(`${pad}${pyStr(k)}: ${pyStr(v)},`);
  }
  lines.push('}');
  return lines.join('\n');
}

function jsonToPy(value, indent = 0) {
  const pad = ' '.repeat(indent);
  const inner = ' '.repeat(indent + 4);
  if (value === null) return 'None';
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return pyStr(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(v => inner + jsonToPy(v, indent + 4)).join(',\n');
    return `[\n${items},\n${pad}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const items = keys.map(k => `${inner}${pyStr(k)}: ${jsonToPy(value[k], indent + 4)}`).join(',\n');
    return `{\n${items},\n${pad}}`;
  }
  return pyStr(value);
}

function harToPython(entry, lang = 'pt_br') {
  const req = entry.request;
  const method = req.method;
  const url = req.url;
  const lines = ['import requests', ''];

  const cookieHeader = req.headers.find(h => h.name.toLowerCase() === 'cookie');
  const cookies = {};
  if (cookieHeader) {
    for (const part of cookieHeader.value.split(';')) {
      const idx = part.indexOf('=');
      if (idx > 0) cookies[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
    }
  }

  const headers = {};
  for (const h of req.headers) {
    if (h.name.toLowerCase() !== 'cookie') headers[h.name] = h.value;
  }

  const contentType = Object.entries(headers)
    .find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';

  if (Object.keys(headers).length > 0) lines.push(`headers = ${pyDict(headers)}`, '');
  if (Object.keys(cookies).length > 0) lines.push(`cookies = ${pyDict(cookies)}`, '');

  let bodyParam = '';
  if (req.postData) {
    const text = req.postData.text || '';
    const ct = contentType.toLowerCase();
    if (ct.includes('application/json')) {
      try {
        lines.push(`json_data = ${jsonToPy(JSON.parse(text))}`, '');
        bodyParam = 'json=json_data';
      } catch {
        lines.push(`data = ${pyStr(text)}`, '');
        bodyParam = 'data=data';
      }
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const formObj = {};
      for (const [k, v] of new URLSearchParams(text)) formObj[k] = v;
      lines.push(`data = ${pyDict(formObj)}`, '');
      bodyParam = 'data=data';
    } else if (ct.includes('multipart/form-data')) {
      lines.push((i18n[lang] ?? i18n.pt_br).multipartComment);
      if (req.postData.params?.length) {
        const filesObj = {};
        for (const p of req.postData.params) filesObj[p.name] = p.value ?? '';
        lines.push(`files = ${pyDict(filesObj)}`, '');
      } else {
        lines.push('files = {}', '');
      }
      bodyParam = 'files=files';
    } else if (text) {
      lines.push(`data = ${pyStr(text)}`, '');
      bodyParam = 'data=data';
    }
  }

  const args = [`\n    ${pyStr(url)}`];
  if (Object.keys(headers).length > 0) args.push('\n    headers=headers');
  if (Object.keys(cookies).length > 0) args.push('\n    cookies=cookies');
  if (bodyParam) args.push(`\n    ${bodyParam}`);

  lines.push(`response = requests.${method.toLowerCase()}(${args.join(',')},\n)`);
  lines.push('', 'print(response.status_code)', 'print(response.text)');
  return lines.join('\n');
}

// ─── JavaScript (fetch) ──────────────────────────────────────────────────────

function jsStr(s) {
  return JSON.stringify(String(s));
}

function jsObj(obj, indent = 2) {
  const inner = ' '.repeat(indent + 2);
  const pad = ' '.repeat(indent);
  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';
  const lines = entries.map(([k, v]) => `${inner}${JSON.stringify(k)}: ${jsStr(v)}`);
  return `{\n${lines.join(',\n')},\n${pad}}`;
}

function harToFetch(entry) {
  const req = entry.request;
  const method = req.method;
  const url = req.url;
  const lines = [];

  const headers = {};
  for (const h of req.headers) {
    if (h.name.toLowerCase() !== 'cookie') headers[h.name] = h.value;
  }

  const contentType = Object.entries(headers)
    .find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';

  const optParts = [];
  if (method !== 'GET') optParts.push(`  method: ${jsStr(method)}`);

  if (Object.keys(headers).length > 0) {
    lines.push(`const headers = ${jsObj(headers)};`, '');
    optParts.push('  headers');
  }

  if (req.postData?.text) {
    const text = req.postData.text;
    const ct = contentType.toLowerCase();
    if (ct.includes('application/json')) {
      try {
        lines.push(`const body = JSON.stringify(${JSON.stringify(JSON.parse(text), null, 2)});`, '');
      } catch {
        lines.push(`const body = ${jsStr(text)};`, '');
      }
    } else {
      lines.push(`const body = ${jsStr(text)};`, '');
    }
    optParts.push('  body');
  }

  const opts = optParts.length > 0 ? `, {\n${optParts.join(',\n')},\n}` : '';
  lines.push(`const response = await fetch(${jsStr(url)}${opts});`, '');
  lines.push('const data = await response.json();');
  lines.push('console.log(response.status, data);');
  return lines.join('\n');
}

// ─── cURL ────────────────────────────────────────────────────────────────────

function shStr(s) {
  const v = String(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
  return `"${v}"`;
}

function harToCurl(entry) {
  const req = entry.request;
  const parts = [`curl -X ${req.method}`];

  for (const h of req.headers) {
    if (h.name.toLowerCase() !== 'cookie') {
      parts.push(`  -H ${shStr(`${h.name}: ${h.value}`)}`);
    }
  }

  const cookieHeader = req.headers.find(h => h.name.toLowerCase() === 'cookie');
  if (cookieHeader) parts.push(`  -b ${shStr(cookieHeader.value)}`);
  if (req.postData?.text) parts.push(`  --data-raw ${shStr(req.postData.text)}`);

  parts.push(`  ${shStr(req.url)}`);
  return parts.join(' \\\n');
}

// ─── PHP ─────────────────────────────────────────────────────────────────────

function phpStr(s) {
  const v = String(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
  return `'${v}'`;
}

function harToPhp(entry) {
  const req = entry.request;
  const lines = ['<?php', ''];

  const cookieHeader = req.headers.find(h => h.name.toLowerCase() === 'cookie');
  const headers = {};
  for (const h of req.headers) {
    if (h.name.toLowerCase() !== 'cookie') headers[h.name] = h.value;
  }

  lines.push('$ch = curl_init();', '');
  lines.push(`curl_setopt($ch, CURLOPT_URL, ${phpStr(req.url)});`);
  lines.push('curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);');
  lines.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpStr(req.method)});`);

  if (Object.keys(headers).length > 0) {
    const items = Object.entries(headers)
      .map(([k, v]) => `    ${phpStr(`${k}: ${v}`)}`)
      .join(',\n');
    lines.push(`curl_setopt($ch, CURLOPT_HTTPHEADER, [\n${items},\n]);`);
  }

  if (cookieHeader) {
    lines.push(`curl_setopt($ch, CURLOPT_COOKIE, ${phpStr(cookieHeader.value)});`);
  }

  if (req.postData?.text) {
    lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpStr(req.postData.text)});`);
  }

  lines.push('');
  lines.push('$response = curl_exec($ch);');
  lines.push('$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);');
  lines.push('curl_close($ch);', '');
  lines.push('echo $status . "\\n" . $response;');
  return lines.join('\n');
}

// ─── Go ──────────────────────────────────────────────────────────────────────

function goStr(s) {
  return JSON.stringify(String(s));
}

function harToGo(entry) {
  const req = entry.request;
  const hasBody = !!(req.postData?.text);

  const cookieHeader = req.headers.find(h => h.name.toLowerCase() === 'cookie');
  const headers = {};
  for (const h of req.headers) {
    if (h.name.toLowerCase() !== 'cookie') headers[h.name] = h.value;
  }

  const imports = ['"fmt"', '"io"', '"net/http"'];
  if (hasBody) imports.splice(2, 0, '"strings"');

  const lines = [
    'package main', '',
    'import (', ...imports.map(i => `\t${i}`), ')', '',
    'func main() {',
  ];

  if (hasBody) {
    lines.push(`\tbody := strings.NewReader(${goStr(req.postData.text)})`);
    lines.push(`\treq, _ := http.NewRequest(${goStr(req.method)}, ${goStr(req.url)}, body)`);
  } else {
    lines.push(`\treq, _ := http.NewRequest(${goStr(req.method)}, ${goStr(req.url)}, nil)`);
  }

  for (const [k, v] of Object.entries(headers)) {
    lines.push(`\treq.Header.Set(${goStr(k)}, ${goStr(v)})`);
  }
  if (cookieHeader) {
    lines.push(`\treq.Header.Set("Cookie", ${goStr(cookieHeader.value)})`);
  }

  lines.push(
    '', '\tclient := &http.Client{}',
    '\tresp, err := client.Do(req)',
    '\tif err != nil {', '\t\tpanic(err)', '\t}',
    '\tdefer resp.Body.Close()',
    '', '\trespBody, _ := io.ReadAll(resp.Body)',
    '\tfmt.Println(resp.Status)',
    '\tfmt.Println(string(respBody))',
    '}',
  );
  return lines.join('\n');
}

// ─── Syntax highlighting ─────────────────────────────────────────────────────

// strQuote: the quote character used for string literals ('"' or "'"), or null for none.
// Strings are extracted to placeholders before code rules run, preventing rules from
// matching quote characters inside already-inserted span class attributes.
function makeHighlighter(commentPrefix, strQuote, rules) {
  const strRe = strQuote === '"'
    ? /"((?:[^"\\]|\\.)*)"/g
    : strQuote === "'"
    ? /'((?:[^'\\]|\\.)*)'/g
    : null;

  return function(code) {
    const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return code.split('\n').map(line => {
      let codePart = line, commentPart = '';
      if (commentPrefix) {
        const idx = line.indexOf(commentPrefix);
        if (idx >= 0) {
          const before = line.slice(0, idx);
          const sq = (before.match(/'/g) || []).length;
          const dq = (before.match(/"/g) || []).length;
          if (sq % 2 === 0 && dq % 2 === 0) {
            codePart = line.slice(0, idx);
            commentPart = line.slice(idx);
          }
        }
      }
      const strings = [];
      const tokenized = strRe
        ? codePart.replace(strRe, match => { strings.push(escape(match)); return `\x00S${strings.length - 1}S\x00`; })
        : codePart;
      let html = escape(tokenized);
      for (const [re, repl] of rules) html = html.replace(re, repl);
      html = html.replace(/\x00S(\d+)S\x00/g, (_, i) => `<span class="str">${strings[+i]}</span>`);
      if (commentPart) html += `<span class="cm">${escape(commentPart)}</span>`;
      return html;
    }).join('\n');
  };
}

const highlightPython = makeHighlighter('#', "'", [
  [/\b(import|True|False|None)\b/g,        '<span class="kw">$1</span>'],
  [/\b(requests\.\w+)/g,                   '<span class="fn">$1</span>'],
  [/\b(\d+(?:\.\d+)?)\b/g,                 '<span class="num">$1</span>'],
  [/^(\s*)(\w+)(\s*=)/gm,                  '$1<span class="var">$2</span>$3'],
]);

const highlightJS = makeHighlighter('//', '"', [
  [/\b(await|async|function|return|new|true|false|null|undefined)\b/g, '<span class="kw">$1</span>'],
  [/\b(fetch|JSON\.stringify|JSON\.parse|console\.log)\b/g,            '<span class="fn">$1</span>'],
  [/\b(\d+(?:\.\d+)?)\b/g,                                             '<span class="num">$1</span>'],
  [/^(\s*)(const|let|var)\s+(\w+)/gm,      '$1<span class="kw">$2</span> <span class="var">$3</span>'],
]);

const highlightCurl = makeHighlighter(null, '"', [
  [/^(curl)\b/gm,                '<span class="fn">$1</span>'],
  [/ (--?[\w-]+)/g,              ' <span class="kw">$1</span>'],
]);

const highlightPhp = makeHighlighter('//', "'", [
  [/\b(echo|true|false|null|return)\b/g,                              '<span class="kw">$1</span>'],
  [/\b(curl_init|curl_setopt|curl_exec|curl_getinfo|curl_close)\b/g,  '<span class="fn">$1</span>'],
  [/\b(CURLOPT_\w+|CURLINFO_\w+)\b/g,                                 '<span class="kw">$1</span>'],
  [/(\$\w+)/g,                                                         '<span class="var">$1</span>'],
  [/\b(\d+(?:\.\d+)?)\b/g,                                             '<span class="num">$1</span>'],
]);

const highlightGo = makeHighlighter('//', '"', [
  [/\b(package|import|func|if|defer|var|const|return|nil)\b/g, '<span class="kw">$1</span>'],
  [/\b(http\.\w+|io\.\w+|fmt\.\w+|strings\.\w+)\b/g,          '<span class="fn">$1</span>'],
  [/\b(\d+(?:\.\d+)?)\b/g,                                     '<span class="num">$1</span>'],
  [/^(\t*)(\w+)(\s*:=)/gm,                                     '$1<span class="var">$2</span>$3'],
]);

// ─── Converter registry ──────────────────────────────────────────────────────

const converters = {
  python:   { label: 'Python',     convert: harToPython, highlight: highlightPython },
  js_fetch: { label: 'JS (fetch)', convert: harToFetch,  highlight: highlightJS     },
  curl:     { label: 'cURL',       convert: harToCurl,   highlight: highlightCurl   },
  php:      { label: 'PHP',        convert: harToPhp,    highlight: highlightPhp    },
  go:       { label: 'Go',         convert: harToGo,     highlight: highlightGo     },
};

// ─── Resource type ────────────────────────────────────────────────────────────

function getResourceType(entry) {
  const rt = entry._resourceType;
  if (rt) {
    if (rt === 'xhr' || rt === 'fetch') return 'xhr';
    if (rt === 'script')     return 'js';
    if (rt === 'stylesheet') return 'css';
    if (rt === 'image')      return 'img';
    if (rt === 'document')   return 'doc';
    return 'other';
  }
  const mime = (entry.response?.content?.mimeType || '').toLowerCase();
  if (mime.includes('text/html') || mime.includes('application/xhtml')) return 'doc';
  if (mime.includes('javascript'))                                        return 'js';
  if (mime.includes('text/css'))                                          return 'css';
  if (mime.startsWith('image/'))                                          return 'img';
  if (mime.includes('json') || mime.includes('xml'))                      return 'xhr';
  return 'other';
}

// ─── CommonJS export (Node.js / tests) ───────────────────────────────────────

if (typeof module !== 'undefined') {
  module.exports = {
    i18n,
    pyStr, pyDict, jsonToPy, harToPython,
    jsStr, jsObj, harToFetch,
    shStr, harToCurl,
    phpStr, harToPhp,
    goStr, harToGo,
    makeHighlighter,
    highlightPython, highlightJS, highlightCurl, highlightPhp, highlightGo,
    converters,
    getResourceType,
  };
}
