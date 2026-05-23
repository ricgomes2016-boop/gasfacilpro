#!/bin/bash
# SETUP PROATIVO - EVOLUTION API HOSTINGER
# Requires .env file with: EVOLUTION_API_KEY, POSTGRES_PASSWORD (and optionally POSTGRES_USER/POSTGRES_DB)

set -e

if [ ! -f .env ]; then
  echo "❌ Missing .env file. Create one with EVOLUTION_API_KEY and POSTGRES_PASSWORD."
  echo "   Example template:"
  echo "     EVOLUTION_API_KEY=change-me-strong-random-value"
  echo "     POSTGRES_PASSWORD=change-me-strong-random-value"
  exit 1
fi

echo "🚀 Iniciando Configuração Proativa na Hostinger..."

if ! command -v cloudflared &> /dev/null; then
    echo "📦 Instalando Cloudflared..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker (via script oficial)..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

echo "🧹 Limpando processos e containers antigos..."
sudo fuser -k 8000/tcp &> /dev/null || true
sudo docker compose down &> /dev/null || true

echo "🔋 Iniciando Evolution API + Database + Redis..."
sudo docker compose --env-file .env up -d

echo "----------------------------------------------------------------"
echo "🌐 TÚNEL CLOUDFLARE INICIADO"
echo "----------------------------------------------------------------"
cloudflared tunnel --url http://localhost:8000 2>&1 | grep --line-buffered trycloudflare.com
