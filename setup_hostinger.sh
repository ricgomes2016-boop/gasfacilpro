#!/bin/bash
# SETUP PROATIVO - EVOLUTION API HOSTINGER

echo "🚀 Iniciando Configuração Proativa na Hostinger..."

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
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# 3. Limpeza Proativa
echo "🧹 Limpando processos e containers antigos..."
sudo fuser -k 8000/tcp &> /dev/null || true
sudo docker compose down &> /dev/null || true

# 4. Iniciar Evolution API via Docker Compose
echo "🔋 Iniciando Evolution API + Database + Redis..."
# Se o arquivo docker-compose.yml não existir, cria um básico
if [ ! -f "docker-compose.yml" ]; then
cat <<EOF > docker-compose.yml
services:
  evolution-db:
    image: postgres:15-alpine
    container_name: evolution_db
    environment:
      POSTGRES_DB: evolution
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: evolution_password
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
    image: atendimentos/evolution-api:latest
    container_name: evolution_api
    environment:
      - SERVER_PORT=8000
      - SERVER_URL=http://localhost:8000
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=gasfacilpro2026
      - DATABASE_ENABLED=true
      - DATABASE_CONNECTION_URI=postgresql://evolution:evolution_password@evolution-db:5432/evolution?sslmode=disable
      - DATABASE_SAVE_DATA_INSTANCE=true
      - DATABASE_SAVE_DATA_NEW_MESSAGE=true
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
fi

sudo docker compose up -d

# 5. Configuração do Túnel (Modo Rápido)
echo "----------------------------------------------------------------"
echo "🌐 TÚNEL CLOUDFLARE INICIADO"
echo "----------------------------------------------------------------"
echo "⚠️  ATENÇÃO: Use a URL abaixo (https://...trycloudflare.com)"
echo "⚠️  NÃO use o IP no navegador, pois o firewall pode bloquear."
echo "----------------------------------------------------------------"
echo ""

cloudflared tunnel --url http://localhost:8000 2>&1 | grep --line-buffered trycloudflare.com
