
## Plano para fazer a opção 4 (Estoque/Carga) espelhar a rota escolhida

### Diagnóstico
Hoje a tela de jornada está desconectada da carga real:
- Em `EntregadorIniciarJornada.tsx`, a etapa **4. Estoque / Carga** usa um estado local (`estoqueCarga`) e lista produtos gerais, em vez de ler a carga real de `carregamentos_rota`.
- A rota escolhida na etapa **3. Rota de Trabalho** não é persistida de forma útil para o restante do app, então o menu **Estoque** não consegue garantir que mostre exatamente a mesma carga escolhida na jornada.
- O cálculo correto já existe no app: o estoque real do entregador vem de `carregamentos_rota` + `carregamento_rota_itens`, com saldo = **saída - vendido - transferido**.

### O que vou ajustar
1. **Trocar a etapa 4 da jornada para usar a carga real**
   - Em `src/pages/entregador/EntregadorIniciarJornada.tsx`, a opção 4 deixará de mostrar inputs manuais.
   - Ao selecionar a rota na opção 3, a tela vai buscar o `carregamento_rota` ativo (`status = "em_rota"`) daquele entregador para aquela `rota_definida_id`.
   - Em seguida, vai carregar os itens de `carregamento_rota_itens` e mostrar o mesmo resumo:
     - Carregado
     - Vendido
     - Transferido
     - Restante

2. **Fazer a etapa 4 ser o espelho do menu Estoque**
   - Vou reutilizar a mesma regra de leitura e o mesmo cálculo que já existem em `src/pages/entregador/EntregadorEstoque.tsx`.
   - O visual da opção 4 vai seguir o mesmo padrão de cards/lista do menu Estoque, para os dois ficarem sincronizados.

3. **Persistir a rota/carga escolhida ao iniciar a jornada**
   - No `handleIniciarJornada`, vou salvar no campo `observacoes` da jornada ativa (`rotas`) um JSON com:
     - `rota_definida_id`
     - `carregamento_id`
     - `cidades_selecionadas` quando existir
   - Assim, o app passa a saber exatamente qual carga foi escolhida ao iniciar a jornada, sem precisar de mudança de banco.

4. **Alinhar o menu Estoque com a jornada ativa**
   - Em `src/pages/entregador/EntregadorEstoque.tsx`, a busca vai priorizar o `carregamento_id`/`rota_definida_id` salvo na jornada ativa.
   - Se não existir esse vínculo (compatibilidade com jornadas antigas), o código mantém fallback para o carregamento ativo mais recente do entregador.

5. **Ajustar a regra da rota na jornada**
   - A seleção da rota passará a ser tratada como parte obrigatória do fluxo da jornada, porque a carga depende dela.
   - Se a rota selecionada não tiver carga iniciada, a etapa 4 mostrará um estado vazio claro em vez de produtos genéricos.

### Arquivos envolvidos
- `src/pages/entregador/EntregadorIniciarJornada.tsx`
- `src/pages/entregador/EntregadorEstoque.tsx`

### Detalhes técnicos
- Não precisa migration: as tabelas e permissões já existem e o entregador já pode ler a própria carga via RLS.
- A correção será feita reaproveitando `carregamentos_rota` e `carregamento_rota_itens`, que já são a fonte oficial da carga real.
- Também elimina a inconsistência atual da etapa 4, que hoje usa categorias locais e dados não persistidos.

### Validação
Vou validar estes cenários após implementar:
1. Selecionar uma rota com carga iniciada e ver a opção 4 preencher imediatamente.
2. Iniciar a jornada e abrir o menu **Estoque** para confirmar que os itens e totais são idênticos.
3. Fazer uma venda/transferência e confirmar atualização correta do saldo restante.
4. Selecionar uma rota sem carga iniciada e confirmar exibição de estado vazio apropriado.
