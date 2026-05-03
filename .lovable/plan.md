## Objetivo

Aplicar em todas as telas de login (`AuthErp`, `AuthCliente`, `AuthEntregador`, `AuthPainel`, `AuthParceiro`, `AuthTransportadora`, `AuthApi`, `AuthContador`) um novo layout inspirado na imagem de referência: formulário à esquerda + grande círculo gradiente à direita exibindo uma **frase motivacional aleatória** a cada acesso.

## Layout (referência da imagem)

```
┌─────────────────────────────────────────────┐
│  [logo]                    ╭───────────╮    │
│  Título portal             │           │    │
│                            │  "Frase   │    │
│  Email/Telefone            │  motiva-  │    │
│  [_______________]         │  cional"  │    │
│                            │           │    │
│  Senha                     │  — autor  │    │
│  [_______________]         ╰───────────╯    │
│                          (gradiente do      │
│  [ Entrar ]               tema do portal)   │
└─────────────────────────────────────────────┘
```

- **Desktop (≥ md)**: split 50/50 — formulário esquerda, círculo gradiente direita.
- **Mobile (< md)**: círculo vira um header decorativo compacto no topo (h-40) com a frase, e formulário ocupa o restante. Mantém legibilidade em 384px.
- O círculo tem `border-radius: 50%` cortado pela borda direita (overflow hidden no container), com gradiente HSL derivado da cor `--primary` de cada portal (tokens já existentes em `brandThemes.ts` / `theme-*.css`).
- Animações suaves: `animate-fade-in` no card, leve `animate-pulse` lento no círculo (gradient breathing), troca de frase com fade ao montar.

## Frases motivacionais

Criar `src/lib/motivationalQuotes.ts` com ~20 frases categorizadas por portal (gestão, entrega, cliente, contador, parceiro). Função `getRandomQuote(app)` retorna uma frase aleatória a cada render inicial (via `useState(() => getRandomQuote(app))` para fixar durante a sessão da tela).

Exemplos:
- ERP: "Gestão eficiente é o combustível do crescimento."
- Entregador: "Cada entrega é uma promessa cumprida."
- Cliente: "Praticidade na palma da sua mão."
- Contador: "Números organizados, decisões certeiras."

## Componente compartilhado

Criar `src/components/auth/CircleAuthLayout.tsx`:

```tsx
interface CircleAuthLayoutProps {
  portalKey: "erp" | "cliente" | "entregador" | "painel" | "parceiro" | "transportadora" | "api" | "contador";
  icon: string;        // imagem do portal
  title: string;
  subtitle: string;
  gradientFrom: string; // HSL ex: "265 85% 65%"
  gradientTo: string;
  children: ReactNode;  // o formulário
}
```

Responsável por:
- Renderizar split layout responsivo
- Escolher frase aleatória via `getRandomQuote(portalKey)` (fixa por mount)
- Aplicar gradiente do portal no círculo
- Manter compatibilidade com cards atuais (form fica como children, sem mexer em `useAuthForm`)

## Arquivos a alterar

1. **Criar** `src/lib/motivationalQuotes.ts` — catálogo + `getRandomQuote(app)`.
2. **Criar** `src/components/auth/CircleAuthLayout.tsx` — layout split + círculo.
3. **Refatorar visualmente** (sem alterar lógica de auth/redirect):
   - `src/pages/auth/AuthErp.tsx`
   - `src/pages/auth/AuthCliente.tsx`
   - `src/pages/auth/AuthEntregador.tsx`
   - `src/pages/auth/AuthPainel.tsx`
   - `src/pages/auth/AuthParceiro.tsx`
   - `src/pages/auth/AuthTransportadora.tsx`
   - `src/pages/auth/AuthApi.tsx`
   - `src/pages/auth/AuthContador.tsx`
4. **Remover** (se ainda existir e não for usado em outro lugar) `src/components/auth/AnimatedAuthCard.tsx` criado anteriormente.

## Restrições respeitadas

- Não toca em `App.tsx`, providers, rotas, `useAuthForm`, `AuthContext`, lógica de redirect por role.
- Usa tokens HSL de `index.css` / `brandThemes.ts` (sem cores hardcoded).
- Tipografia Plus Jakarta Sans já global.
- Mobile-first: testado mentalmente em 384px (largura atual do usuário).
