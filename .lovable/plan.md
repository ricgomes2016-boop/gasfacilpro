## Objetivo

Garantir e comprovar que **nenhum dado da unidade Forte Gás** (antes filial da Central Gas) foi perdido na migração/consolidação, incluindo integração **Zapi WhatsApp** e **todos os clientes** que eram atendidos por essa filial.

## Estado atual verificado (Forte Gás — unidade `3a3dbca4`, empresa `c94c210b`)

| Item | Contagem |
|---|---|
| cliente_unidades (vínculos cliente↔unidade) | 55.288 |
| clientes (empresa Forte Gás) | 14.984 |
| pedidos | 128 |
| user_unidades (acessos) | 10 |
| produtos | 9 |
| contas bancárias | 5 |
| funcionários | 3 |
| entregadores | 4 |
| Integração WhatsApp Zapi (`provedor=zapi`, `provedor_tipo=evolution`, token/instance preservados, ativo=true) | 1 |
| Registros órfãos em clientes/cliente_unidades/user_unidades/pedidos | 0 |

Nenhuma referência quebrada foi detectada e a integração Zapi está intacta na unidade Forte Gás.

## Plano de auditoria e blindagem (somente leitura + relatório)

Nenhuma alteração de schema ou de código é necessária. O objetivo é **auditar, comprovar e documentar** que tudo foi preservado, e gerar um snapshot CSV para o usuário guardar.

### 1. Auditoria completa por tabela vinculada à unidade Forte Gás
Rodar contagens em todas as tabelas com `unidade_id` que podem ter dados relevantes, comparando com o estado esperado:

- Operacional: `pedidos`, `pedido_itens` (via join), `orcamentos`, `devolucoes`, `movimentacoes_estoque`, `carregamentos_rota`, `rotas`, `escalas_entregador`
- Financeiro: `contas_pagar`, `contas_receber`, `movimentacoes_caixa`, `caixa_sessoes`, `extrato_bancario`, `movimentacoes_bancarias`, `boletos_emitidos`, `cheques`
- Cadastros: `clientes`, `cliente_unidades`, `cliente_enderecos`, `cliente_creditos`, `produtos`, `fornecedores`, `funcionarios`, `entregadores`, `veiculos`
- Fiscal: `notas_fiscais`, `nota_fiscal_itens`, `compras`, `compra_itens`
- Atendimento/IA: `ai_conversas`, `ai_mensagens`, `chamadas_recebidas`, `chat_mensagens`, `bia_followups`
- WhatsApp/Marketing: `integracoes_whatsapp`, `whatsapp_gateway_instances`, `marketing_conversas`, `marketing_conteudos`, `marketing_agendamentos`
- Vale Gás/Comodato: `vale_gas`, `vale_gas_lotes`, `comodatos`
- Configuração: `configuracoes_empresa`, `configuracoes_visuais`, `formas_pagamento_custom`, `politicas_cobranca`, `sla_config`

### 2. Verificação cruzada de integridade
- Zero referências órfãs entre `clientes`, `cliente_unidades`, `user_unidades`, `pedidos`, `notas_fiscais` → unidades/empresas existentes.
- Nenhum registro ainda apontando para a empresa/unidades removidas (spin-off "Forte Gás Distribuidora" e "Matriz" órfãs).
- Sequencial de pedidos (`pedido_sequencias_unidade`) coerente com o `MAX(numero_sequencial)` real da unidade Forte Gás.
- `configuracoes_empresa` presente para empresa Forte Gás.

### 3. Verificação específica de WhatsApp
- Confirmar `integracoes_whatsapp` da unidade Forte Gás com `provedor='zapi'`, token, `instance_id` e `security_token` preservados (já confirmado).
- Listar `ai_conversas`, `chamadas_recebidas` e `marketing_conversas` da unidade para garantir histórico de atendimento preservado.
- Checar `did_empresa_routing` se houver DID roteado para Forte Gás.

### 4. Verificação específica dos clientes "que eram da Central Gas"
Interpretação: clientes atendidos pela filial Forte Gás quando ela pertencia à Central Gas.
- Contar clientes vinculados à unidade Forte Gás via `cliente_unidades` (esperado: 55.288 vínculos, 14.984 clientes distintos na empresa).
- Verificar se algum cliente com pedido histórico na unidade Forte Gás está sem vínculo em `cliente_unidades` (auto-heal via relatório, sem alterar dados nesta fase).
- Confirmar que endereços, créditos, tags e observações desses clientes seguem acessíveis.

### 5. Entregável
- Relatório consolidado exibido no chat com todas as contagens.
- Export CSV do inventário (uma linha por tabela: `tabela`, `escopo`, `total`) salvo em `/mnt/documents/auditoria-forte-gas.csv` para download.
- Se qualquer divergência ou órfão for detectado, listar exatamente quais registros e propor um segundo plano de correção — **sem alterar dados neste passo**.

## Fora de escopo
- Nenhuma edição de código, RLS, edge function ou schema.
- Nenhum `UPDATE`/`DELETE`/`INSERT`. Somente leitura + CSV.
- Correções de eventuais divergências ficam para um plano separado, após sua aprovação do relatório.