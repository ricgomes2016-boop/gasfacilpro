## App Vendedor (`vendas.gasfacilpro.com.br`)

App mobile-first dedicado ao vendedor externo/interno, espelhando a arquitetura enxuta do app do entregador, mas focado em **vender rápido** (balcão ou para entrega), acompanhar **metas/comissão**, consultar **clientes** e participar do **bolão**.

---

### 1. Infra de subdomínio e auth

- **`src/lib/subdomain.ts`**: adicionar `"vendedor"` ao tipo `SubdomainApp`, mapear `vendas` / `vendedor` no `SUBDOMAIN_MAP`, retornar `vendedor.<base>` em `getCanonicalHostnameForApp`, default route `/vendedor`, `inferAppFromPath` reconhece `/vendedor`, `isRouteAllowedForSubdomain` libera só `/vendedor/*` + `/auth` + `/reset-password`.
- **`src/contexts/AuthContext.tsx`**: adicionar `"vendedor"` em `AppRole`.
- **`src/components/auth/ProtectedRoute.tsx`**: redirecionar usuários com role `vendedor` para `/vendedor`. Em `STAFF_ROLES`, **não** incluir vendedor (mantém isolamento de portal igual entregador).
- **`src/pages/Auth.tsx`** + novo **`src/pages/auth/AuthVendedor.tsx`**: tela de login espelhando `AuthEntregador` (e-mail+senha, branding GásFácil).
- **DNS**: usuário cria `CNAME vendas` apontando para Lovable (ou A 185.158.133.1) e conecta o domínio em Project Settings.

### 2. Banco de dados (migration única)

- Acrescentar `'vendedor'` no enum `app_role`.
- Nenhuma tabela nova obrigatória — reusamos:
  - `pedidos` (vendas) — campos `vendedor_id`, `tipo_venda` ('balcao' | 'entrega') já mapeáveis em colunas existentes; usar `entregador_id` = vendedor quando balcão, ou deixar vazio quando entrega.
  - `clientes`, `produtos`, `bolao_jogos`, `bolao_palpites`, `rh_avisos_entregador` (renomear conceitualmente para "avisos da equipe" — reusar tabela tal qual, sem mudar schema).
  - `comissao_config` + view agregando `pedidos` para a aba Metas.
- **GRANTs**: nenhum schema novo, só policy adicional permitindo `role = 'vendedor'` ler/inserir nas mesmas tabelas que `operacional` já acessa (RLS scoped por `unidade_id` via `user_unidades`).

### 3. Rotas e shell do app

Novo arquivo **`src/routes/vendedorRoutes.ts`** (espelho de `entregadorRoutes`), todas com `roles: ["vendedor", "admin", "gestor"]`:

```text
/vendedor                  → VendedorHome (atalhos + resumo do dia)
/vendedor/nova-venda       → VendedorNovaVenda (toggle Balcão / Entrega)
/vendedor/historico        → VendedorHistorico (minhas vendas)
/vendedor/clientes         → VendedorClientes (busca + ficha leve)
/vendedor/metas            → VendedorMetas (meta, ranking, comissão)
/vendedor/avisos           → VendedorAvisos (comunicados)
/vendedor/bolao            → VendedorBolao (copy de EntregadorBolao)
/vendedor/perfil           → VendedorPerfil
```

Shell **`VendedorApp.tsx`** com bottom-tab fixo (4 abas visíveis + menu "Mais"):

```text
[ Vendas ] [ Histórico ] [ Bolão ] [ Mais ▾ ]
                                    ├ Clientes
                                    ├ Metas
                                    ├ Avisos
                                    └ Perfil
```

Mantém padrão mobile: `pb-12`, inputs 16px, `ResponsiveDialog`, Plus Jakarta Sans.

### 4. Telas (copy + ajustes do app entregador)

- **Nova Venda**: reusar `EntregadorNovaVenda` como base. Adicionar toggle no topo: **Balcão** (cria pedido `status='entregue'`, baixa estoque imediato, abre caixa do vendedor) ou **Entrega** (cria pedido `status='pendente'` → cai na fila de roteirização do ERP, sem rota atribuída). Mesma busca de cliente melhorada já implementada, mesmo carrinho.
- **Histórico**: lista os pedidos onde `vendedor_id = auth.uid()`, filtros por período e status. Reusar componentes de `EntregadorHistorico`.
- **Clientes (CRM leve)**: lista com busca, ficha mostra últimos pedidos, endereço, telefone (botão WhatsApp), observação. Sem edição pesada — só `cliente_observacoes` insert.
- **Metas/Comissão**: card de meta do mês, barra de progresso, total vendido, comissão estimada (lê `comissao_config` da unidade), ranking entre vendedores da unidade.
- **Avisos**: reusa `rh_avisos_entregador` filtrado por escopo "vendedor" ou "todos". Badge de não lido no bottom-tab.
- **Bolão**: copy direto de `EntregadorBolao.tsx` (já tem projeção mata-mata, títulos de fase) — só troca path/role.
- **Perfil**: avatar, nome, unidade, sair. Igual `EntregadorPerfil`.

### 5. Integração com ERP

- ERP ganha tela **Cadastros → Vendedores** (lista usuários com role `vendedor`, atribui unidade via `user_unidades`, define meta e % comissão).
- Dashboard do gestor mostra widget "Vendas por vendedor" usando `pedidos.vendedor_id`.

### 6. Detalhes técnicos

- Nenhuma alteração em `App.tsx` (mantemos estabilidade — só registramos `vendedorRoutes` da mesma forma que `entregadorRoutes`).
- SubdomainGuard já cobre redirecionamento automático.
- Service worker / forced update já é global, app herda.
- Para "balcão", o pedido entra direto no caixa aberto da unidade do vendedor — se não houver caixa aberto, bloqueia com toast (regra `useCaixaBloqueado`).

### 7. Sugestões extras (opcionais, fora do escopo inicial)

- **Catálogo offline** com SW para vendas em locais sem sinal.
- **Compartilhar orçamento por WhatsApp** antes de fechar a venda.
- **Check-in geolocalizado** no cliente (para vendedor externo) — reusa `useGeoTracking`.
- **Voz para buscar cliente/produto** (reusa infra Bia).

---

### Entregáveis dessa implementação

1. Migration: enum role + policies vendedor.
2. `src/lib/subdomain.ts`, `AuthContext`, `ProtectedRoute`, `Auth.tsx`, `AuthVendedor.tsx`.
3. `src/routes/vendedorRoutes.ts` + registro em `App.tsx` (linha única, sem refactor).
4. `src/pages/vendedor/`: `VendedorApp.tsx`, `VendedorHome`, `VendedorNovaVenda`, `VendedorHistorico`, `VendedorClientes`, `VendedorMetas`, `VendedorAvisos`, `VendedorBolao`, `VendedorPerfil`.
5. ERP: página `Cadastros → Vendedores`.
6. Docs rápidos no README sobre DNS do subdomínio.

Posso seguir com a implementação?
