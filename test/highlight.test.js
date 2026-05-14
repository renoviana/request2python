'use strict';

const {
  highlightPython,
  highlightJS,
  highlightCurl,
  highlightPhp,
  highlightGo,
} = require('../lib/converters');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasSpan(html, cls, content) {
  return html.includes(`<span class="${cls}">${content}</span>`);
}

// ─── highlightPython ─────────────────────────────────────────────────────────

describe('highlightPython', () => {
  test('HTML-escapes < > &', () => {
    const html = highlightPython('x = a < b & c > d');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
    expect(html).toContain('&amp;');
    expect(html).not.toContain('<b>');
  });

  test('keywords import / True / False / None get kw span', () => {
    const html = highlightPython('import requests');
    expect(hasSpan(html, 'kw', 'import')).toBe(true);
  });

  test('requests.get gets fn span', () => {
    const html = highlightPython('response = requests.get(url)');
    expect(html).toContain('<span class="fn">requests.get</span>');
  });

  test('single-quoted strings get str span', () => {
    const html = highlightPython("url = 'https://example.com'");
    expect(html).toContain('<span class="str">');
  });

  test('comment after # gets cm span', () => {
    const html = highlightPython('# this is a comment');
    expect(html).toContain('<span class="cm">');
    expect(html).toContain('# this is a comment');
  });

  test('# inside string is not treated as comment', () => {
    const html = highlightPython("x = '#notacomment'");
    expect(html).not.toContain('<span class="cm">');
  });

  test('multiline: each line processed independently', () => {
    const html = highlightPython('import requests\nresponse = requests.post(url)');
    expect(html).toContain('\n');
    expect(html).toContain('<span class="fn">requests.post</span>');
  });
});

// ─── highlightJS ──────────────────────────────────────────────────────────────

describe('highlightJS', () => {
  test('HTML-escapes special chars', () => {
    const html = highlightJS('const x = a < b');
    expect(html).toContain('&lt;');
  });

  test('await / async / return get kw span', () => {
    expect(highlightJS('const r = await fetch(url)')).toContain('<span class="kw">await</span>');
    expect(highlightJS('async function f() {}')).toContain('<span class="kw">async</span>');
  });

  test('fetch and JSON.stringify get fn span', () => {
    expect(highlightJS('await fetch(url)')).toContain('<span class="fn">fetch</span>');
    expect(highlightJS('JSON.stringify(obj)')).toContain('<span class="fn">JSON.stringify</span>');
  });

  test('double-quoted strings get str span', () => {
    const html = highlightJS('const url = "https://example.com"');
    expect(html).toContain('<span class="str">');
  });

  test('const/let/var + name get kw+var spans', () => {
    const html = highlightJS('const headers = {}');
    expect(html).toContain('<span class="kw">const</span>');
    expect(html).toContain('<span class="var">headers</span>');
  });

  test('// comment gets cm span', () => {
    const html = highlightJS('// send request');
    expect(html).toContain('<span class="cm">');
  });

  test('// inside string is not a comment', () => {
    const html = highlightJS('const url = "http://example.com"');
    expect(html).not.toContain('<span class="cm">');
  });
});

// ─── highlightCurl ────────────────────────────────────────────────────────────

describe('highlightCurl', () => {
  test('curl keyword gets fn span', () => {
    const html = highlightCurl('curl -X GET "https://example.com"');
    expect(html).toContain('<span class="fn">curl</span>');
  });

  test('flags like -X and -H get kw span', () => {
    const html = highlightCurl('curl -X GET \\\n  -H "Accept: json"');
    expect(html).toContain('<span class="kw">-X</span>');
    expect(html).toContain('<span class="kw">-H</span>');
  });

  test('--data-raw gets kw span', () => {
    const html = highlightCurl('  --data-raw "body"');
    expect(html).toContain('<span class="kw">--data-raw</span>');
  });

  test('double-quoted values get str span', () => {
    const html = highlightCurl('  "https://example.com"');
    expect(html).toContain('<span class="str">');
  });
});

// ─── highlightPhp ─────────────────────────────────────────────────────────────

describe('highlightPhp', () => {
  test('curl_init / curl_setopt get fn span', () => {
    expect(highlightPhp('$ch = curl_init();')).toContain('<span class="fn">curl_init</span>');
    expect(highlightPhp('curl_setopt($ch, CURLOPT_URL, $url);')).toContain('<span class="fn">curl_setopt</span>');
  });

  test('CURLOPT_* constants get kw span', () => {
    const html = highlightPhp('curl_setopt($ch, CURLOPT_URL, $url);');
    expect(html).toContain('<span class="kw">CURLOPT_URL</span>');
  });

  test('$variables get var span', () => {
    const html = highlightPhp('$ch = curl_init();');
    expect(html).toContain('<span class="var">$ch</span>');
  });

  test('single-quoted strings get str span', () => {
    const html = highlightPhp("curl_setopt($ch, CURLOPT_URL, 'https://example.com');");
    expect(html).toContain('<span class="str">');
  });

  test('echo keyword gets kw span', () => {
    const html = highlightPhp('echo $response;');
    expect(html).toContain('<span class="kw">echo</span>');
  });
});

// ─── highlightGo ──────────────────────────────────────────────────────────────

describe('highlightGo', () => {
  test('package / func / import get kw span', () => {
    expect(highlightGo('package main')).toContain('<span class="kw">package</span>');
    expect(highlightGo('func main() {')).toContain('<span class="kw">func</span>');
    expect(highlightGo('import (')).toContain('<span class="kw">import</span>');
  });

  test('http.* / fmt.* / io.* get fn span', () => {
    expect(highlightGo('\treq, _ := http.NewRequest("GET", url, nil)')).toContain('<span class="fn">http.NewRequest</span>');
    expect(highlightGo('\tfmt.Println(resp.Status)')).toContain('<span class="fn">fmt.Println</span>');
  });

  test('double-quoted strings get str span', () => {
    const html = highlightGo('\treq, _ := http.NewRequest("GET", "https://x.com", nil)');
    expect(html).toContain('<span class="str">');
  });

  test(':= assignment highlights variable', () => {
    const html = highlightGo('\tbody := strings.NewReader(s)');
    expect(html).toContain('<span class="var">body</span>');
  });

  test('// comment gets cm span', () => {
    const html = highlightGo('// make request');
    expect(html).toContain('<span class="cm">');
  });
});
