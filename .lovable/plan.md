# Correção do Acerto Diário do Entregador

## 1. Melhorias na tabela de entregas (`src/pages/caixa/AcertoEntregador.tsx`)

**Nova coluna "Nº Pedido"** (primeira coluna), exibindo `numero_sequencial` do pedido (formato `#1234`). Quando ausente, mostra os últimos 6 caracteres do `id`.

**Coluna "Data" no lugar de "Hora"**: passa a mostrar a data real do pedido (`data_entrega` formatada `dd/MM/yyyy`). Se o pedido ainda não tiver `data_entrega` (raro), faz fallback para `created_at` formatado como `dd/MM/yyyy`. Isso garante que a data exibida seja a do pedido — não a data do acerto.

**Mesma alteração no PDF exportado** (`exportarPDF`): adicionar coluna `Nº` e usar `data_entrega` em formato `dd/MM/yyyy`.

**Mobile/Responsivo**: o `numero_sequencial` aparece também como subtítulo no celular (junto ao cliente), preservando o padrão de UI mobile existente.

## 2. Investigar pedidos "não finalizados"

Diagnóstico provável: ao confirmar o acerto, a função `confirmarAcerto` chama `rotearPagamentosVenda` e depois `UPDATE pedidos SET status='finalizado'`. Se qualquer pedido lançar erro no meio do loop, o `for` é interrompido e os pedidos restantes ficam pendentes — sem feedback claro de quais falharam.

Correções:

- **Trocar `for` por processamento individual com try/catch por pedido**: cada pedido tenta finalizar isoladamente; falhas viram lista de erros mostrada ao final (toast com IDs/números dos pedidos que falharam), e os bem-sucedidos seguem finalizados.
- **Verificar retorno do UPDATE**: capturar `error` do `supabase.from('pedidos').update(...)` (hoje ignorado) e contar como falha se ocorrer (ex.: RLS, trigger).
- **Mensagem final detalhada**: `"X de Y pedidos finalizados. Z falharam: #123, #456"` em vez do toast de sucesso atual quando há falhas parciais.
- **Logar no console** o motivo de cada falha para facilitar diagnóstico futuro.

Nenhuma alteração em schema, RLS ou Edge Functions. Mudanças apenas no arquivo `src/pages/caixa/AcertoEntregador.tsx`.

## Detalhes técnicos

- Coluna `numero_sequencial` já vem no `select` (linha 229) — só faltava exibir.
- `data_entrega` já é usada como filtro/ordenação — apenas ajustar o `format` na célula para `dd/MM/yyyy` (sem o `HH:mm` que aparece no fallback hoje).
- O loop em `confirmarAcerto` (linhas 626–682) será refatorado para `Promise.allSettled`-like sequencial com coleta de erros, mantendo a regra de processar pedidos um a um (para não estourar limite do PostgREST nas chamadas de roteamento).
