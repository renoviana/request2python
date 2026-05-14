'use strict';

const {
  pyStr, pyDict, jsonToPy, harToPython,
  jsStr, jsObj, harToFetch,
  shStr, harToCurl,
  phpStr, harToPhp,
  goStr, harToGo,
} = require('../lib/converters');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function entry({
  method = 'GET',
  url = 'https://api.example.com/data',
  headers = [],
  postData = null,
} = {}) {
  return { request: { method, url, headers, postData } };
}

function hdr(name, value) { return { name, value }; }

// ─── pyStr ────────────────────────────────────────────────────────────────────

describe('pyStr', () => {
  test('wraps in single quotes', () => {
    expect(pyStr('hello')).toBe("'hello'");
  });

  test('escapes single quotes', () => {
    expect(pyStr("it's")).toBe("'it\\'s'");
  });

  test('escapes backslashes', () => {
    expect(pyStr('a\\b')).toBe("'a\\\\b'");
  });

  test('escapes newlines and carriage returns', () => {
    expect(pyStr('a\nb')).toBe("'a\\nb'");
    expect(pyStr('a\rb')).toBe("'a\\rb'");
  });
});

// ─── pyDict ───────────────────────────────────────────────────────────────────

describe('pyDict', () => {
  test('produces valid Python dict syntax', () => {
    const result = pyDict({ 'Content-Type': 'application/json' });
    expect(result).toContain("'Content-Type': 'application/json'");
    expect(result).toMatch(/^\{/);
    expect(result).toMatch(/\}$/);
  });

  test('includes all keys', () => {
    const result = pyDict({ a: '1', b: '2' });
    expect(result).toContain("'a': '1'");
    expect(result).toContain("'b': '2'");
  });
});

// ─── jsonToPy ─────────────────────────────────────────────────────────────────

describe('jsonToPy', () => {
  test('null → None', () => expect(jsonToPy(null)).toBe('None'));
  test('true → True', () => expect(jsonToPy(true)).toBe('True'));
  test('false → False', () => expect(jsonToPy(false)).toBe('False'));
  test('number', () => expect(jsonToPy(42)).toBe('42'));
  test('string', () => expect(jsonToPy('hi')).toBe("'hi'"));
  test('empty array → []', () => expect(jsonToPy([])).toBe('[]'));
  test('empty object → {}', () => expect(jsonToPy({})).toBe('{}'));

  test('nested object', () => {
    const result = jsonToPy({ key: 'value' });
    expect(result).toContain("'key': 'value'");
  });

  test('array of values', () => {
    const result = jsonToPy([1, 'two', null]);
    expect(result).toContain('1');
    expect(result).toContain("'two'");
    expect(result).toContain('None');
  });
});

// ─── harToPython ──────────────────────────────────────────────────────────────

describe('harToPython', () => {
  test('GET produces import and requests.get call', () => {
    const code = harToPython(entry());
    expect(code).toContain('import requests');
    expect(code).toContain('requests.get(');
    expect(code).toContain("'https://api.example.com/data'");
    expect(code).toContain('print(response.status_code)');
  });

  test('no headers → no headers variable', () => {
    const code = harToPython(entry());
    expect(code).not.toContain('headers =');
  });

  test('headers are emitted as a dict', () => {
    const code = harToPython(entry({
      headers: [hdr('Authorization', 'Bearer tok')],
    }));
    expect(code).toContain('headers =');
    expect(code).toContain("'Authorization': 'Bearer tok'");
    expect(code).toContain('headers=headers');
  });

  test('Cookie header is separated into cookies dict', () => {
    const code = harToPython(entry({
      headers: [hdr('Cookie', 'session=abc; user=xyz')],
    }));
    expect(code).toContain('cookies =');
    expect(code).toContain("'session': 'abc'");
    expect(code).toContain("'user': 'xyz'");
    expect(code).not.toContain("'Cookie'");
    expect(code).toContain('cookies=cookies');
  });

  test('POST with JSON body uses json= kwarg', () => {
    const code = harToPython(entry({
      method: 'POST',
      headers: [hdr('Content-Type', 'application/json')],
      postData: { text: '{"key":"value"}', params: [] },
    }));
    expect(code).toContain('json_data =');
    expect(code).toContain('json=json_data');
    expect(code).toContain('requests.post(');
  });

  test('POST with invalid JSON falls back to data=', () => {
    const code = harToPython(entry({
      method: 'POST',
      headers: [hdr('Content-Type', 'application/json')],
      postData: { text: 'not-json', params: [] },
    }));
    expect(code).toContain('data =');
    expect(code).toContain('data=data');
  });

  test('POST with form-urlencoded uses data dict', () => {
    const code = harToPython(entry({
      method: 'POST',
      headers: [hdr('Content-Type', 'application/x-www-form-urlencoded')],
      postData: { text: 'foo=bar&baz=qux', params: [] },
    }));
    expect(code).toContain("'foo': 'bar'");
    expect(code).toContain("'baz': 'qux'");
    expect(code).toContain('data=data');
  });

  test('POST multipart uses files=', () => {
    const code = harToPython(entry({
      method: 'POST',
      headers: [hdr('Content-Type', 'multipart/form-data; boundary=---')],
      postData: { text: '', params: [{ name: 'file', value: 'data' }] },
    }));
    expect(code).toContain('files =');
    expect(code).toContain('files=files');
  });

  test('multipart comment changes with lang', () => {
    const pt = harToPython(entry({
      method: 'POST',
      headers: [hdr('Content-Type', 'multipart/form-data')],
      postData: { text: '', params: [] },
    }), 'pt');
    const en = harToPython(entry({
      method: 'POST',
      headers: [hdr('Content-Type', 'multipart/form-data')],
      postData: { text: '', params: [] },
    }), 'en');
    expect(pt).toContain('conforme necessário');
    expect(en).toContain('as needed');
  });

  test('POST with raw body uses data=', () => {
    const code = harToPython(entry({
      method: 'POST',
      headers: [],
      postData: { text: 'raw body', params: [] },
    }));
    expect(code).toContain("data = 'raw body'");
    expect(code).toContain('data=data');
  });
});

