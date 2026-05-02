## Problema confirmado

A ligação para 0800 590 0492 entrou no GoTo, mas o ramal 1004 está configurado para **encaminhar para o celular +5543999661816** (seu número), em vez de rotear para um provedor de IA externo via SIP. Por isso nenhum webhook (Vapi nem Twilio) foi acionado — a IA nunca teve chance de atender.

Evidências dos prints:
- Print 3 (Detalhes da interação): GoTo discou para `+5543999661816` durante 11s, conectou, falou 29s, desligou normalmente
- Print 2 (Relatório): 2 chamadas hoje — uma atendida no celular, outra caiu no correio
- Print 1 (Atividade): última atualização do ramal 1004 foi às 08:50 (atualização de conta), confirmando que ele é tratado como ramal de usuário, não como tronco SIP de saída

## Decisão necessária

Antes de mexer em qualquer coisa, precisamos decidir **qual provedor de IA** vai atender o 0800. As duas opções têm implicações diferentes no GoTo:

### Opção A — Vapi (mais simples, já temos credencial)
1. **No GoTo**, no ramal 1004:
   - **Remover** o encaminhamento para celular (+5543999661816)
   - **Habilitar registro SIP externo** (a tela que você procurou ontem: "Allow external SIP registration" / "Third-party SIP")
   - Pegar usuário SIP, senha SIP e domínio SIP do 1004
2. **Na Vapi**: criar um "BYO SIP Trunk" apontando para o domínio do GoTo com as credenciais do 1004
3. **Apontar o assistente Vapi** (o que já está criado) para esse trunk
4. Testar ligação para 0800

### Opção B — Twilio Elastic SIP + ElevenLabs (Bia)
1. **No GoTo**, no ramal 1004:
   - Remover encaminhamento para celular
   - Configurar como **SIP Trunk de saída** apontando para `forte-gas.pstn.twilio.com` (seguir o `CONFIG_TWILIO_SIP_FORTEGAS.md`)
2. **No Twilio**: criar Elastic SIP Trunk, autorizar IP do GoTo, apontar Voice URL para `twilio-voice-webhook`
3. Bia (ElevenLabs) já está configurada no `twilio-voice-webhook`
4. Testar ligação para 0800

### Opção C — Atendimento humano + IA como fallback
- Manter o encaminhamento para o celular nas primeiras X tocadas
- Se você não atender, transferir para a IA (Vapi ou Bia)
- Requer configurar **Call Flow** no GoTo (mais complexo)

## Recomendação

**Opção A (Vapi)** é o caminho mais rápido — você já tem assistente Vapi criado e credencial. O bloqueio é exclusivamente o GoTo: precisamos achar onde habilitar o registro SIP externo no ramal 1004 e remover o forward para celular.

## Próximo passo imediato (sem código)

Antes de eu mexer em qualquer arquivo, você precisa entrar no **GoTo Admin → ramal 1004** e:

1. Tirar print de **todas as abas** da tela de edição do ramal 1004 (Geral, Chamadas, Encaminhamento, Voicemail, SIP, Avançado…)
2. Procurar especificamente onde está configurado o número **+5543999661816** como destino — esse é o forward que está sequestrando a chamada
3. Procurar qualquer opção do tipo: "Third-party SIP", "Allow external registration", "BYOD", "SIP credentials"

Com esses prints eu te digo exatamente:
- Onde clicar para **desligar o forward para o celular**
- Onde clicar para **habilitar o registro SIP externo** (e pegar as credenciais para colar na Vapi)

## Observação sobre o código deste projeto

Nada precisa mudar no código agora. As edge functions `vapi-webhook` e `twilio-voice-webhook` estão prontas e funcionais — elas só não estão sendo chamadas porque o GoTo está terminando a chamada no seu celular antes de sair para a internet.
