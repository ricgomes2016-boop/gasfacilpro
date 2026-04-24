## Atualização Meta WhatsApp - Central Gás

### 1. Banco de dados (UPDATE em `integracoes_whatsapp`)
Atualizar o registro da unidade Central Gás:
- `meta_phone_number_id` = `1068574169676609`
- `meta_waba_id` = `1738917314133461`
- `numero_telefone` = `4335241094`
- `status_conexao` = `conectado`

### 2. Secret `META_WHATSAPP_TOKEN`
Substituir pelo novo token (24h) fornecido pelo usuário:
`EAAU1lGElzwwBRRMBxXrZCFgy4KI5BgXVwHXv08B03dac6L42FGkCx0tClPYz8BYJl34qELuiKSv4YqX1xafossEKpYs2Xk4YKEKb2qdfZAi9nzZBZAIXbKIXmggjVZBekpIKjy4XP7WLc2WUkkZB6PqHfeT2BfJDeZBtR4ZB40FsNCDqkm6zlOZBZCWp3cL5wfZAQsVeH61ez6tyMGhvXyC3Tewrv2NX0LKMOYRr60bzBCRfpupTg2ZBcohwXeAmMZCjhZCUbyQKlKtpgLjNCNIfiEaWCmvfSnzSfDrb8FaFA8CkkZD`

### 3. UI: Botão "Abrir WhatsApp Web" 
**Arquivo:** `src/pages/atendimento/CentralAtendimento.tsx`
- Botão verde com ícone `MessageCircle` no header da página
- Comportamento:
  - Desktop → abre `https://web.whatsapp.com` em nova aba
  - Mobile (detectado via `useIsMobile`) → abre `https://wa.me/` (com número do cliente selecionado se houver)
- Justificativa: o número fixo 43 3524-1094 não pode ser cadastrado no app WhatsApp do celular devido restrições da Meta Cloud API; o botão habilita atendimento humano via WhatsApp Web como workaround

### 4. Memória `mem://technical/project-metadata`
Atualizar com novos IDs:
- Phone ID: `1068574169676609` (anteriormente `11210081644...`)
- WABA ID: `1738917314133461`
- Token: 24h (avisar que precisa de System User token para produção)

### ⚠️ Nota importante para o usuário
Token de 24h funciona para teste imediato, mas para produção é necessário gerar token permanente via:
**Meta Business Manager → Configurações → Usuários do Sistema → Criar System User → Gerar Token** com permissões `whatsapp_business_messaging` + `whatsapp_business_management`.