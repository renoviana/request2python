// i18n, converters, highlighters and getResourceType are loaded from lib/converters.js

let allRequests = [];
let selectedIndex = -1;
let selectedLang = 'python';
let typeFilter = 'all';
const _supported = new Set(['pt_br', 'en', 'es']);
const _rawLang = (navigator.language || 'pt_br').toLowerCase();
const _browserLang = _rawLang === 'pt-br' ? 'pt_br' : _rawLang.split('-')[0];
let currentLang = _supported.has(_browserLang) ? _browserLang : 'pt_br';

// ─── i18n helpers ─────────────────────────────────────────────────────────────

function t(key) { return i18n[currentLang][key]; }

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
}

// ─── UI ──────────────────────────────────────────────────────────────────────

const listEl          = document.getElementById('request-list');
const codeEl          = document.getElementById('code-area');
const placeholder     = document.getElementById('placeholder');
const filterEl        = document.getElementById('filter');
const countEl         = document.getElementById('count');
const clearBtn        = document.getElementById('clear-btn');
const copyBtn         = document.getElementById('copy-btn');
const langSelect      = document.getElementById('lang-select');
const responseBody    = document.getElementById('response-body');
const responseTree    = document.getElementById('response-tree');
const responseStatus  = document.getElementById('response-status');
const copyResponseBtn = document.getElementById('copy-response-btn');

// ─── JSON tree viewer ─────────────────────────────────────────────────────────

function valueEl(v) {
  const span = document.createElement('span');
  if (v === null)                  { span.className = 'jt-null'; span.textContent = 'null'; }
  else if (typeof v === 'boolean') { span.className = 'jt-bool'; span.textContent = String(v); }
  else if (typeof v === 'number')  { span.className = 'jt-num';  span.textContent = String(v); }
  else if (typeof v === 'string')  { span.className = 'jt-str';  span.textContent = JSON.stringify(v); }
  else                             { span.textContent = String(v); }
  return span;
}

function keyPrefixNodes(key) {
  if (key === null) return [];
  const keySpan = document.createElement('span');
  keySpan.className = 'jt-key';
  keySpan.textContent = JSON.stringify(String(key));
  const colon = document.createElement('span');
  colon.className = 'jt-colon';
  colon.textContent = ': ';
  return [keySpan, colon];
}

function buildNode(value, key) {
  const row = document.createElement('div');
  row.className = 'jt-row';

  if (value === null || typeof value !== 'object') {
    row.append(...keyPrefixNodes(key), valueEl(value));
    return row;
  }

  const isArr = Array.isArray(value);
  const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
  const [open, close] = isArr ? ['[', ']'] : ['{', '}'];

  if (entries.length === 0) {
    const bracket = document.createElement('span');
    bracket.className = 'jt-bracket';
    bracket.textContent = open + close;
    row.append(...keyPrefixNodes(key), bracket);
    return row;
  }

  const toggle = document.createElement('span');
  toggle.className = 'jt-toggle';
  toggle.textContent = '▾';

  const openBracket = document.createElement('span');
  openBracket.className = 'jt-bracket';
  openBracket.textContent = open;

  const header = document.createElement('div');
  header.className = 'jt-header';
  header.append(toggle, ...keyPrefixNodes(key), openBracket);

  const summary = document.createElement('span');
  summary.className = 'jt-summary';
  summary.textContent = isArr ? `${entries.length} ${t('treeItems')}` : `${entries.length} ${t('treeKeys')}`;
  summary.style.display = 'none';
  header.appendChild(summary);

  const children = document.createElement('div');
  children.className = 'jt-children';
  for (const [k, v] of entries) children.appendChild(buildNode(v, isArr ? null : k));

  const footer = document.createElement('div');
  footer.className = 'jt-footer';
  footer.textContent = close;

  toggle.addEventListener('click', () => {
    const opening = children.style.display === 'none';
    toggle.textContent     = opening ? '▾' : '▸';
    children.style.display = opening ? '' : 'none';
    summary.style.display  = opening ? 'none' : 'inline';
    footer.style.display   = opening ? '' : 'none';
  });

  row.append(header, children, footer);
  return row;
}

