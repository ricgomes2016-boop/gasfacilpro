# DF-e sem API externa: agente local + importação manual

Objetivo: consultar e baixar DF-e (Distribuição por NSU e download por chave) sem provedor pago e sem VPS. Manifestação fica fora do escopo.

## Como funciona

A SEFAZ exige mTLS com TLS 1.2 e HTTP/1.1, o que o runtime das funções do backend não conclui. A única saída sem serviço externo é o certificado A1 falar com a SEFAZ a partir de uma máquina do próprio cliente — o PC do escritório.

```text
Navegador (ERP)  --http://127.0.0.1:8787-->  Agente local (Node, A1 no disco)  --mTLS-->  SEFAZ
       |                                                   XMLs brutos
       +---- funcao "dfe-ingerir" (valida, parseia, grava com RLS) ---> banco
```

O agente nunca grava no banco e nunca envia o certificado para lugar nenhum: ele só devolve os XMLs para a aba do ERP, que os envia ao backend para validação e persistência multi-tenant. Se o agente não estiver ligado, a tela cai para importação manual de XML/chave, sem bloquear o trabalho.

## Entregas

### 1. Agente local (reaproveita o `fiscal-bridge` já pronto)
- Novo modo "local": lê o `.pfx` e a senha de um arquivo de configuração no próprio PC (em vez de baixar do cofre), sem exigir chaves de serviço.
- Escuta em `127.0.0.1:8787` e só aceita origens do ERP (CORS restrito aos domínios do projeto) mais um token de pareamento gerado na primeira execução.
- Endpoints usados: `GET /health`, `POST /dfe/distribuicao` (por NSU), `POST /dfe/consulta-chave`.
- Rotas de manifestação continuam existindo no código, mas não são chamadas pela UI.
- Empacotamento: script `iniciar-agente.bat` + `README` de instalação (Node 20 ou Docker), com instruções de inicialização automática no Windows.

### 2. Backend: nova função `dfe-ingerir`
- Recebe `{ unidadeId, documentos: [{ nsu, schema, xml }], ultimoNSU, maxNSU }`.
- Reusa `autorizarUnidade`, `parseDfeDocumento` e `deveAtualizarDocumento` (mesma lógica de `dfe-sincronizar`), grava em `dfe_documentos` e atualiza `dfe_nsu_estado`.
- Confere que o CNPJ do destinatário no XML bate com o CNPJ da unidade antes de gravar.
- `dfe-sincronizar` e `baixar-nfe-chave` permanecem: se `FISCAL_BRIDGE_URL` existir, continuam funcionando; senão respondem `bridge_nao_configurado`, e a UI usa o agente local.

### 3. Tela DF-e Recebidos
- Detecção do agente no carregamento (`/health` com timeout curto) e selo de status: "Agente local conectado" / "Agente desligado".
- Botão "Sincronizar" passa a: chamar o agente por lotes de NSU → enviar XMLs para `dfe-ingerir` → recarregar a lista.
- Sem agente: botão vira "Importar XML" (upload de arquivo) e mensagem explicando como ligar o agente, com link para as instruções.
- Estado do pareamento (URL e token do agente) guardado por navegador, configurável num diálogo "Configurar agente local".

### 4. Nova Compra por chave
- Mesmo padrão: tenta o agente local; se ausente, mantém o fluxo atual de colar a chave e anexar o XML manualmente.

## Detalhes técnicos

- Navegadores tratam `http://127.0.0.1` como origem segura, então a página HTTPS do ERP pode chamar o agente sem bloqueio de conteúdo misto; é necessário CORS com `Access-Control-Allow-Origin` explícito no agente.
- O token de pareamento vai no cabeçalho `X-Agente-Token`; a assinatura HMAC atual do bridge é mantida para o modo servidor e desativada no modo local.
- Logs do agente continuam sanitizados (sem PEM, senha ou XML completo).
- Limite de 5 lotes por sincronização, como já ocorre hoje, para respeitar o consumo da SEFAZ.
- Nada de dados reais alterados, sem migrações destrutivas: apenas a nova função e as colunas já existentes.
