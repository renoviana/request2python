# request2code

Extensão de navegador para DevTools que captura requisições de rede e as converte em snippets de código prontos para executar. Disponível para Firefox e Chrome.

## Instalar

**Firefox** — Mozilla Add-ons Store:
[addons.mozilla.org/pt-BR/firefox/addon/request2code/](https://addons.mozilla.org/pt-BR/firefox/addon/request2code/)

**Chrome** — em breve na Chrome Web Store. Por enquanto, carregue manualmente (veja abaixo).

## Funcionalidades

- Captura todas as requisições HTTP enquanto o DevTools está aberto
- Converte cada requisição em código executável para 5 linguagens:
  - **Python** — biblioteca `requests`
  - **JavaScript** — `fetch` com `async/await`
  - **cURL** — comando de linha
  - **PHP** — funções `curl_*`
  - **Go** — pacote `net/http`
- Trata corretamente todos os tipos de corpo: JSON, form-urlencoded, multipart/form-data, raw
- Separa cookies do header `Cookie` em parâmetro dedicado (Python) ou flag `-b` (cURL)
- Syntax highlighting para todas as linguagens
- Visualização da resposta em três modos: Formatado, Árvore interativa (JSON), Raw
- Filtro por URL e por tipo de recurso (XHR/Fetch, JS, CSS, Img, Doc, Other)
- Resize drag entre os painéis
- Preserve log (mantém requisições ao navegar para outra página)
- Interface em português, inglês e espanhol

## Estrutura do repositório

```
request2code/
├── firefox/             # Extensão para Firefox (MV2, browser.* API)
│   ├── manifest.json
│   ├── devtools.html
│   ├── devtools.js
│   ├── panel.html
│   ├── panel.js
│   ├── lib/
│   │   └── converters.js
│   ├── _locales/
│   └── test/
├── chrome/              # Extensão para Chrome (MV3, chrome.* API)
│   ├── manifest.json
│   ├── devtools.html
│   ├── devtools.js
│   ├── panel.html
│   ├── panel.js
│   └── lib/
│       └── converters.js
└── docs/
    ├── architecture.md
    └── adding-converters.md
```

Cada pasta é self-contained e pode ser empacotada independentemente para submissão às lojas.

## Desenvolvimento

Sem build step, sem bundler, sem dependências de runtime. O código carrega diretamente no navegador.

### Carregar no Firefox (temporário)

```
about:debugging → This Firefox → Load Temporary Add-on → selecionar firefox/manifest.json
```

### Carregar no Chrome (temporário)

```
chrome://extensions → ativar "Modo desenvolvedor" → "Carregar sem compactação" → selecionar a pasta chrome/
```

### Recarregar após mudanças

| Arquivo alterado | O que fazer |
|---|---|
| `panel.js` / `panel.html` | Fechar e reabrir o painel DevTools |
| `manifest.json` / `devtools.js` | Firefox: recarregar em `about:debugging` / Chrome: botão reload em `chrome://extensions` |

### Testes

Os testes cobrem `lib/converters.js` — funções puras sem dependência de browser API.

```bash
npm test
```

Usa Jest. Os arquivos de teste ficam em `firefox/test/` e importam `firefox/lib/converters.js`.

### Sincronizar mudanças entre versões

`lib/converters.js` é duplicado em `firefox/lib/` e `chrome/lib/`. Qualquer mudança nos conversores ou no i18n precisa ser aplicada nos dois arquivos.

A única diferença entre as versões está em:
- `manifest.json` — versão de manifest, browser-specific settings
- `devtools.js` — `browser.*` (Firefox) vs `chrome.*` (Chrome)
- `panel.js` — `browser.devtools.network.*` (Firefox) vs `chrome.devtools.network.*` (Chrome)

### Adicionar uma nova linguagem

Veja [docs/adding-converters.md](docs/adding-converters.md).

### Publicar

**Firefox (AMO):**
```bash
cd firefox
npx web-ext lint
npx web-ext build
```

**Chrome (CWS):**
Compacte a pasta `chrome/` como `.zip` e envie pelo Chrome Developer Dashboard.
