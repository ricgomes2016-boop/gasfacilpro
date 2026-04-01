

## Plano: Adicionar Rota no Mapa à Simulação de Viagem

O componente `RouteMapDialog` já existe e funciona na página de Entregas. Basta reutilizá-lo na página de Simulação.

### Alteração única: `src/pages/transportadora/TranspSimulacao.tsx`

1. **Importar** `RouteMapDialog` e o ícone `Route`
2. **Adicionar estado** `showRouteMap` (boolean)
3. **Adicionar botão** com ícone de mapa ao lado do campo KM (linha 124)
4. **Callback `onConfirm`**: preenche `form.km` com o valor calculado e `form.origem`/`form.destino` com o resumo da rota
5. **Renderizar** `<RouteMapDialog>` no JSX

### Resultado

O campo KM na simulação terá um botão de mapa idêntico ao das Entregas. Ao criar a rota e confirmar, o KM é preenchido automaticamente.

