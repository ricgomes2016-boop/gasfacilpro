
## Objetivo

Fazer a página `/contador/xml` exibir imediatamente os XMLs que já estão no banco, sem criar mais botões “placebo” e sem continuar gastando crédito em tentativas que não resolvem a causa real.

## Diagnóstico confirmado

Os XMLs já existem no banco:
- 163 registros em `notas_fiscais`
- 118 do tipo `nfe`
- 45 do tipo `nfce`

Eles estão vinculados às unidades:
- ABMF
- Temgas
- Forte Gás

O problema principal não é importação nem “gravar na página”. O problema é de acesso/leitura no portal do contador:

1. A tela `/contador/xml` lê `notas_fiscais` direto do frontend.
2. A tabela `notas_fiscais` está protegida por RLS.
3. As policies atuais de `notas_fiscais` não liberam corretamente o perfil `contador` para empresas vinculadas em `contador_empresas`.
4. Resultado: a query volta vazia na tela, mesmo com dados já gravados no banco.

O botão “Gravar na página” não resolve isso, porque ele só dispara novo fetch no frontend.

## O que será implementado

### 1. Corrigir o acesso do contador aos XMLs no backend
Criar uma migration específica para `notas_fiscais`:

- ajustar a policy restritiva `tenant_isolation_notas_fiscais`
- permitir leitura quando:
  - o usuário for `super_admin`, ou
  - a unidade pertencer à própria empresa do usuário, ou
  - o usuário contador estiver vinculado à empresa da unidade via `contador_empresas`

Também será adicionada/ajustada uma policy explícita de `SELECT` para `contador`, porque hoje a leitura está centrada em `admin/gestor/financeiro/operacional`.

Efeito esperado:
- o contador passa a enxergar os XMLs já existentes sem reimportar nada.

### 2. Remover a falsa sensação de persistência na UI
Na `src/components/contador/ImportacaoInteligente.tsx`:

- remover ou rebaixar o botão “Gravar na página”
- substituir por ação honesta, como “Atualizar lista”, apenas quando fizer sentido
- manter o refresh automático após importação concluída

Objetivo:
- não induzir a ideia de que falta “salvar na página”
- deixar claro que, após importar, os registros já estão no sistema

### 3. Deixar a tela de XML resiliente para dados já existentes
Na `src/pages/contador/ContadorXML.tsx`:

- manter a carga por “todos os períodos” como padrão
- preservar agrupamento por dia, tipo, CNPJ e dados fiscais
- garantir refetch somente depois que empresa/unidade estiverem prontas
- melhorar estado vazio para diferenciar:
  - “sem XML cadastrado”
  - “sem empresa selecionada”
  - “sem permissão para visualizar”
  - “nenhum XML no filtro atual”

Objetivo:
- a página parar de parecer vazia sem explicação

### 4. Validar o fluxo completo com os dados já existentes
Depois da correção:

- confirmar que os cards mostram os totais reais
- confirmar que NF-e e NFC-e aparecem na tabela
- confirmar que os XMLs das unidades ABMF, Temgas e Forte Gás ficam visíveis
- confirmar que o filtro por empresa/unidade continua funcionando

## Arquivos afetados

### Banco / backend
- nova migration em `supabase/migrations/...sql`

### Frontend
- `src/pages/contador/ContadorXML.tsx`
- `src/components/contador/ImportacaoInteligente.tsx`

## Resultado esperado

Após a correção:
- os XMLs que já estão no banco aparecem na página sem nova importação
- o contador consegue ver NF-e e NFC-e existentes
- a tabela deixa de ficar zerada sem motivo
- não será mais necessário insistir em importação nem em botão de “gravar na página” para resolver visibilidade

## Detalhe técnico principal

A correção central será na RLS de `public.notas_fiscais`, usando a empresa da `unidade_id` como base de autorização para o contador vinculado em `public.contador_empresas`.

Em termos práticos, a regra ficará equivalente a:

```sql
super_admin
OR empresa do usuário
OR contador vinculado à empresa da unidade da nota
```

Isso resolve a causa real sem refatorar `App.tsx`, sem mexer na estrutura do portal e sem recriar os XMLs.
