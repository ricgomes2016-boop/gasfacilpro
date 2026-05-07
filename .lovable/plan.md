## Diagnóstico

Consultando o banco, o dia **04/05/2026 ESTÁ importado**, com 2 NF-e da NACIONAL GAS:
- NF 374238 — BOTIJAO P-13 — `tipo_produto: vasilhame` (CFOP 5921)
- NF 374239 — BOTIJAO P-13 — `tipo_produto: vasilhame` (CFOP 5921)

Resumo do mês 05/2026 (NACIONAL GAS):
```
2026-05-02 → 8 cheio + 5 vasilhame
2026-05-04 → 0 cheio + 2 vasilhame   ← só vasilhame
2026-05-06 → 5 cheio + 5 vasilhame
```

**Causa do dia 04 não aparecer:** o componente `ComprasListaTable.tsx` (linha 36) inicia com `filtroTipo = "cheio"` por padrão. Como o dia 04/05 só tem registros do tipo `vasilhame`, ele é escondido pelo filtro.

Adicionalmente, observa-se um **gap de numeração** entre NF 374138 (dia 02) e 374238 (dia 04). Isso pode significar que entre os dias 03 e 04 houve NF-e "cheio" emitidas para nossa empresa que não chegaram no Outlook (ou estão em outra pasta), OU foram emitidas para outras transportadoras pelo fornecedor. Vale rodar uma re-importação ampliada para confirmar.

## Plano

### 1. Mudar filtro padrão da tabela para "todos"
Em `src/components/transportadora/compras/ComprasListaTable.tsx` linha 36:
- `useState<FiltroTipo>("cheio")` → `useState<FiltroTipo>("todos")`

Assim o usuário vê todos os tipos por padrão (cheio + vasilhame + outros) e percebe o dia 04.

### 2. Adicionar badge contador por tipo no seletor
Mostrar contagem ao lado de cada botão de filtro: "Todos (25)", "Cheio (13)", "Vasilhame (12)" — para deixar evidente quantos registros existem em cada categoria e evitar confusão futura.

### 3. Re-importação ampliada (diagnóstico)
Disparar `importar_xml_outlook` com `dias=10` (ao invés do padrão 30 dias retroativo a partir de hoje) para garantir que toda NF-e dos dias 03–05 que estiver no Outlook seja capturada. Os registros já existentes são deduplicados por `(empresa_id, chave_nfe, produto_descricao)` então não há risco de duplicar.

### 4. Reportar resultado
Após re-importar, mostrar ao usuário se apareceram NF-e novas para os dias 03–05. Se não apareceram, confirma que o gap é real do fornecedor (NFs emitidas para outras empresas).

## Detalhes técnicos
- Sem mudanças de schema, sem migrations.
- 1 arquivo alterado: `ComprasListaTable.tsx`.
- 1 chamada edge function de re-importação.
