Plano para ajustar os cards de /vendas/nova usando as cores do Acesso Rápido do dashboard:

1. Mapear as etapas da venda para as cores do Acesso Rápido
   - Cliente: amarelo/âmbar, igual ao card “Clientes”.
   - Produtos: teal, igual ao card “Estoque”.
   - Pagamento: indigo, igual ao card “Financeiro”.
   - Entregador: rose, igual ao card “Entregas”.
   - Confirmar: emerald, igual ao card “Nova Venda”.

2. Atualizar os tokens visuais do fluxo de venda
   - Ajustar as variáveis CSS `--venda-tone` e `--venda-tone-strong` em `src/index.css` para refletirem as cores Tailwind usadas no `QuickActions.tsx`.
   - Manter a estrutura atual do fluxo, sem refatorar rotas ou lógica de venda.

3. Aplicar a paleta nos cards e atalhos
   - Padronizar `.venda-card`, `.venda-product-shortcut`, `.venda-payment-shortcut` e `.venda-modern-surface` para usarem os mesmos tons do Acesso Rápido.
   - Preservar o estilo moderno com gradientes, sombras e bordas mais nítidas.
   - Garantir que os atalhos de produto e pagamento sigam a cor da etapa onde estão.

4. Ajustar estados visuais
   - Hover, seleção, foco acessível e stepper continuarão usando a cor da etapa.
   - Manter contraste adequado no modo claro e escuro.

Arquivos previstos:
- `src/index.css`
- Consulta/validação visual contra `src/components/dashboard/QuickActions.tsx`

Não haverá alteração de banco de dados nem de regras de negócio.