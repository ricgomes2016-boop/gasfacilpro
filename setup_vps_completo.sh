#!/bin/bash
# ==============================================================================
# SCRIPT DE CONFIGURAÇÃO TOTAL - GASFÁCIL PRO (VPS HOSTINGER)
# ==============================================================================
# Requires a .env file in ~/gasfacilpro with at least:
#   EVOLUTION_API_KEY=<strong random value>
#   POSTGRES_PASSWORD=<strong random value>
# Never commit the .env file to git.
# ==============================================================================

set -e
echo "🚀 Iniciando Configuração do Zero no Hostinger..."

echo "📦 Atualizando pacotes do sistema..."
sudo apt update && sudo apt upgrade -y

if ! command -v docker &> /dev/null; then
    echo "🐳 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker instalado com sucesso."
else
    echo "🐳 Docker já está instalado."
fi

echo "📂 Criando diretórios do projeto..."
mkdir -p ~/gasfacilpro
cd ~/gasfacilpro

if [ ! -f .env ]; then
  echo "❌ Missing ~/gasfacilpro/.env"
  echo "Create it with at least:"
  echo "  EVOLUTION_API_KEY=<strong random value>"
  echo "  POSTGRES_PASSWORD=<strong random value>"
  exit 1
fi

echo "📄 Criando arquivo docker-compose.yml..."
cat <<'EOF' > docker-compose.yml
services:
  evolution-db:
    image: postgres:15-alpine
    container_name: evolution_db
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-evolution}
      POSTGRES_USER: ${POSTGRES_USER:-evolution}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}
    volumes:
      - evolution_db_data:/var/lib/postgresql/data
    restart: always

  evolution-redis:
    image: redis:alpine
    container_name: evolution_redis
    command: redis-server --appendonly yes
    volumes:
      - evolution_redis_data:/data
    restart: always

  evolution-api:
    image: evoapicloud/evolution-api:latest
    container_name: evolution_api
    environment:
      - SERVER_PORT=8000
      - SERVER_URL=${SERVER_URL:-http://localhost:8000}
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY:?EVOLUTION_API_KEY required}
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://${POSTGRES_USER:-evolution}:${POSTGRES_PASSWORD}@evolution-db:5432/${POSTGRES_DB:-evolution}?sslmode=disable
      - DATABASE_SAVE_DATA_INSTANCE=true
      - DATABASE_SAVE_DATA_NEW_MESSAGE=true
      - DATABASE_SAVE_DATA_OLD_MESSAGE=true
      - DATABASE_SAVE_DATA_CHATS=true
      - CACHE_REDIS_ENABLED=true
      - CACHE_REDIS_URI=redis://evolution-redis:6379
      - CACHE_REDIS_PREFIX_KEY=evolution
    ports:
      - "8000:8000"
    depends_on:
      - evolution-db
      - evolution-redis
    restart: always

volumes:
  evolution_db_data:
  evolution_redis_data:
EOF

echo "🛡️ Configurando Firewall..."
sudo apt install ufw -y
sudo ufw allow 22/tcp
sudo ufw allow 8000/tcp
echo "y" | sudo ufw enable
sudo ufw status

echo "🔋 Subindo Evolution API..."
sudo docker compose --env-file .env down -v &> /dev/null || true
sudo docker compose --env-file .env up -d

echo "----------------------------------------------------------------"
echo "✅ CONFIGURAÇÃO CONCLUÍDA!"
echo "----------------------------------------------------------------"
echo "🌐 URL Interna: http://localhost:8000"
echo "🔑 API Key: (lida de ~/gasfacilpro/.env — não impressa por segurança)"
echo "----------------------------------------------------------------"

sudo docker ps
