# Status da integração Meta (Forte Gás)

## Situação atual verificada (somente leitura)

Consulta na tabela de contas sociais retornou 3 registros, nenhum conectado via OAuth:

| Empresa | Plataforma | Conta | Via | Token | Expira |
|---|---|---|---|---|---|
| Forte Gás | instagram | Forte gas (@Fortegascp) | manual | não | — |
| Central Gas | instagram | Central Gas (@centralgas) | manual | não | — |
| Central Gas | instagram | Forte Gas Cp (@fortegascp) | manual | não | — |

Conclusão:
- **Instagram @fortegascp**: existe apenas cadastro manual (sem token, sem `ig_business_id`). Não está conectado.
- **Facebook / Página Forte Gás CP**: não existe nenhum registro de plataforma `facebook` para a Forte Gás. Não está conectado.
- Observação: há um registro "Forte Gas Cp" gravado sob a empresa **Central Gas** — provável cadastro na empresa errada.

## O que falta para conectar de verdade

1. No painel Meta for Developers, confirmar que a URI de redirecionamento do OAuth do sistema está cadastrada (o endereço exato está no bloco "Diagnóstico da conexão Meta" em Marketing → Redes Sociais).
2. Se o app Meta ainda estiver em modo desenvolvimento, adicionar o Facebook do administrador da Página Forte Gás CP como Testador e aceitar o convite.
3. Em Marketing → Redes Sociais, com a Forte Gás selecionada, clicar em "Conectar Instagram + Facebook", autorizar e escolher a Página Forte Gás CP + o Instagram profissional vinculado a ela (o Instagram precisa ser conta Profissional/Business vinculada à Página).
4. Após conectar, o painel deve mostrar "Conectado" com data de validade do token; os cadastros manuais ficam marcados como "Substituída".

## Limpeza sugerida (opcional, só após aprovação)

- Mover ou remover o registro manual "Forte Gas Cp" que está sob a empresa Central Gas, para evitar confusão de tenant.

Nenhuma alteração foi feita no código ou no banco.
