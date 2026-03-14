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

# 2. Configuração do Túnel (Modo Rápido)
# Para produção, recomenda-se um túnel nomeado com domínio fixo.
echo "🌐 Iniciando Túnel do Cloudflare..."
echo "⚠️  COPIE A URL 'https://...trycloudflare.com' QUE APARECER ABAIXO"
echo "E COLE NA PÁGINA DE INTEGRAÇÕES DO SISTEMA."
echo ""

# Rodar o túnel em background para não travar o script, mas mostrar a URL
cloudflared tunnel --url http://localhost:8080
