

## Historico de Percurso no Mapa Operacional

### Problema
O `MapaOperacional.tsx` ja tem `showPercurso` no state e passa as props `percurso` e `showPercurso` ao `DeliveryRoutesMap`, porem `percurso` esta sempre `[]` -- nunca busca dados. A logica completa ja existe no `MapaEntregadores.tsx` (linhas 98-129).

### Plano

**1. Adicionar fetch de percurso em `MapaOperacional.tsx`**
- Importar `PercursoPonto` de `DeliveryRoutesMap`
- Adicionar state `percurso` (useState)
- Copiar o useEffect de fetch do `MapaEntregadores.tsx` que consulta `rotas` (rota ativa do entregador) e depois `rota_historico` (pontos GPS)
- Ativar `showPercurso` automaticamente quando um entregador e selecionado
- Passar o state `percurso` real no lugar de `[]`

**2. Adicionar botao "Ver Percurso" no painel lateral de entregadores**
- Ao clicar em um entregador, mostrar um botao/toggle "Trajeto do dia" com icone `Route`
- Toggle alterna `showPercurso` e dispara o fetch

**3. Nenhuma alteracao de banco necessaria**
- As tabelas `rotas` e `rota_historico` ja existem com as colunas corretas (latitude, longitude, timestamp)
- O componente `DeliveryRoutesMap` ja renderiza Polyline e marcadores de percurso

### Arquivos editados
| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/operacional/MapaOperacional.tsx` | Adicionar state `percurso`, useEffect de fetch, botao toggle, passar props reais |

### Resultado
Ao selecionar um entregador no mapa operacional e ativar "Trajeto do dia", o mapa mostrara a linha do percurso completo com pontos numerados e horarios, usando os dados reais de `rota_historico`.

