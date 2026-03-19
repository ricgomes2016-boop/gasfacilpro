

# Corrigir WhatsApp Multi-Loja (Evolution API)

## Problemas Encontrados

1. **`empresa_id` incorreto no sync**: Ao salvar config Evolution, o código busca `empresa_id` de `user.user_metadata` (que não existe) — deveria usar `useEmpresa().empresa.id`. Resultado: o upsert em `whatsapp_gateway_instances` falha silenciosamente ou insere com string vazia.

2. **Defaults hardcoded da Central Gás**: A URL base (`http://187.77.52.241:8000`) e token (`gasfacilpro2026`) são inseridos automaticamente para todas as empresas. Cada empresa deveria configurar seus próprios dados de servidor Evolution.

3. **Menu "WhatsApp" não abre direto**: O link `Atendimento > WhatsApp` navega para `/integracoes?open=whatsapp`, mas não há lógica para detectar o parâmetro `?open=whatsapp` e abrir o diálogo automaticamente.

4. **Instance name sem isolamento**: O `instance_id` (nome da instância no Evolution) pode colidir entre empresas. Deveria incluir um identificador único da empresa/unidade (ex: `maniadagua_matriz`).

## Correções

### 1. Usar `useEmpresa` para obter `empresa_id`
No `Integracoes.tsx`, importar `useEmpresa` e usar `empresa.id` no upsert de `whatsapp_gateway_instances` em vez de `user.user_metadata.empresa_id`.

### 2. Remover defaults hardcoded
Não preencher automaticamente `wpBaseUrl` e `wpToken` com valores da Central Gás. Deixar campos vazios para que cada empresa configure seus dados. Mostrar placeholder com exemplo.

### 3. Auto-abrir diálogo WhatsApp via URL
Ao montar a página, verificar `searchParams.get("open") === "whatsapp"` e abrir `setWhatsappDialogOpen(true)` automaticamente.

### 4. Gerar instance_name único por unidade
Sugerir automaticamente um `instance_id` baseado no slug da empresa + nome da unidade (ex: `maniadagua_matriz`), evitando colisões no servidor Evolution compartilhado.

## Detalhes Técnicos

- **Arquivo**: `src/pages/Integracoes.tsx`
- **Linha 552**: trocar `(await supabase.auth.getSession()).data.session?.user.user_metadata.empresa_id || ""` por `empresa?.id || ""`
- **Linhas 600-601**: remover defaults hardcoded, usar campos vazios
- **Adicionar `useEffect`** para ler `?open=whatsapp` do URL e abrir diálogo
- **Gerar `wpInstanceId`** automaticamente quando `wpUnidadeId` muda: combinar slug da empresa com nome da unidade normalizado
- **Importar**: `useEmpresa` de `@/contexts/EmpresaContext` e `useSearchParams` de `react-router-dom`