// ─── jsStr ────────────────────────────────────────────────────────────────────

describe('jsStr', () => {
  test('produces double-quoted JSON string', () => {
    expect(jsStr('hello')).toBe('"hello"');
  });

  test('escapes double quotes', () => {
    expect(jsStr('say "hi"')).toBe('"say \\"hi\\""');
  });

  test('escapes backslashes', () => {
    expect(jsStr('a\\b')).toBe('"a\\\\b"');
  });
});

// ─── jsObj ────────────────────────────────────────────────────────────────────

describe('jsObj', () => {
  test('empty object', () => {
    expect(jsObj({})).toBe('{}');
  });

  test('contains key-value pairs', () => {
    const result = jsObj({ foo: 'bar' });
    expect(result).toContain('"foo": "bar"');
  });
});

// ─── harToFetch ───────────────────────────────────────────────────────────────

describe('harToFetch', () => {
  test('GET produces bare fetch call', () => {
    const code = harToFetch(entry());
    expect(code).toContain('await fetch(');
    expect(code).not.toContain('method:');
    expect(code).toContain('console.log(response.status, data)');
  });

  test('POST includes method in options', () => {
    const code = harToFetch(entry({ method: 'POST' }));
    expect(code).toContain('method: "POST"');
  });

  test('headers are declared as const', () => {
    const code = harToFetch(entry({
      headers: [hdr('Authorization', 'Bearer x')],
    }));
    expect(code).toContain('const headers =');
    expect(code).toContain('"Authorization": "Bearer x"');
    expect(code).toContain('headers');
  });

  test('Cookie header is excluded from headers object', () => {
    const code = harToFetch(entry({
      headers: [hdr('Cookie', 's=1'), hdr('Accept', 'application/json')],
    }));
    expect(code).not.toContain('"Cookie"');
    expect(code).toContain('"Accept"');
  });

  test('JSON body is JSON.stringify wrapped', () => {
    const code = harToFetch(entry({
      method: 'POST',
      headers: [hdr('Content-Type', 'application/json')],
      postData: { text: '{"id":1}' },
    }));
    expect(code).toContain('JSON.stringify(');
    expect(code).toContain('body');
  });
});

// ─── shStr ────────────────────────────────────────────────────────────────────

describe('shStr', () => {
  test('wraps in double quotes', () => {
    expect(shStr('hello')).toBe('"hello"');
  });

  test('escapes dollar signs', () => {
    expect(shStr('$VAR')).toBe('"\\$VAR"');
  });

  test('escapes backticks', () => {
    expect(shStr('`cmd`')).toBe('"\\`cmd\\`"');
  });

  test('escapes double quotes', () => {
    expect(shStr('say "hi"')).toBe('"say \\"hi\\""');
  });
});

// ─── harToCurl ────────────────────────────────────────────────────────────────

