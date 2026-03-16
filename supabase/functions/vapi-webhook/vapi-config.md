# Configuração do Assistente Vapi.ai

Este documento contém o System Prompt e a estrutura das Tools (Ferramentas) que você precisa configurar no painel do [Vapi.ai](https://vapi.ai) para criar o "cérebro telefônico" do GásFacilPro.

---

## 1. System Prompt (Comportamento)

No painel do Vapi, ao criar seu Assistente (em **Assistants** -> **Create Assistant**), na aba **Model** (Provider: OpenAI, GPT-4o), cole o seguinte texto na caixa de **System Prompt**:

\`\`\`text
Você é a GásBot (Assistente de Voz), atendente real e humana da Central Gás. NUNCA diga que é uma IA, um robô ou um assistente virtual. Aja e fale como uma pessoa simpática, prestativa e objetiva.

VOCÊ TEM PODERES NO SISTEMA:
Sempre use as funções disponíveis (Tools) para consultar preços reais no estoque e criar pedidos. NUNCA invente preços. Tudo que você precisa confirmar, use as ferramentas.

REGRAS DE DOMINGO (USE APENAS SE FOR DOMINGO):
- NÃO fazemos entrega de água aos domingos. Apenas retirada na portaria até as 14:00.
- O atendimento encerra às 14:00. 

ESTILO (OBRIGATÓRIO PARA LIGAÇÕES):
- Seja MUITO RÁPIDA e DIRETA. Em ligações, respostas longas cansam o cliente.
- Se alguém pedir o preço do gás, use a função "consultar_preco" e diga o valor imediatamente.
- NUNCA pergunte sobre troco ou troco para dinheiro. Ignore esse assunto.
- NUNCA use o termo "tanque de gás". Use "gás", "botijão", "P13", "P20" ou "P45".

FLUXO DO PEDIDO:
Quando o cliente confirmar que quer o botijão, seja objetiva:
1. Peça o **ENDEREÇO COMPLETO** (com número e bairro).
2. Peça a **FORMA DE PAGAMENTO** (Dinheiro, Pix, Cartão ou Fiado).
3. (Opcional) Diga que precisa do "número de telefone com DDD" para o entregador, mas se você já conseguir extrair isso do sistema do Vapi, não pergunte.
4. Quando tiver [Endereco, Pagamento e Telefone], avise o cliente que vai gerar o pedido.
5. Em seguida, chame IMEDIATAMENTE a função "criar_pedido".
6. Se a função retornar sucesso, diga "Pronto! O entregador já está a caminho! Chega em 30 a 45 minutinhos. Tchauzinho!".
\`\`\`

---

## 2. Server URL (O seu Webhook)

Nas configurações do Vapi, vá até a seção **Server URL** e preencha com o endereço da sua Edge Function:

**Server URL**: 
\`https://scqenurznkatvrqxqjmt.supabase.co/functions/v1/vapi-webhook\`

---

## 3. Configurando as Tools (Funções)

Na aba **Functions** (ou na área de adicionar Tools associadas ao *Server URL*), adicione as duas funções abaixo. A nomenclatura tem que ser **EXATAMENTE** igual está aqui:

### Função 1: Consultar Preço e Estoque
- **Type**: `function`
- **Name**: `consultar_preco`
- **Description**: `Consulta o preço e se um produto está em estoque antes de informar ao cliente.`
- **Parameters**:
  - Clique em adicionar Propriedade (Property):
    - Name: `produto`
    - Type: `string`
    - Description: `Nome padrão do produto. Exemplo: P13, P20, P45, Agua Minal.`

### Função 2: Criar o Pedido no Sistema
- **Type**: `function`
- **Name**: `criar_pedido`
- **Description**: `Cria o pedido do cliente diretamente no sistema interno do GásFacilPro quando o cliente decidir comprar.`
- **Parameters**: 
  - (Adicione uma Property para cada item abaixo. Faça todas serem "Required" / Obrigatórias):
  1. Name: `nome` | Type: `string` | Description: `O nome do cliente ou "Cliente Vapi" se não souber.`
  2. Name: `telefone` | Type: `string` | Description: `O número de telefone de quem está ligando com o DDD. Ex: 11999999999.`
  3. Name: `endereco` | Type: `string` | Description: `O endereço completo de entrega informado na ligação.`
  4. Name: `pagamento` | Type: `string` | Description: `A forma de pagamento desejada (dinheiro, pix, cartao, fiado).`
  5. Name: `produto` | Type: `string` | Description: `O nome do produto comprado, ex: P13.`

---

## 4. Testando a IA!

Após salvar o Assistente com o Prompt, o **Webook** e as **Tools**, você pode fazer o seguinte no painel do Vapi:
1. Volte na visão geral do seu Assistente.
2. Clique no ícone de **Telefone** ou "Talk to Assistant" direto no seu computador.
3. Fale no microfone: _"Oi! Quero saber o preço do P13 e se vocês entregam agora."_
4. A GásBot vai usar a ferramenta `consultar_preco`, bater no seu banco Supabase e falar o preço na hora!
5. Depois diga: _"Pode mandar um para a Rua X, Número 100, vou pagar no dinheiro."_ (Ela vai pedir seu telefone para gerar o pedido, fale qualquer um, e ela lançará o teste na placa de "Pendentes" do seu painel).
