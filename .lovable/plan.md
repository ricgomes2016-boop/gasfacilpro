Diagnóstico encontrado:

- A chamada agora chega no Vonage e no webhook da Lovable Cloud. Isso confirma que o número `+55 11 5283-5921` está recebendo a ligação.
- O erro acontece no repasse do Vonage para a Vapi: os logs mostram `sip_code: 480`, `detail: unavailable`, `status: unanswered` para `sip:vonage-fortegas@sip.vapi.ai`.
- A configuração atual retorna um NCCO conectando diretamente por SIP e adiciona `username/password`, mas a Vapi continua rejeitando ou não disponibilizando esse endpoint SIP.
- A API Vapi disponível no ambiente está retornando `403 error code: 1010` para consultas diretas, então no modo atual não consigo “garantir” via alteração remota na Vapi sem ajustar credencial/permissão ou usar uma rota alternativa.

Plano para resolver:

1. Corrigir o webhook Vonage para resposta mais robusta
   - Atualizar `supabase/functions/vonage-voice-webhook/index.ts` para:
     - Logar o NCCO retornado, sem expor senha.
     - Incluir `eventUrl` no próprio `connect`, para captar eventos específicos do leg SIP.
     - Testar variações de SIP aceitas pela Vapi: com `sip:...@sip.vapi.ai`, e se necessário `sips:`/URI alternativo conforme documentação e retorno real.
     - Remover senha hardcoded do código e exigir secret (`VAPI_SIP_USERNAME`/`VAPI_SIP_PASSWORD`) ou permitir modo sem autenticação se a Vapi estiver configurada para aceitar INVITE sem digest.

2. Criar/ajustar uma função de diagnóstico Vapi/Vonage
   - Criar ou ajustar uma função temporária/administrativa para consultar:
     - Aplicação e número no Vonage.
     - Configuração dos phone numbers/assistants na Vapi.
     - Últimas chamadas e `endedReason`.
   - Essa função retornará status estruturado sem vazar credenciais.
   - Se a chave Vapi atual continuar dando `403/1010`, sinalizar claramente que a chave do projeto não tem permissão para administrar Vapi, e será necessário atualizar o secret `VAPI_API_KEY` com uma chave privada válida.

3. Preferir a integração nativa Vonage da Vapi se a chave permitir
   - Em vez de bridge manual Vonage → SIP, configurar a Vapi para importar/gerenciar o número Vonage diretamente:
     - Provider: `vonage`.
     - Número: `551152835921`.
     - Vincular ao assistant da Bia.
     - Configurar server webhook para `vapi-webhook`.
   - Essa rota é mais confiável que NCCO manual porque o próprio Vapi gerencia o endpoint de answer/status.

4. Alternativa de fallback se Vapi não liberar administração
   - Manter o número Vonage apontando para nosso webhook.
   - Trocar o NCCO temporariamente para uma mensagem de teste (`talk`) antes do `connect`, por exemplo “Bia recebeu sua ligação, estou conectando”, para confirmar áudio Vonage.
   - Se o áudio tocar e depois cair ocupado, fica 100% isolado que o problema é a entrada SIP/Vapi, não o número brasileiro nem o webhook.

5. Deploy e teste em produção
   - Publicar a função `vonage-voice-webhook`.
   - Fazer uma chamada de teste para `041 11 5283 5921`.
   - Conferir logs em tempo real:
     - Vonage deve registrar `started/ringing`.
     - Vapi deve registrar criação de call ou webhook em `vapi-webhook`.
     - Se ainda houver `480`, capturar o detalhe exato para troca final da configuração SIP/credential.

Resultado esperado:

- A chamada deixa de cair como ocupada.
- A Bia atende o número `+55 11 5283-5921`.
- Se a limitação for de permissão da conta/chave Vapi, o app passará a mostrar um diagnóstico claro em vez de tentativa silenciosa.