# Changelog

Todas as mudanças notáveis neste projeto serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e o projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

> Este é o changelog **técnico**. O changelog voltado ao usuário final fica em
> [`apps/erp/public/changelog.json`](apps/erp/public/changelog.json) e é exibido
> dentro do app na seção "Novidades".

---

## [1.1.0] — 2026-06-12

### Adicionado
- **Geração canônica de códigos** (`apps/erp/src/pages/products/codeGenerator.js`):
  fonte única para slug/code via `slugFor` + `buildSkuCode` + `derivePrefix` +
  `buildProductCode`. Usa `product_attribute_defs.values[].slug` como verdade,
  com fallback automático (`defaultSlug`).
- **Endpoint `GET /api/products/next-code?category=X`**: sugere o próximo código
  sequencial com base no prefixo derivado da categoria
  (1 letra ASCII upper + sequencial 3 dígitos).
- **ProductForm**: auto-sugestão de código ao escolher a categoria (modo novo),
  com badge "Auto" e botão para regerar.
- **SkuEditTable** (drawer de edição de produto):
  - Busca textual por cor, tamanho ou código
  - Headers `Cor`, `Tamanho` e `Código` clicáveis para ordenar (asc → desc → reset)
  - Botão "+ Adicionar SKU" com formulário inline e auto-código
  - Ações em massa colapsáveis (preço e estoque mínimo) com confirmação
- **PUT `/api/products/:id`** agora insere SKUs sem `id` (em vez de pular),
  permitindo adicionar SKUs em produtos existentes.
- **Propagação de novos valores de atributo**:
  - `POST /api/product-attributes/:id/impact` (preview read-only)
  - `POST /api/product-attributes/:id/propagate` (criação transacional)
  - `SkuPropagateModal` (UI de revisão por produto, preço editável por SKU)
- **`authFetch` central** (`apps/erp/src/auth/authFetch.js`) com refresh
  automático em 401 e deduplicação de refreshes concorrentes. Migrado:
  `useProducts.js`.
- **Versionamento**: `__APP_VERSION__` e `__APP_BUILD_DATE__` injetados pelo
  Vite, badge de versão no sidebar e seção "Novidades" no header.
- **Cache de categorias**: `invalidateCatsCache()` para o `CategoryDefManager`
  invalidar o cache do `ProductForm` após CRUD de categoria.
- **Ordenação canônica de SKUs**: Cor (alfabética pt-BR) → Tamanho
  (numérico crescente, depois `PP→P→M→G→GG→XG`). Aplicada em
  `SkuGrid`, `SkuEditTable`, `GradePicker`, `StockPanelPage`,
  `ProductDetailPage`, store `ProductDetail.tsx` e `separationSheet.js`.

### Corrigido
- Bug crítico de scope: `attrDefs` referenciado em `ProductForm` mas declarado
  apenas em `SkuEditTable` (ReferenceError → tela branca em `/products`).
- Regex `/^d+$/` → `/^\d+$/` no `ProductDetail.tsx` da store (todos os tamanhos
  numéricos eram tratados como letras).
- `productsTypes.js`: lista de tamanhos com `XGG` → `XG` (alinha com cadastro).

### Operacional
- Cache `Cache-Control: no-cache, no-store, must-revalidate` para `index.html`
  em todos os ERPs (entry point do SPA deve sempre revalidar).

---

## [1.0.0] — 2026-06-10

Marco zero — registro retroativo do estado em produção antes da adoção
de versionamento formal.
