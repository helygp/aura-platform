# Aura Platform — Runbook

Guia operacional para mudanças, deploys e rollback.

Esse documento responde 3 perguntas:

1. **Onde meu commit cai?** (slug, master, ou mixed)
2. **Como sei que está seguro?** (Guardrails + classificação automática)
3. **Como volto se quebrar?** (rollback)

---

## 1. Classificação automática de mudanças

Todo commit/PR é classificado pelo CI (workflow Guardrails) em uma das categorias abaixo. O resultado aparece nos logs do GitHub Actions e também na notificação WhatsApp quando vai pra produção.

### 🟢 `slug-only`

Toca em arquivos consumidos pelos tenants individuais:

- `apps/erp/**` — ERP de cada slug
- `apps/store/**` — loja B2B de cada slug
- `services/api/src/routes/*.js` — rotas API tenant (exceto `master/`)
- `services/api/src/routes/store/**` — rotas API da loja

**Fluxo:**
1. Commit em `staging`
2. CI roda Guardrails + Deploy (em ~3 min)
3. Testar em **https://staging.aurabr.app** (e loja, ERP, etc)
4. Aprovado? → merge `staging → main`
5. Deploy automático em todos os tenants (`fastmalhas`, `acme`, ...)

**Risco baixo.** Existe rede de proteção (staging).

### 🔴 `master-only`

Toca SÓ no painel admin:

- `apps/master/**`
- `services/api/src/routes/master/**`

**⚠️ Não existe staging de master.** Merge em `main` vai direto pra `master.aurabr.app`.

**Antes de mergear:**
- [ ] Testou local? (`cd apps/master && npm run dev`)
- [ ] Conferiu que o `aura_master` vai ser feito backup automaticamente? (sim, é automático no `deploy.sh`)
- [ ] Sabe como fazer rollback? (ver seção 3 abaixo)

O CI emite um `::warning::` visível no GitHub Actions UI e a notificação WhatsApp inclui `⚠️ Tipo: master-only`.

### 🟠 `mixed`

Mesmo commit toca SLUG E MASTER ao mesmo tempo.

**Recomendação:** dividir em 2 PRs separados (1 só slug, 1 só master). Cada parte segue seu fluxo correto.

Se não der pra dividir, tratar como `master-only` (atenção redobrada).

### 🟡 `infra-only`

CI/CD, Dockerfiles, migrations Prisma, packages shared.

- `.github/**`
- `deploy.sh`
- `Dockerfile*`
- `services/api/prisma/**`
- `packages/**`

Tem staging — testar primeiro lá.

### ⚪ `unclassified`

Apenas docs, configs, README. Risco mínimo.

---

## 2. Guardrails (CI checks que bloqueiam bugs antes do deploy)

Todo push/PR roda 5 checks automáticos:

| Check | O que detecta |
|---|---|
| `no-empty-files` | Arquivos com `size=0` fora da whitelist (.gitkeep etc) |
| `valid-json` | Sintaxe JSON inválida em qualquer `.json` |
| `valid-bash` | Sintaxe bash inválida em `deploy.sh` e `.github/scripts/*.sh` |
| `imports-resolve` | Imports JS/JSX que referenciam exports inexistentes |
| `classify-changes` | Categoria do commit (slug/master/mixed/etc) |

Os 5 são agregados pelo job `Guardrails Summary`. Se algum falhar, o run fica vermelho.

Para configurar como **required check** (bloquear merge se falhar):
- GitHub Settings → Branches → Protection rule para `main` e `staging`
- Marcar "Require status checks to pass before merging"
- Selecionar `Guardrails Summary`

---

## 3. Rollback

### 3.1. Rollback de slug (ERP / loja / API tenant)

```bash
# 1. Reverter o commit em main
git revert <sha-do-commit-ruim>
git push origin main

# 2. CI faz deploy automático com a versão anterior (~3 min)
# 3. Acompanhar pelo WhatsApp ou GitHub Actions
```

### 3.2. Rollback de master (painel admin)

**Caso 1 — só código mudou (sem migration):**

```bash
git revert <sha-do-commit-ruim>
git push origin main
# Aguardar deploy automático (~3 min)
```

**Caso 2 — schema ou dados do `aura_master` mudaram:**

O `deploy.sh` faz backup automático antes de todo deploy em main.

```bash
# 1. Listar backups disponíveis (últimos 30 dias)
ls -lt /var/backups/aura_master/

# 2. Reverter código
git revert <sha-do-commit-ruim>
git push origin main

# 3. Restaurar banco (após o deploy do código terminar)
cat /var/backups/aura_master/<TIMESTAMP>.sql | \
  docker exec -i supabase-db psql -U postgres aura_master
```

**Importante:** se for restaurar o banco, considerar o tempo entre o backup e agora. Tudo que foi escrito no master nesse intervalo será **perdido**. Geralmente o intervalo é de minutos (backup é feito imediatamente antes do deploy), então OK.

### 3.3. Rollback de container (recuperar versão anterior do Docker)

Se o problema é a imagem nova:

```bash
# Ver imagens disponíveis
docker images | grep api-aura

# Recriar container com tag específica (substituindo aura-api:latest)
# Editar deploy.sh temporariamente ou usar docker run direto.
# Detalhes específicos: olhar o último deploy verde no GitHub Actions.
```

---

## 4. Estrutura do projeto (referência rápida)

### Apps frontend
| Path | URL produção | URL staging | Branch usado |
|---|---|---|---|
| `apps/erp/` | `{slug}.aurabr.app` | `staging.aurabr.app` | `main` / `staging` |
| `apps/store/` | `loja.{slug}.aurabr.app` | `loja.staging.aurabr.app` | `main` / `staging` |
| `apps/master/` | `master.aurabr.app` | _(não tem)_ | `main` |
| `apps/landing/` | _(repo separado)_ | — | — |

### API (`services/api/`)
| Path | Quem consome | Tem staging? |
|---|---|---|
| `src/routes/*.js` (raiz) | ERP de cada slug | ✅ via `api.staging.aurabr.app` |
| `src/routes/store/` | Loja de cada slug | ✅ |
| `src/routes/master/` | Painel admin (`master-panel`) | ❌ |

### Tenants ativos
- `fastmalhas` — **referência de produção** (não tocar sem extrema cautela)
- `acme` — tenant secundário
- `staging` — tenant especial, recebe builds de `staging`

### CI/CD
- `.github/workflows/deploy.yml` — deploy em staging/main
- `.github/workflows/guardrails.yml` — checks de qualidade
- `.github/workflows/drift-check-staging.yml` — alerta drift main vs staging
- `.github/scripts/classify-changes.sh` — classificador compartilhado

---

## 5. Contatos & Recursos

- **VPS:** `srv885928.hstgr.cloud` / `31.97.151.162`
- **Code-server:** https://code.aurabr.app
- **Master panel:** https://master.aurabr.app (basic auth)
- **Backups DB master:** `/var/backups/aura_master/` (retenção 30 dias)
- **Logs deploy:** `/tmp/deploy-{branch}.log`
- **Notificações WhatsApp:** `/home/helygp/projetos/.deploy-notify.env`
- **CI runner:** container `aura-runner` (self-hosted, label `aura-vps`)
