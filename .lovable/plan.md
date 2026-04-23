

## Calculadora flutuante discreta no ERP

### Onde colocar
Botão de **calculadora** na **MobileBottomBar** (mobile) e como **ícone discreto no Header** ao lado do toggle de tema (desktop) — seguindo o mesmo padrão do chat e da IA, mas mais sutil (apenas ícone ghost, sem badge nem destaque de cor).

```text
Header desktop:  [Chat] [Notif] [Tema-Gas] [🌙/☀️] [🧮 NOVO] [Avatar]
MobileBottomBar: [💬 Chat] | [🤖 IA] | [🧮 Calc NOVO]
```

Não vai ser FAB próprio (já temos IA flutuante; mais um botão flutuante polui a tela). Ficar junto do toggle de tema mantém a tela limpa e respeita a regra de estabilidade do projeto (sem mexer em App.tsx, providers ou rotas).

### O que será entregue

**1. Novo componente `src/components/shared/CalculatorPopover.tsx`**
- Botão `<Button variant="ghost" size="icon">` com ícone `Calculator` do lucide.
- Abre um `Popover` (desktop) / `Sheet` bottom (mobile) de ~280px.
- Calculadora completa:
  - Display grande (read-only).
  - Teclado: 0–9, `.`, `+`, `−`, `×`, `÷`, `%`, `±`, `C`, `⌫`, `=`.
  - Linha extra: **"Copiar"** (copia resultado para clipboard com toast) e **"Histórico"** (últimas 5 operações, em memória apenas).
- Suporte a teclado físico quando aberto (números, operadores, Enter = `=`, Esc = fecha, Backspace = `⌫`).
- Lógica de cálculo simples e segura (sem `eval`): parser de expressão linear com precedência básica `× ÷` antes de `+ −`.
- Formato BR: vírgula como separador decimal na exibição, ponto internamente.

**2. Integrar no `Header.tsx`**
- Adicionar `<CalculatorPopover />` entre `GasmaisThemeQuickToggle` e o toggle de tema.
- Visível em todas as telas (mobile e desktop), pois o ícone é pequeno (`h-9 w-9`).

**3. Integrar no `MobileBottomBar.tsx`**
- Adicionar terceiro botão "Calc" com ícone `Calculator`, mesmo padrão visual de Chat/IA (motion.button, label `text-[10px]`).
- Divisor `w-px bg-border/50` entre IA e Calc.
- Prop nova `onOpenCalc: () => void` controlada pelo `MainLayout`.

**4. Integrar no `MainLayout.tsx`**
- Novo state `const [calcOpen, setCalcOpen] = useState(false)`.
- Renderizar `<CalculatorPopover externalOpen={calcOpen} onExternalClose={() => setCalcOpen(false)} />` como overlay global (igual padrão do `AiFloatingButton`).
- Passar `onOpenCalc={() => setCalcOpen(true)}` para `MobileBottomBar`.

**5. Não vai aparecer em**
- `/cliente/*` (usa `ClienteLayout`, sem MainLayout).
- `/entregador/*` (app próprio).
- `/auth`, landing pages e páginas públicas.

### Arquivos
- **Criar**: `src/components/shared/CalculatorPopover.tsx`
- **Editar**: `src/components/layout/Header.tsx`, `src/components/layout/MobileBottomBar.tsx`, `src/components/layout/MainLayout.tsx`

### Critérios de aceite
- Ícone de calculadora discreto aparece no Header (desktop) ao lado do toggle de tema.
- No mobile, terceiro botão "Calc" aparece na barra inferior junto de Chat e IA.
- Clique abre popover com calculadora funcional (operações básicas + porcentagem).
- Botão "Copiar" copia o resultado para o clipboard.
- Esc fecha; teclado físico funciona quando popover está aberto.
- Nenhuma mudança em rotas, providers ou App.tsx.

