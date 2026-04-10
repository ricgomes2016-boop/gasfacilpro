
Diagnóstico
- Verifiquei a rota real do sistema publicado: `/clientes/cadastro` carrega `src/pages/clientes/CadastroClientes.tsx` via `src/routes/clientesRoutes.ts`.
- Existe um segundo formulário em `src/components/clientes/ClienteFormDialog.tsx`, mas ele é usado por `src/pages/Clientes.tsx`, que não é a rota principal publicada do ERP. Então o modal que realmente importa para `app.gasfacilpro.com.br` é o inline de `CadastroClientes.tsx`.
- Não há sinal de diferença de banco causando isso. Esse problema é de interface/CSS; os dados do banco não controlam largura nem responsividade do modal.
- O ponto mais provável está no componente base `src/components/ui/dialog.tsx`, que ainda tem classes móveis conflitantes:
```text
base do DialogContent: w-[95vw] max-w-lg
modal da página:       max-w-[95vw] sm:max-w-2xl
```
Essas regras de `max-width` ficam no mesmo elemento. No preview uma pode “ganhar”; no build publicado outra pode prevalecer. Isso explica o comportamento “preview certo / publicado diferente”.

Plano de correção
1. Corrigir o `DialogContent` global
- Atualizar `src/components/ui/dialog.tsx` para o padrão mobile do ERP, removendo o conflito de largura no mobile.
- Deixar o mobile resolvido no componente base e usar sobrescrita apenas a partir de `sm`.

2. Ajustar o modal real da rota publicada
- Em `src/pages/clientes/CadastroClientes.tsx`, manter somente o ajuste de desktop (`sm:max-w-2xl`) e parar de disputar `max-width` no mobile com o componente base.
- Preservar `overflow-x-hidden`, `min-w-0`, grids empilhando em telas pequenas e botões em coluna no celular.

3. Sincronizar o segundo cadastro de cliente
- Aplicar o mesmo padrão em `src/components/clientes/ClienteFormDialog.tsx` para evitar nova divergência entre os dois formulários.

4. Garantia de funcionamento
- Gerar build para validar o CSS de produção.
- Publicar novamente.
- Validar especificamente em largura de 384px:
  - abrir `/clientes/cadastro`
  - clicar em “Novo Cliente”
  - confirmar que não existe scroll horizontal
  - confirmar que todos os campos e botões ficam dentro da tela

5. Se ainda houver diferença após isso
- Comparar a versão publicada no domínio Lovable com `app.gasfacilpro.com.br` para verificar propagação/caching do domínio customizado.
- Mas primeiro vou eliminar o conflito de classes, porque hoje ele é a causa mais provável e está no código.

Detalhe técnico
- A correção principal não é no banco.
- A correção principal também não é no conteúdo dos campos.
- A correção principal é tornar o `DialogContent` determinístico em produção, por exemplo neste padrão:
```text
Dialog base:
w-[calc(100vw-1rem)] max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto

Modal de clientes:
sm:max-w-2xl overflow-x-hidden
```
Assim o mobile deixa de depender de duas classes concorrendo pelo mesmo `max-width`, o que é exatamente o tipo de diferença que pode aparecer entre preview e publicado.
