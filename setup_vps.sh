#!/bin/bash

# Script de Ajuste Automático VPS - GasFácil Pro
# Este script configura o Cloudflare Tunnel e garante que a Evolution API esteja pronta.

echo "🚀 Iniciando configuração automática da VPS..."

# 1. Instalação do Cloudflared (se não houver)
if ! command -v cloudflared &> /dev/null
then
    echo "📦 Instalando Cloudflared..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

# 2. Instalação do Docker (se não houver)
if ! command -v docker &> /dev/null
then
    echo "🐳 Instalando Docker (via script oficial)..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
fi

# 3. Iniciar Evolution API via Docker Compose
echo "🔋 Iniciando Evolution API + Database + Redis..."
# Liberar porta 8080 se estiver ocupada (proativo)
sudo fuser -k 8080/tcp &> /dev/null || true
sudo docker compose up -d

# 4. Configuração do Túnel (Modo Rápido)
echo "🌐 Iniciando Túnel do Cloudflare..."
echo "----------------------------------------------------------------"
echo "⚠️  ATENÇÃO: NÃO USE O IP NO NAVEGADOR (Pode estar bloqueado)"
echo "⚠️  COPIE A URL ABAIXO (https://...trycloudflare.com)"
echo "----------------------------------------------------------------"
echo ""

# Rodar o túnel e mostrar a saída filtrada para a URL
cloudflared tunnel --url http://localhost:8080 2>&1 | grep --line-buffered trycloudflare.com
