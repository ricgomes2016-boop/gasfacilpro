
## Objetivo

Corrigir o fluxo OFX do `/contador/financeiro` para ficar realmente profissional: importar de forma segura, salvar os lançamentos com a conta bancária correta, respeitar segurança do portal do contador e mostrar o resultado imediatamente na tela.

## Diagnóstico do problema atual

1. **A tabela já existe na tela**, mas o fluxo não está fechando corretamente entre importação e exibição.
2. **Os lançamentos importados não estão sendo vinculados em `conta_bancaria_id`**, então as abas dinâmicas por conta não se formam como esperado.
3. **O importador está engolindo erros de insert**, podendo mostrar sucesso mesmo quando o banco recusou a gravação.
4. **O portal do contador provavelmente não tem permissões RLS suficientes** para ler/gravar `extrato_bancario` e `contas_bancarias` no escopo das empresas vinculadas ao contador.
5. **Após importar, a tela não se reposiciona para o contexto certo** (aba Extratos, período, unidade/conta importada), então para o usuário parece que “nada aconteceu”.

## O que vou implementar

### 1. Corrigir a persistência do OFX
Em `src/components/contador/DialogImportarOFX.tsx`:

- Parar de considerar importação como sucesso sem validar `error` de cada `insert`.
- Se qualquer lote falhar, exibir erro real e não mostrar toast de sucesso.
- Ao criar/identificar uma conta bancária, capturar o `id` retornado e salvar cada lançamento com:
  - `unidade_id`
  - `conta_bancaria_id`
  - `data`
  - `descricao`
  - `valor`
  - `tipo`
  - `conciliado`
- Incluir no callback final um payload com:
  - unidades importadas
  - contas importadas
  - período do arquivo
  - quantidade real gravada
  - ids das contas bancárias usadas/criadas

Resultado: os dados vão existir de verdade no banco e a tela saberá exatamente o que acabou de ser importado.

### 2. Ajustar segurança do portal do contador
Criar migração de banco para permitir acesso seguro do contador somente às empresas às quais ele já está vinculado:

- `SELECT` em `extrato_bancario` para contador vinculado à empresa da unidade.
- `INSERT` em `extrato_bancario` para contador vinculado à empresa da unidade.
- `UPDATE` em `extrato_bancario` para contador vinculado à empresa da unidade.
- `SELECT` em `contas_bancarias` no mesmo escopo.
- `INSERT` em `contas_bancarias` no mesmo escopo.

Implementação com política baseada em `contador_has_empresa(...)` + relação via `unidades`, sem abrir acesso global.

Resultado: o contador conseguirá importar e enxergar os extratos no próprio portal, sem quebrar isolamento entre empresas.

### 3. Fazer a tela mostrar o resultado imediatamente
Em `src/pages/contador/ContadorFinanceiro.tsx`:

- Trocar o `onConcluido` simples por um handler com payload da importação.
- Após importação bem-sucedida:
  - abrir automaticamente a aba **Extratos**
  - ajustar o período para cobrir o intervalo importado
  - se necessário, limpar o filtro de unidade para “Todas as lojas” quando o arquivo afetar mais de uma unidade
  - selecionar automaticamente a aba da conta importada quando houver uma conta principal
  - disparar novo `fetchExtratos()` só depois do contexto correto estar definido

Resultado: o usuário importa e vê os dados na sequência, na mesma tela, sem precisar “adivinhar” filtro, período ou aba.

### 4. Melhorar a confirmação visual da importação
Ainda em `ContadorFinanceiro.tsx`:

- Adicionar um banner de “Última importação concluída” acima da planilha com:
  - total de lançamentos gravados
  - número de contas
  - período importado
  - unidades afetadas
- Exibir CTA contextual quando a importação gerou dados mas o filtro ativo está escondendo parte deles.

Resultado: a tela passa a comunicar claramente o que foi importado e onde os dados estão.

### 5. Garantir que as abas por conta funcionem de verdade
Na integração entre `DialogImportarOFX.tsx` e `ContadorFinanceiro.tsx`:

- Persistir `conta_bancaria_id` em todos os lançamentos importados.
- Recarregar `contas_bancarias` junto com `extrato_bancario`.
- Manter o label das abas no formato:
  `[UNIDADE] · [BANCO] ····[4 últimos]`
- Só usar “Sem conta vinculada” quando realmente não houver conta.

Resultado: a planilha deixa de cair toda em “Sem conta vinculada” e passa a refletir as contas do OFX.

## Arquivos afetados

- **Editar** `src/components/contador/DialogImportarOFX.tsx`
  - validar erros reais
  - salvar `conta_bancaria_id`
  - retornar payload da importação
- **Editar** `src/pages/contador/ContadorFinanceiro.tsx`
  - sincronizar aba/período/unidade após importação
  - mostrar banner profissional de resultado
  - focar automaticamente nos dados recém-importados
- **Migração** em `supabase/migrations/...sql`
  - políticas RLS para `extrato_bancario`
  - políticas RLS para `contas_bancarias`

## Detalhes técnicos

```text
Importar OFX
   ↓
detectar/criar conta bancária
   ↓
insert extrato_bancario com conta_bancaria_id
   ↓
retornar payload da importação
   ↓
ContadorFinanceiro ajusta:
- aba = Extratos
- período = intervalo importado
- unidade = todas ou unidade correta
- tab da conta = conta importada
   ↓
fetchExtratos()
   ↓
planilha mostra dados imediatamente
```

## Critérios de aceite

- ✓ O contador consegue importar OFX pelo portal e os registros são realmente gravados.
- ✓ Nenhum toast de sucesso aparece quando houver erro de banco.
- ✓ Os lançamentos importados aparecem imediatamente na aba **Extratos**.
- ✓ As abas dinâmicas por conta passam a funcionar porque os lançamentos ficam vinculados à conta bancária.
- ✓ O período e o contexto visual são ajustados automaticamente para não “sumir” com os dados recém-importados.
- ✓ O acesso continua seguro, limitado às empresas vinculadas ao contador.
