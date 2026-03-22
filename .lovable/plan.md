

# Mover e Renomear Marketing no Menu

## Alteração

**Arquivo:** `src/components/layout/menuItems.ts`

1. **Remover** o bloco "Marketing" da posição atual (logo após Dashboard, linhas 107-119)
2. **Inserir** o mesmo bloco logo **após** "Gestão de Clientes" (após linha ~185)
3. **Renomear** o label de `"Marketing"` para `"Gestão de Marketing"`

Ordem final no menu:
- Dashboard
- Assistente IA
- Atendimento
- Vendas
- Caixa
- Gestão Operacional
- **Gestão de Clientes**
- **Gestão de Marketing** ← movido para cá
- Gestão de Estoque
- ...

Nenhuma outra alteração necessária — rotas, páginas e submenus permanecem intactos.

