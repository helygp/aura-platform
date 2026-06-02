#!/bin/bash
set -e

echo "=== Configurando Git para Aura Platform ==="

# 1. Instalar git
echo "[1/6] Instalando git..."
apt-get update -qq && apt-get install -y git -qq
echo "      git $(git --version)"

# 2. Configurar identidade
echo "[2/6] Configurando identidade..."
git config --global user.email "hely@aoop.com.br"
git config --global user.name "Hely Pasqual"
git config --global init.defaultBranch main
git config --global credential.helper store

# 3. Inicializar repo
echo "[3/6] Inicializando repositório..."
cd /projetos/aura-platform
git init
git remote add origin https://github.com/helygp/aura-platform.git 2>/dev/null || \
  git remote set-url origin https://github.com/helygp/aura-platform.git

# 4. Primeiro commit
echo "[4/6] Criando primeiro commit..."
git add .
git commit -m "feat: estado inicial — sprints 1-6, 3 tenants em producao

- ERP React + Vite (produtos, estoque, pedidos, clientes, WhatsApp)
- API Node.js + Express multi-tenant isolado por banco
- Loja B2B Next.js 14
- Provision-agent para novos tenants automatico
- 6 relatorios com exportacao PDF/CSV
- Importacao de produtos via Excel/CSV
- MCPs nativos (manager, store, connect)
- Ambiente staging configurado
- Infra: Docker + Traefik + Lets Encrypt"

# 5. Push para o GitHub
echo ""
echo "[5/6] Push para o GitHub..."
echo "      Quando pedir senha, use seu Personal Access Token."
echo "      GitHub → Settings → Developer Settings → Tokens (classic) → Generate"
echo ""
git push -u origin main

# 6. Criar branch staging
echo "[6/6] Criando branch staging..."
git checkout -b staging
git push -u origin staging

echo ""
echo "============================================"
echo " Git configurado com sucesso!"
echo ""
echo " Branches:"
echo "   main    → producao"
echo "   staging → homologacao (staging.aurabr.app)"
echo ""
echo " Proximo passo — chave SSH para deploy automatico:"
echo "   ssh-keygen -t ed25519 -C 'github-deploy' -f ~/.ssh/deploy_key -N ''"
echo "   cat ~/.ssh/deploy_key.pub   # adicionar no GitHub como Deploy Key"
echo "   cat ~/.ssh/deploy_key       # adicionar no GitHub Secrets como SSH_PRIVATE_KEY"
echo "============================================"
