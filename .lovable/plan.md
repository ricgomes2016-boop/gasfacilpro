
# Plano: consolidar Forte Gás na empresa antiga (reativá-la como matriz)

## Estado atual (do banco)
- Empresa **"Forte Gás"** (antiga, inativa)
  - unidade "Matriz" (auto-criada) — tem 3 pedidos históricos.
- Empresa **"Forte Gás Distribuidora"** (criada pelo spin-off, ativa)
  - unidade **"Forte Gás"** — é a unidade real, foi tirada da Central Gas na migração e virou matriz aqui. Concentra 70 clientes, 10 usuários e ~40 mil vínculos de cliente_unidades.
  - unidade "Matriz" (auto-criada, órfã) — nunca usada.

## O que a operação vai fazer (data-only, uma única migration de reparo)

1. **Reativar** a empresa "Forte Gás" antiga (`ativo = true`).
2. **Mover a unidade "Forte Gás"** (a de verdade) para dentro da empresa antiga, mantendo `tipo = matriz`.
3. **Reatribuir os 3 pedidos** da unidade "Matriz" antiga → unidade "Forte Gás".
4. **Migrar quaisquer outros vínculos** da unidade "Matriz" antiga (contas bancárias, entregadores, funcionários, produtos, cliente_unidades, user_unidades) → unidade "Forte Gás".
5. **Apagar a unidade "Matriz" antiga** (07f9bfac) — agora vazia.
6. **Apagar a unidade "Matriz" órfã** dentro de "Forte Gás Distribuidora" (b5429c3a) — nunca teve dados.
7. **Atualizar `clientes.empresa_id`** de `Forte Gás Distribuidora` → `Forte Gás` (70 registros).
8. **Atualizar `profiles.empresa_id`** de `Forte Gás Distribuidora` → `Forte Gás` (0 no momento; no-op se continuar assim).
9. **Apagar a empresa "Forte Gás Distribuidora"** (já vazia).

Tudo dentro de uma única transação, para que qualquer falha faça rollback e nada fique parcialmente aplicado.

## Resultado final
- Existe **uma única empresa "Forte Gás"**, ativa, com uma única unidade **"Forte Gás"** como matriz.
- Nenhum cliente, usuário, vínculo, pedido ou saldo é perdido — todos passam a apontar para a Forte Gás consolidada.
- Central Gas **continua sem a Forte Gás como filial** (essa foi a mudança que a migração original produziu e é o cenário que você confirmou querer manter).

## Fora do escopo desta iteração
- Não vou alterar código do frontend, do edge function `migrate-unidade`, RLS, nem rotas.
- Melhorias no botão "Migrar unidade" (mensagens de erro claras, bloquear spin-off duplicado, remoção da unidade "Matriz" órfã criada por trigger) ficam para uma próxima iteração, se você pedir.
- Não vou mexer em outras empresas inativas antigas (Sertaneja, ABMF, Temgas, Morumbi Gás, Japa Gás) — só a Forte Gás.

## Como confirmar depois
Após aplicar, farei uma consulta mostrando: empresas Forte Gás, unidades vinculadas, contagem de clientes/pedidos/usuários — pra você conferir que ficou como esperado.
