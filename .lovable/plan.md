

# Página de Regras de Atendimento da Bia

## Objetivo
Criar uma página onde cada empresa configura as regras operacionais da Bia: horários, produtos permitidos, e regras especiais (como domingo).

## Mudanças no Banco de Dados

Adicionar coluna JSONB `regras_bia` na tabela `configuracoes_empresa` para armazenar:
```json
{
  "bia_ativa": true,
  "horario_abertura": "08:00",
  "horario_fechamento": "18:00",
  "horario_domingo_fechamento": "14:00",
  "domingo_ativo": true,
  "agua_entrega_domingo": false,
  "categorias_permitidas": ["gas", "agua"],
  "mensagem_fora_horario": "Estamos fechados, mas posso agendar!",
  "desconto_etapa1": 3,
  "desconto_etapa2": 5,
  "preco_minimo_p13": null,
  "preco_minimo_p20": null
}
```

## Nova Página: `src/pages/config/RegrasBia.tsx`

Cards organizados:

1. **Status da Bia** — Switch ativo/inativo
2. **Horários de Atendimento** — Inputs de abertura/fechamento, configuração específica de domingo (ativo, horário, restrição de água)
3. **Produtos Permitidos** — Lista de produtos da unidade com checkboxes por categoria (gás, água, vasilhame) para definir o que a Bia pode vender
4. **Negociação** — Desconto etapa 1, etapa 2, preço mínimo P13/P20
5. **Mensagem Fora do Horário** — Texto customizável

## Rota e Menu

- Rota: `/config/regras-bia` em `configRoutes.ts` (roles: admin, gestor)
- Menu: Adicionar item "Regras da Bia" no submenu de Configurações em `menuItems.ts`

## Atualização do `bia-core.ts`

- Na função que monta o prompt, buscar `regras_bia` da `configuracoes_empresa` para a empresa da unidade
- Filtrar produtos com base nas `categorias_permitidas`
- Usar horários da config da Bia (ao invés de hardcoded)
- Aplicar regras de domingo condicionalmente por empresa (substituindo o hardcode do `empresa_id` da Central Gás)

## Arquivos

| Arquivo | Ação |
|---------|------|
| `configuracoes_empresa` | Migration: adicionar coluna `regras_bia jsonb` |
| `src/pages/config/RegrasBia.tsx` | Criar |
| `src/routes/configRoutes.ts` | Adicionar rota |
| `src/components/layout/menuItems.ts` | Adicionar item no menu |
| `supabase/functions/_shared/bia-core.ts` | Ler `regras_bia` e aplicar filtros |
| Edge functions (5 webhooks + ai-assistant) | Redeploy |

