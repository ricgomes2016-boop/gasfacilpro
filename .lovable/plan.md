

# Plano: Clientes Institucionais e Vale Gás — Pular Pagamento e Valor

## Problema
Quando o cliente informa que é de escola, colégio, polícia, secretaria de educação, assistência social, prefeitura, ou que vai pagar com vale gás, a Bia ainda pergunta forma de pagamento e informa valor. Esses clientes não precisam dessas etapas.

## Alterações em `supabase/functions/_shared/bia-core.ts`

### 1. Detectar cliente institucional no `extractCollectedData`
Adicionar detecção de "tipo de cliente" no scan de mensagens do usuário. Se o texto mencionar escola, colégio, polícia, secretaria, assistência social, prefeitura → marcar como `clienteInstitucional = true` e setar `pagamento = "institucional"`.

Regex: `/\b(escola|col[eé]gio|pol[ií]cia|secretaria\s*(de\s*educa[çc][aã]o)?|assist[eê]ncia\s*social|prefeitura)\b/i`

Se vale gás detectado, também pular valor (já detecta pagamento "vale gás").

### 2. Atualizar `detectCurrentStep`
Se `pagamento` é "institucional" ou "vale gás" E produto e endereço confirmados → ir direto ao Passo 5 (registrar).
Se `pagamento` é "institucional" ou "vale gás" E produto confirmado → pular Passo 4, ir ao Passo 3 (endereço).
Se `pagamento` é "institucional" ou "vale gás" E endereço confirmado → ir ao Passo 5.

### 3. Atualizar `buildSystemPrompt`
Adicionar regra no prompt:

```
CLIENTES INSTITUCIONAIS E VALE GÁS (CRÍTICO):
- Se o cliente informar que é de escola, colégio, polícia, secretaria de educação, 
  assistência social ou prefeitura: NÃO pergunte forma de pagamento, NÃO informe valor.
  Registre pagamento como "institucional" e valor como 0.
- Se o cliente informar que vai pagar com vale gás: NÃO informe valor. 
  Registre pagamento como "vale gás" e valor como 0.
- Para esses casos, após confirmar endereço, registre o pedido imediatamente.
```

Ajustar `finalizeHint` para considerar que pagamento "institucional" ou "vale gás" dispensa a etapa 4.

### 4. Ajustar tag PEDIDO_CONFIRMADO
Na seção de dados técnicos, adicionar nota: `valor: 0 (para institucional ou vale gás)`.

## Arquivo a alterar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/_shared/bia-core.ts` | `extractCollectedData`: detectar cliente institucional. `detectCurrentStep`: pular passo 4 para institucional/vale gás. `buildSystemPrompt`: regra institucional + valor 0 |

