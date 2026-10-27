# Atalho "Conferência" para instalar no celular

## Objetivo
Quando o conferente abrir `app.gasfacilpro.com.br/estoque/conferencia` e tocar em "Instalar app" / "Adicionar à tela inicial", o ícone criado deve abrir direto na Conferência — nunca no Dashboard. O app do sistema (ERP) continua instalando normalmente para quem usa o menu.

## O que muda para o usuário
- Novo app separado: **"Conferência Gás Fácil"**, com ícone próprio na tela inicial.
- Ao abrir o ícone: vai direto para a tela de login/contagem da conferência.
- Aparece uma faixa discreta no topo da tela de conferência no celular: "Instale o atalho da Conferência" com botão **Instalar** (Android/Chrome) ou instrução "Compartilhar → Adicionar à Tela de Início" (iPhone).
- Conferentes que já instalaram e caem no Dashboard precisam **remover o ícone antigo e instalar de novo** pela página `/estoque/conferencia` (o celular guarda o endereço inicial no momento da instalação).

## Detalhes técnicos
- Criar `public/conferencia.webmanifest`: `id: "/estoque/conferencia"`, `start_url: "/estoque/conferencia"`, `scope: "/estoque/conferencia"`, `name: "Conferência Gás Fácil"`, `short_name: "Conferência"`, `display: "standalone"`, ícones existentes 192/512.
- Hook pequeno `useConferenciaManifest` usado em `ConferenciaPortal.tsx` e `ConferenciaEstoque.tsx` (somente quando a rota é `/estoque/conferencia`): troca o `href` do `<link rel="manifest">` para `/conferencia.webmanifest` e ajusta `apple-mobile-web-app-title` = "Conferência"; restaura os valores originais ao sair da rota.
- Componente `InstalarConferenciaBanner`: captura `beforeinstallprompt` para o botão Instalar; no iOS mostra a instrução; oculto quando já está em modo standalone ou após fechar (lembra em localStorage).
- Sem alterar App.tsx, rotas, ProtectedRoute nem o service worker/manifest do ERP.
- Validar com Playwright que em `/estoque/conferencia` o manifest ativo é o da conferência com `start_url` correto, e em `/` continua o do ERP.