function buildJsonTree(parsed) {
  const root = document.createElement('div');
  root.appendChild(buildNode(parsed, null));
  return root;
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

let activeTab = 'code';
let responseViewMode = 'formatado';
let responseRawText = '';
let responseParsed = null;

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('active', c.id === `tab-${activeTab}`);
    });
    copyBtn.style.display = activeTab === 'code' ? '' : 'none';
  });
});

langSelect.addEventListener('change', () => {
  selectedLang = langSelect.value;
  if (selectedIndex >= 0) selectRequest(selectedIndex);
});

function applyResponseMode(mode) {
  responseViewMode = mode;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  responseBody.style.display = 'none';
  responseTree.style.display = 'none';

  if (mode === 'raw') {
    responseBody.textContent = responseRawText;
    responseBody.style.display = 'block';
  } else if (mode === 'formatado') {
    responseBody.textContent = responseParsed !== null
      ? JSON.stringify(responseParsed, null, 2)
      : responseRawText;
    responseBody.style.display = 'block';
  } else if (mode === 'arvore') {
    responseTree.innerHTML = '';
    if (responseParsed !== null) {
      responseTree.appendChild(buildJsonTree(responseParsed));
    } else {
      responseTree.textContent = t('notJson');
    }
    responseTree.style.display = 'block';
  }
}

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => applyResponseMode(btn.dataset.mode));
});

copyResponseBtn.addEventListener('click', () => {
  const text = responseParsed !== null && responseViewMode !== 'raw'
    ? JSON.stringify(responseParsed, null, 2)
    : responseRawText;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    copyResponseBtn.textContent = t('copiedResponse');
    setTimeout(() => { copyResponseBtn.textContent = t('copyResponse'); }, 1600);
  });
});

function methodClass(method) {
  const m = method.toLowerCase();
  return ['get', 'post', 'put', 'patch', 'delete'].includes(m) ? `method-${m}` : 'method-other';
}

function renderList() {
  const filter = filterEl.value.toLowerCase();
  listEl.innerHTML = '';

  const visible = allRequests
    .map((entry, i) => ({ entry, i }))
    .filter(({ entry }) => {
      if (filter && !entry.request.url.toLowerCase().includes(filter)) return false;
      if (typeFilter !== 'all' && getResourceType(entry) !== typeFilter) return false;
      return true;
    });

  countEl.textContent = `${visible.length} / ${allRequests.length} req.`;

  for (const { entry, i } of visible) {
    const item = document.createElement('div');
    item.className = 'request-item' + (i === selectedIndex ? ' selected' : '');

    const badge = document.createElement('span');
    badge.className = `method-badge ${methodClass(entry.request.method)}`;
    badge.textContent = entry.request.method;

    const urlSpan = document.createElement('span');
    urlSpan.className = 'request-url';
    try {
      const parsed = new URL(entry.request.url);
      urlSpan.textContent = parsed.pathname + parsed.search;
      urlSpan.title = entry.request.url;
    } catch {
      urlSpan.textContent = entry.request.url;
      urlSpan.title = entry.request.url;
    }

    item.append(badge, urlSpan);
    item.addEventListener('click', () => selectRequest(i));
    listEl.appendChild(item);
  }
}

function statusClass(code) {
  if (code >= 200 && code < 300) return 'status-2xx';
  if (code >= 300 && code < 400) return 'status-3xx';
  if (code >= 400 && code < 500) return 'status-4xx';
  if (code >= 500) return 'status-5xx';
  return 'status-xxx';
}

