

## Diagnóstico

O código atual do modal em `CadastroClientes.tsx` (linhas 1322-1548) **ja possui** as classes responsivas corretas (`w-[95vw] sm:max-w-2xl p-3 sm:p-6`, grids `grid-cols-1 sm:grid-cols-2`, etc). O componente base `DialogContent` em `dialog.tsx` tambem ja tem `w-[95vw] max-h-[90vh] overflow-y-auto`.

Isso indica que o site publicado pode estar servindo uma versao anterior em cache. Porem, para garantir que nao haja nenhum conflito de CSS, o plano abaixo aplica pequenos ajustes de seguranca.

## Plano

### 1. Forcar max-width explicito no mobile
No `CadastroClientes.tsx`, trocar `w-[95vw] sm:max-w-2xl` por `max-w-[95vw] sm:max-w-2xl` para evitar conflito com o `max-w-lg` base do `DialogContent`.

### 2. Adicionar `overflow-hidden` no container interno
Garantir que o conteudo do formulario nunca ultrapasse o dialog com `overflow-x-hidden` no wrapper.

### 3. Verificar o mesmo padrao no `ClienteFormDialog.tsx`
Aplicar as mesmas classes para consistencia (caso seja usado em alguma outra rota).

### 4. Republicar
Apos as alteracoes, o usuario deve clicar em **Publicar > Atualizar** e limpar o cache do navegador (ou acessar em aba anonima) para confirmar.

---

**Nota importante**: Se apos publicar o problema persistir, o mais provavel e cache do navegador. Recomenda-se acessar `app.gasfacilpro.com.br` em uma aba anonima/privada para testar.

