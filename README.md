# Aura Platform

SaaS white-label multi-tenant — ERP + E-commerce B2B + WhatsApp + MCPs nativos.

## Stack
- **Frontend:** React + Vite (ERP), Next.js 14 (Loja B2B)
- **Backend:** Node.js + Express
- **Banco:** PostgreSQL isolado por tenant
- **Infra:** Docker + Traefik + Let's Encrypt na VPS

## Ambientes

| Ambiente | Branch | URL |
|---|---|---|
| Produção | `main` | `[slug].aurabr.app` |
| Staging | `staging` | `staging.aurabr.app` |

## Tenants em produção
- **Acme:** https://acme.aurabr.app
- **Forroplastic:** https://forroplastic.aurabr.app
- **Fast Malhas:** https://fastmalhas.aurabr.app
- **Master:** https://master.aurabr.app

## Deploy

```bash
# Staging (automático via GitHub Actions ao push no branch staging)
git push origin staging

# Produção (automático via GitHub Actions ao push no branch main)
git checkout main && git merge staging && git push origin main
```

## Desenvolvimento local com Claude Code

```bash
git checkout staging
claude
# Descreva a tarefa em português
# Claude Code edita os arquivos
git add . && git commit -m "feat: descrição" && git push origin staging
```