function renderResponseBody(entry) {
  const res = entry.response;
  const status = res.status;
  const statusText = res.statusText || '';
  const mime = res.content?.mimeType || '';

  const badge = document.createElement('span');
  badge.className = `status-badge ${statusClass(status)}`;
  badge.textContent = String(status);

  const statusTextEl = document.createElement('span');
  statusTextEl.textContent = statusText;

  responseStatus.replaceChildren(badge, statusTextEl);

  if (mime) {
    const mimeEl = document.createElement('span');
    mimeEl.className = 'response-mime';
    mimeEl.textContent = mime;
    responseStatus.appendChild(mimeEl);
  }

  responseRawText = t('loading');
  responseParsed = null;
  applyResponseMode(responseViewMode);

  entry.getContent((body, encoding) => {
    if (!body) {
      responseRawText = t('noContent');
      applyResponseMode(responseViewMode);
      return;
    }
    let text = body;
    if (encoding === 'base64') {
      try { text = atob(body); } catch { text = body; }
    }
    responseRawText = text;
    if (mime.includes('application/json') || mime.includes('+json')) {
      try { responseParsed = JSON.parse(text); } catch { /* not valid JSON */ }
    }
    applyResponseMode(responseViewMode);
  });
}

function selectRequest(i) {
  selectedIndex = i;
  const entry = allRequests[i];
  const { convert, highlight } = converters[selectedLang];

  const code = convert(entry, currentLang);
  const parsed = new DOMParser().parseFromString(highlight(code), 'text/html');
  codeEl.replaceChildren(...Array.from(parsed.body.childNodes));
  codeEl._rawCode = code;

  placeholder.style.display = 'none';
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${activeTab}`);
  });

  renderResponseBody(entry);
  renderList();

  const selected = listEl.querySelector('.selected');
  selected?.scrollIntoView({ block: 'nearest' });
}

clearBtn.addEventListener('click', () => {
  allRequests = [];
  selectedIndex = -1;
  codeEl.innerHTML = '';
  codeEl._rawCode = '';
  responseRawText = '';
  responseParsed = null;
  responseBody.textContent = '';
  responseTree.innerHTML = '';
  responseStatus.innerHTML = '';
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  placeholder.style.display = 'flex';
  renderList();
});

copyBtn.addEventListener('click', () => {
  const code = codeEl._rawCode;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    copyBtn.textContent = t('copiedCode');
    copyBtn.classList.add('success');
    setTimeout(() => {
      copyBtn.textContent = t('copyCode');
      copyBtn.classList.remove('success');
    }, 1800);
  });
});

filterEl.addEventListener('input', renderList);

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    typeFilter = btn.dataset.type;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderList();
  });
});

// ─── Drag-to-resize ──────────────────────────────────────────────────────────

const resizer  = document.getElementById('resizer');
const listWrap = document.getElementById('request-list-wrapper');

resizer.addEventListener('mousedown', e => {
  e.preventDefault();
  resizer.classList.add('dragging');
  const onMove = ev => {
    const rect = document.getElementById('main').getBoundingClientRect();
    const newW = Math.max(140, Math.min(ev.clientX - rect.left, rect.width - 200));
    listWrap.style.width = newW + 'px';
  };
  const onUp = () => {
    resizer.classList.remove('dragging');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
});

// ─── Network listener ────────────────────────────────────────────────────────

const preserveLogEl = document.getElementById('preserve-log');

browser.devtools.network.onRequestFinished.addListener(entry => {
  allRequests.push(entry);
  renderList();
});

browser.devtools.network.onNavigated.addListener(() => {
  if (preserveLogEl.checked) return;
  allRequests = [];
  selectedIndex = -1;
  codeEl.innerHTML = '';
  codeEl._rawCode = '';
  responseRawText = '';
  responseParsed = null;
  responseBody.textContent = '';
  responseTree.innerHTML = '';
  responseStatus.innerHTML = '';
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  placeholder.style.display = 'flex';
  renderList();
});

const uiLangEl = document.getElementById('ui-lang');
uiLangEl.value = currentLang;
uiLangEl.addEventListener('change', () => {
  currentLang = uiLangEl.value;
  applyTranslations();
  if (selectedIndex >= 0) selectRequest(selectedIndex);
  else renderList();
});

applyTranslations();
renderList();
