

## Analysis

The current `subdomain.ts` already has the correct configuration with both base domains:

```text
BASE_DOMAINS = [
  "painel.gasfacilpro.com.br",   ← nested subdomain base
  "gasfacilpro.com.br",          ← root base domain
  "gasfacil-entregas.lovable.app"
]
```

This means the routing currently works as follows:

| URL | Detected App | Route |
|-----|-------------|-------|
| `gasfacilpro.com.br` | landing | `/` |
| `entregador.painel.gasfacilpro.com.br` | entregador | `/entregador/dashboard` |
| `clientes.painel.gasfacilpro.com.br` | cliente | `/cliente` |
| `painel.painel.gasfacilpro.com.br` | painel (admin) | `/admin` |
| `app.painel.gasfacilpro.com.br` | erp | `/dashboard` |
| `portal.painel.gasfacilpro.com.br` | parceiro | `/parceiro/dashboard` |
| `painel.gasfacilpro.com.br` (root) | **landing** | `/` |

**One question:** `painel.gasfacilpro.com.br` (without prefix) currently shows the **landing page**. Should it instead show the **ERP dashboard** (`/dashboard`)? If so, a small change is needed to map the root of that base domain to "erp" instead of "landing".

### Plan

1. **Update `detectSubdomainApp()`** in `src/lib/subdomain.ts` — when hostname exactly matches `painel.gasfacilpro.com.br`, return `"erp"` instead of `"landing"`, so the main app domain serves the ERP dashboard.
2. **Update comments** to reflect the correct subdomain structure under `painel.gasfacilpro.com.br`.
3. **No other files need changes** — `SubdomainGuard`, `Auth.tsx`, and `ProtectedRoute` already handle all app types correctly.

