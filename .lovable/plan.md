

## Plano: Dialog → Drawer responsivo no mobile

### Abordagem

Criar um componente wrapper `ResponsiveDialog` que detecta mobile via `useIsMobile()` e renderiza **Drawer** (vaul) no mobile ou **Dialog** (radix) no desktop. Isso evita alterar 121 arquivos individualmente — basta trocar os imports nos arquivos prioritários.

### Arquivos a criar

**1. `src/components/ui/responsive-dialog.tsx`** — Componente wrapper que exporta:
- `ResponsiveDialog` — usa `Drawer` no mobile, `Dialog` no desktop
- `ResponsiveDialogContent` — `DrawerContent` (com max-h-[85vh] e scroll) ou `DialogContent`
- `ResponsiveDialogHeader` → `DrawerHeader` / `DialogHeader`
- `ResponsiveDialogFooter` → `DrawerFooter` (sticky) / `DialogFooter`
- `ResponsiveDialogTitle` → `DrawerTitle` / `DialogTitle`
- `ResponsiveDialogDescription` → `DrawerDescription` / `DialogDescription`
- `ResponsiveDialogClose` → `DrawerClose` / `DialogClose`
- `ResponsiveDialogTrigger` → `DrawerTrigger` / `DialogTrigger`

O footer no Drawer terá `sticky bottom-0 bg-background border-t` para botões sempre visíveis.

### Arquivos a modificar (troca de imports)

Os seguintes arquivos terão `Dialog*` substituído por `ResponsiveDialog*`:

1. **`src/components/clientes/ClienteFormDialog.tsx`** — Cadastro de Clientes
2. **`src/components/clientes/ClienteUnidadesDialog.tsx`** — Unidades do Cliente
3. **`src/components/vendas/NovaVendaModal.tsx`** — Nova Venda / Pedidos
4. **`src/components/entregador/IniciarRotaModal.tsx`** — Iniciar Rota
5. **`src/pages/financeiro/ContasBancarias.tsx`** — Contas Bancárias
6. **`src/pages/financeiro/EmailTransacional.tsx`** — Email Transacional
7. **`src/pages/config/DocumentosEmpresa.tsx`** — Documentos
8. **`src/pages/rh/OnboardingOffboarding.tsx`** — Onboarding RH

Em cada arquivo a mudança é mecânica: trocar o import de `@/components/ui/dialog` para `@/components/ui/responsive-dialog` e renomear os componentes (prefixo `Responsive`).

### Detalhes técnicos

- `useIsMobile()` já existe com breakpoint 768px
- `vaul` (Drawer) já está instalado e configurado
- O `ResponsiveDialogContent` no mobile terá `max-h-[85vh]` com conteúdo rolável via `overflow-y-auto`
- O `ResponsiveDialogFooter` no mobile terá `sticky bottom-0` com borda superior para manter botões visíveis durante scroll

### Escopo

- ~9 arquivos modificados/criados
- Sem mudanças no `dialog.tsx` ou `drawer.tsx` originais
- Sem breaking changes — arquivos que continuam usando `Dialog` direto funcionam normalmente

