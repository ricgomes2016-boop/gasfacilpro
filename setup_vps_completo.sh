#!/bin/bash
# ==============================================================================
# SCRIPT DE CONFIGURAÇÃO TOTAL - GASFÁCIL PRO (VPS HOSTINGER)
# ==============================================================================
# Este script configura o servidor do zero: Docker, Firewall, e Evolution API.
# Versão: 1.0.0
# ==============================================================================

echo "🚀 Iniciando Configuração do Zero no Hostinger..."

# 1. ATUALIZAÇÃO DO SISTEMA
echo "📦 Atualizando pacotes do sistema..."
sudo apt update && sudo apt upgrade -y

# 2. INSTALAÇÃO DO DOCKER
if ! command -v docker &> /dev/null
then
    echo "🐳 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker instalado com sucesso."
else
    echo "🐳 Docker já está instalado."
fi

# 3. CRIAÇÃO DA ESTRUTURA
echo "📂 Criando diretórios do projeto..."
mkdir -p ~/gasfacilpro
cd ~/gasfacilpro

# 4. CONFIGURAÇÃO DO DOCKER COMPOSE
echo "📄 Criando arquivo docker-compose.yml..."
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
    image: evoapicloud/evolution-api:latest
    container_name: evolution_api
    environment:
      - SERVER_PORT=8000
      - SERVER_URL=http://localhost:8000
      - AUTHENTICATION_TYPE=apikey
      - AUTHENTICATION_API_KEY=gasfacilpro2026
      - DATABASE_ENABLED=true
      - DATABASE_PROVIDER=postgresql
      - DATABASE_CONNECTION_URI=postgresql://evolution:evolution_password@evolution-db:5432/evolution?sslmode=disable
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

# 5. CONFIGURAÇÃO DO FIREWALL (UFW)
echo "🛡️ Configurando Firewall..."
sudo apt install ufw -y
sudo ufw allow 22/tcp
sudo ufw allow 8000/tcp
echo "y" | sudo ufw enable
sudo ufw status

# 6. INICIALIZAÇÃO DOS CONTAINERS
echo "🔋 Subindo Evolution API..."
sudo docker compose down -v &> /dev/null || true
sudo docker compose up -d

# 7. VALIDAÇÃO FINAL
echo "----------------------------------------------------------------"
echo "✅ CONFIGURAÇÃO CONCLUÍDA!"
echo "----------------------------------------------------------------"
echo "🌐 URL Interna: http://localhost:8000"
echo "🔑 API Key: gasfacilpro2026"
echo "----------------------------------------------------------------"
echo "⚠️  Verifique se o IP 187.77.52.241 está acessível via porta 8000."
echo "⚠️  Se houver erro de conexão, verifique o painel da Hostinger (Firewall Externo)."
echo "----------------------------------------------------------------"

sudo docker ps
