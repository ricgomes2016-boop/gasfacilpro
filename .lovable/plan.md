

## Plano: Site Institucional Central Gás em `/centralgascp`

### O que será criado

Uma página pública institucional para a **Central Gás** acessível em `/centralgascp`, com design moderno e responsivo.

### Estrutura da página

1. **Header** — Logo/nome "Central Gás", navegação âncora (Sobre, Serviços, Contato)
2. **Hero** — Título chamativo, subtítulo sobre entrega de gás em Cornélio Procópio, botão CTA para WhatsApp
3. **Sobre** — Breve apresentação da empresa
4. **Serviços** — Cards com serviços oferecidos (Gás P13, P45, água, entrega rápida, etc.)
5. **Diferenciais** — Entrega rápida, atendimento 24h, pagamento facilitado
6. **Contato** — Telefone (43 3524-1094), WhatsApp, endereço, horário de funcionamento
7. **Footer** — Copyright e links

### Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/publico/CentralGasCP.tsx` | Criar — página institucional completa |
| `src/App.tsx` | Editar — adicionar rota pública `/centralgascp` |

### Detalhes técnicos

- Página pública, sem autenticação necessária
- Rota adicionada junto às demais rotas públicas no App.tsx
- Design standalone (não usa MainLayout/TransportadoraLayout)
- Cores em tons de azul/laranja alinhadas à identidade visual de gás
- Totalmente responsivo (mobile-first)
- Botão WhatsApp flutuante com link direto para o número 43 3524-1094

