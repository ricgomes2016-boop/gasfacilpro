

## Plano: Canal de venda obrigatório no app do entregador

### Problema
1. O default do canal é `"entregador"` (linha 119), que não existe na lista de canais disponíveis
2. O botão "Finalizar Venda" (linha 791) não verifica se o canal foi selecionado — permite venda sem canal

### Alterações

**Arquivo: `src/pages/entregador/EntregadorNovaVenda.tsx`**

1. **Default vazio** — Trocar `useState("entregador")` para `useState("")` (linha 119)
2. **Validação no botão** — Adicionar `!canalVenda` na condição de `disabled` do botão Finalizar (linha 791)
3. **Placeholder no Select** — Adicionar placeholder "Selecione o canal" no SelectValue para indicar que é obrigatório
4. **Validação no submit** — Adicionar check no `finalizarVenda` para bloquear se `canalVenda` estiver vazio, com toast de erro

### Resultado
- Todos os canais da empresa aparecem (já funciona)
- O entregador é obrigado a selecionar um canal antes de finalizar
- Feedback visual claro quando o canal não foi selecionado

