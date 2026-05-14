'use strict';

const { i18n, getResourceType } = require('../lib/converters');

// ─── i18n completeness ────────────────────────────────────────────────────────

const REQUIRED_KEYS = [
  'filterPlaceholder', 'preserveLog', 'clearBtn',
  'typeAll', 'typeOther',
  'tabCode', 'tabResponse',
  'copyCode', 'copiedCode',
  'placeholderText',
  'viewFormatted', 'viewTree',
  'copyResponse', 'copiedResponse',
  'loading', 'noContent', 'notJson',
  'treeItems', 'treeKeys',
  'multipartComment',
];

describe('i18n', () => {
  test.each(['pt', 'en', 'es'])('%s has all required keys', lang => {
    for (const key of REQUIRED_KEYS) {
      expect(i18n[lang]).toHaveProperty(key);
      expect(typeof i18n[lang][key]).toBe('string');
      expect(i18n[lang][key].length).toBeGreaterThan(0);
    }
  });

  test('pt translations are correct', () => {
    expect(i18n.pt.clearBtn).toBe('Limpar');
    expect(i18n.pt.typeAll).toBe('Tudo');
    expect(i18n.pt.loading).toBe('Carregando...');
  });

  test('en translations are correct', () => {
    expect(i18n.en.clearBtn).toBe('Clear');
    expect(i18n.en.typeAll).toBe('All');
    expect(i18n.en.loading).toBe('Loading...');
  });

  test('es translations are correct', () => {
    expect(i18n.es.clearBtn).toBe('Limpiar');
    expect(i18n.es.typeAll).toBe('Todo');
    expect(i18n.es.loading).toBe('Cargando...');
  });

  test('languages differ where expected', () => {
    expect(i18n.pt.clearBtn).not.toBe(i18n.en.clearBtn);
    expect(i18n.pt.clearBtn).not.toBe(i18n.es.clearBtn);
    expect(i18n.en.multipartComment).not.toBe(i18n.pt.multipartComment);
    expect(i18n.es.multipartComment).not.toBe(i18n.pt.multipartComment);
  });

  test('multipart comments contain the word files', () => {
    for (const lang of ['pt', 'en', 'es']) {
      expect(i18n[lang].multipartComment).toContain("'files'");
    }
  });
});

// ─── getResourceType ─────────────────────────────────────────────────────────

function entry(opts = {}) {
  return {
    _resourceType: opts._resourceType,
    response: { content: { mimeType: opts.mimeType ?? '' } },
  };
}

describe('getResourceType — _resourceType field', () => {
  test.each([
    ['xhr',        'xhr'],
    ['fetch',      'xhr'],
    ['script',     'js'],
    ['stylesheet', 'css'],
    ['image',      'img'],
    ['document',   'doc'],
    ['font',       'other'],
    ['websocket',  'other'],
    ['other',      'other'],
  ])('_resourceType=%s → %s', (rt, expected) => {
    expect(getResourceType(entry({ _resourceType: rt }))).toBe(expected);
  });
});

describe('getResourceType — MIME type fallback (no _resourceType)', () => {
  test.each([
    ['application/json',       'xhr'],
    ['application/xml',        'xhr'],
    ['text/html',              'doc'],
    ['application/xhtml+xml',  'doc'],
    ['text/javascript',        'js'],
    ['application/javascript', 'js'],
    ['text/css',               'css'],
    ['image/png',              'img'],
    ['image/svg+xml',          'img'],
    ['audio/mpeg',             'other'],
    ['font/woff2',             'other'],
    ['',                       'other'],
  ])('mimeType=%s → %s', (mimeType, expected) => {
    expect(getResourceType(entry({ mimeType }))).toBe(expected);
  });

  test('_resourceType takes precedence over MIME', () => {
    const e = { _resourceType: 'script', response: { content: { mimeType: 'text/html' } } };
    expect(getResourceType(e)).toBe('js');
  });
});
