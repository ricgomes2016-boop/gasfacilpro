## Objetivo
Bloquear o salvamento de configurações fiscais incompletas/inválidas em **Configurações → Unidades**, exibindo mensagens de erro claras (toast) e marcando os campos com pendência.

## Arquivo
- `src/pages/config/Unidades.tsx`

## Função `validateFiscal(u)` (nova) — roda antes de `handleSave`

Regras (todas exibem mensagem amigável; mensagens agregadas em um único toast destrutivo):

1. **Certificado Digital A1** — se *qualquer* campo do bloco estiver preenchido, todos passam a ser obrigatórios:
   - Arquivo `.pfx/.p12` enviado (`certificado_a1_path`)
   - Senha do certificado
   - Data de validade — não pode estar vencida (mostra "Certificado A1 vencido — substitua antes de emitir notas")
2. **CSC NFC-e** — se um dos campos preenchido, exige ambos:
   - `nfce_csc_id` obrigatório
   - `nfce_csc_token` obrigatório, mínimo 16 caracteres
3. **Provedor de Emissão Fiscal** — se selecionado (≠ "nenhum"):
   - URL obrigatória e deve iniciar com `http://` ou `https://`
   - Token / API Key obrigatório
4. **Ambiente Produção** — para `nfe_ambiente = producao` exige:
   - Certificado A1 + senha
   - CNPJ
   - Inscrição Estadual (aceita "ISENTO")
   - Regime Tributário definido
5. **Numerações** — se informadas (NFe / NFC-e / CT-e: série e próximo nº), devem ser inteiros ≥ 1.

## Comportamento de UI
- `handleSave` chama `validateFiscal`. Se houver erros:
  - Mostra `toast.destructive` com até 4 erros + sufixo `(+N pendência(s))`.
  - Não envia o `update` para o Supabase.
- Sem erros: fluxo atual permanece (update + toast de sucesso).
- O upload de certificado já valida extensão; mantém comportamento.
- Indicador visual: ao tentar salvar com pendências, abre automaticamente a aba **Fiscal** (via `useState` controlando `defaultValue` → controlled `value`).

## Sem mudanças
- Schema do banco
- Demais abas (Geral / Endereço / Operação) continuam idênticas
- `App.tsx`, rotas e providers
