## Ajustes em `AdminUnidades.tsx`

Apenas mudanças de front-end na tela `/admin/unidades` para esclarecer as "Matrizes" de outras empresas SaaS.

### Mudanças

1. **Carregar todas as empresas (ativas e inativas)**
   - Remover o filtro `ativo = true` no carregamento de `empresas`.
   - Manter o flag `ativo` no objeto em memória para uso na UI.

2. **Coluna "Empresa" sempre preenchida**
   - Exibir o nome da empresa mesmo quando inativa.
   - Sub-label discreto "Empresa inativa" abaixo do nome quando `ativo = false`.
   - Eliminar o `—` que dava a falsa impressão de unidade órfã.

3. **Filtro "Mostrar apenas empresas ativas"**
   - Toggle/checkbox no topo da listagem, ligado por padrão.
   - Quando ligado: oculta unidades cuja empresa está inativa (esconde as Matrizes "fantasma" de tenants desativados).
   - Quando desligado: mostra tudo, útil para auditoria super_admin.

4. **Legenda explicativa**
   - Pequeno aviso/tooltip informando que toda nova empresa SaaS recebe automaticamente uma unidade "Matriz" via trigger do sistema.

### O que NÃO muda

- Trigger `trg_create_default_unidade_for_empresa` permanece.
- Matrizes existentes não são apagadas.
- RLS e isolamento entre empresas permanecem intactos.
- Nenhuma alteração em outras telas.

### Próximo passo opcional (não incluído)

Se quiser, posso depois listar as empresas inativas e propor desativar/remover suas Matrizes — mas só com confirmação explícita.