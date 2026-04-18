
Diagnóstico:
- Analisei o código atual e o problema realmente não foi corrigido.
- Na tela `SiteInstitucional.tsx`, a lógica procura o site nesta ordem: `empresa.slug` -> `empresa.nome` -> `unidadeAtual.nome`.
- No seu caso, a loja selecionada é uma filial (`unidadeAtual = Forte Gás`), mas a `empresa` continua sendo a empresa-mãe. Por isso a página encontra `central-gas` primeiro e fixa o link da Central Gás.
- A captura confirma isso: no cabeçalho está selecionado `Forte Gás`, mas o card ainda mostra `Central Gás`.

Plano de correção:
1. Ajustar a regra de origem dos dados
- Fazer a página usar primeiro a loja/unidade selecionada (`unidadeAtual`) como fonte principal.
- Só usar `empresa` como fallback quando não houver unidade selecionada.

2. Corrigir o mapeamento do site institucional
- Trocar o mapa simples por uma resolução mais robusta baseada na loja ativa.
- Aceitar aliases normalizados da unidade, por exemplo:
  - `forte gas` -> `/fortegas`
  - `central gas` -> `/centralgascp`
- Se a loja ativa não estiver mapeada, não pode cair automaticamente no site da empresa-mãe.

3. Ajustar a regra de fallback
- Se a unidade selecionada não tiver site institucional configurado:
  - mostrar apenas a mensagem informando que não há site institucional
  - exibir “Fale com o administrador”
  - não mostrar link nem preview de outra empresa

4. Garantir atualização visual imediata
- Recalcular `siteUrl` com dependência direta da `unidadeAtual`.
- Manter a recarga forçada do iframe com chave baseada na unidade ativa e no link resolvido.

5. Validar o comportamento esperado
- Selecionando `Forte Gás` -> deve mostrar `/fortegas`
- Selecionando `Central Gás` -> deve mostrar `/centralgascp`
- Selecionando uma loja sem site -> deve mostrar somente “Fale com o administrador”

Arquivo a ajustar:
- `src/pages/config/SiteInstitucional.tsx`

Detalhe técnico:
- O erro não está no layout nem no iframe em si.
- O erro está na prioridade da lógica: hoje ela privilegia `empresa.slug`, mas o seletor do cabeçalho troca `unidadeAtual`.
- Ou seja: o seletor muda a loja, mas a tela continua resolvendo pelo cadastro da empresa principal.