describe('harToCurl', () => {
  test('starts with curl -X METHOD', () => {
    const code = harToCurl(entry());
    expect(code).toMatch(/^curl -X GET/);
  });

  test('ends with quoted URL', () => {
    const code = harToCurl(entry());
    expect(code).toContain('"https://api.example.com/data"');
  });

  test('headers become -H flags', () => {
    const code = harToCurl(entry({
      headers: [hdr('Authorization', 'Bearer tok')],
    }));
    expect(code).toContain('-H "Authorization: Bearer tok"');
  });

  test('Cookie header becomes -b flag, not -H', () => {
    const code = harToCurl(entry({
      headers: [hdr('Cookie', 'session=abc')],
    }));
    expect(code).toContain('-b "session=abc"');
    expect(code).not.toContain('-H "Cookie:');
  });

  test('body becomes --data-raw', () => {
    const code = harToCurl(entry({
      method: 'POST',
      postData: { text: 'payload=hello' },
    }));
    expect(code).toContain('--data-raw');
    expect(code).toContain('payload=hello');
  });

  test('lines are joined with space-backslash-newline', () => {
    const code = harToCurl(entry({
      headers: [hdr('X-Custom', 'val')],
    }));
    expect(code).toContain(' \\\n');
  });
});

// ─── phpStr ───────────────────────────────────────────────────────────────────

describe('phpStr', () => {
  test('wraps in single quotes', () => {
    expect(phpStr('hello')).toBe("'hello'");
  });

  test('escapes single quotes', () => {
    expect(phpStr("it's")).toBe("'it\\'s'");
  });

  test('escapes backslashes', () => {
    expect(phpStr('a\\b')).toBe("'a\\\\b'");
  });
});

// ─── harToPhp ─────────────────────────────────────────────────────────────────

describe('harToPhp', () => {
  test('contains PHP boilerplate', () => {
    const code = harToPhp(entry());
    expect(code).toContain('<?php');
    expect(code).toContain('curl_init()');
    expect(code).toContain('curl_exec($ch)');
    expect(code).toContain('curl_close($ch)');
  });

  test('sets CURLOPT_URL', () => {
    const code = harToPhp(entry());
    expect(code).toContain("CURLOPT_URL, 'https://api.example.com/data'");
  });

  test('sets CURLOPT_CUSTOMREQUEST to method', () => {
    const code = harToPhp(entry({ method: 'DELETE' }));
    expect(code).toContain("CURLOPT_CUSTOMREQUEST, 'DELETE'");
  });

  test('headers become CURLOPT_HTTPHEADER array', () => {
    const code = harToPhp(entry({
      headers: [hdr('Authorization', 'Bearer tok')],
    }));
    expect(code).toContain('CURLOPT_HTTPHEADER');
    expect(code).toContain("'Authorization: Bearer tok'");
  });

  test('Cookie becomes CURLOPT_COOKIE', () => {
    const code = harToPhp(entry({
      headers: [hdr('Cookie', 'session=abc')],
    }));
    expect(code).toContain("CURLOPT_COOKIE, 'session=abc'");
    expect(code).not.toContain('Cookie:');
  });

  test('body becomes CURLOPT_POSTFIELDS', () => {
    const code = harToPhp(entry({
      method: 'POST',
      postData: { text: '{"a":1}' },
    }));
    expect(code).toContain("CURLOPT_POSTFIELDS, '{\"a\":1}'");
  });
});

// ─── goStr ────────────────────────────────────────────────────────────────────

describe('goStr', () => {
  test('produces double-quoted Go string', () => {
    expect(goStr('hello')).toBe('"hello"');
  });

  test('escapes backslashes via JSON.stringify', () => {
    expect(goStr('a\\b')).toBe('"a\\\\b"');
  });
});

// ─── harToGo ──────────────────────────────────────────────────────────────────

describe('harToGo', () => {
  test('contains Go boilerplate', () => {
    const code = harToGo(entry());
    expect(code).toContain('package main');
    expect(code).toContain('func main()');
    expect(code).toContain('http.NewRequest');
    expect(code).toContain('http.Client{}');
  });

  test('GET does not import strings', () => {
    const code = harToGo(entry());
    expect(code).not.toContain('"strings"');
  });

  test('POST with body imports strings', () => {
    const code = harToGo(entry({
      method: 'POST',
      postData: { text: 'payload' },
    }));
    expect(code).toContain('"strings"');
    expect(code).toContain('strings.NewReader(');
  });

  test('nil body for GET', () => {
    const code = harToGo(entry());
    expect(code).toContain(', nil)');
  });

  test('headers produce req.Header.Set calls', () => {
    const code = harToGo(entry({
      headers: [hdr('X-Custom', 'value')],
    }));
    expect(code).toContain('req.Header.Set("X-Custom", "value")');
  });

  test('Cookie header produces Header.Set("Cookie", ...)', () => {
    const code = harToGo(entry({
      headers: [hdr('Cookie', 's=1')],
    }));
    expect(code).toContain('req.Header.Set("Cookie", "s=1")');
    expect(code).not.toMatch(/Header\.Set\("Cookie",.*Header\.Set\("Cookie",/s);
  });

  test('response body read with io.ReadAll', () => {
    const code = harToGo(entry());
    expect(code).toContain('io.ReadAll(resp.Body)');
  });
});
