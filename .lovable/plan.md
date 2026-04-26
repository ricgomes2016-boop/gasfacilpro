Vou aplicar a lógica visual em todo o sistema, não apenas nas páginas já corrigidas, mantendo estabilidade e sem mexer em rotas, providers ou estrutura do App.

Escopo

1. Auditoria global de estilos
- Revisar `src/pages` e `src/components` procurando:
  - fundos sólidos sem necessidade: `bg-primary`, `bg-success`, `bg-warning`, `bg-info`, `bg-destructive`
  - cores Tailwind hardcoded: `green`, `emerald`, `blue`, `sky`, `amber`, `orange`, `red`, `rose`, `purple`, `violet`, `indigo`
  - gradientes antigos `from-*`, `to-*`
  - headers/card titles com excesso de cor sólida
  - cards com aparência quadrada, espaçamentos inconsistentes ou bordas desalinhadas

2. Aplicar padrão visual em todas as áreas
- Dashboard, Vendas, Caixa, Estoque, Financeiro, Clientes, RH, Frota, Fiscal, Marketing, Configurações, Atendimento, Operacional, Entregador, Cliente, Transportadora e Contador.
- Priorizar páginas internas do ERP e depois portais especializados, preservando identidade própria quando já existir tema específico.

3. Padrão visual a aplicar
```text
Card normal: fundo neutro + borda suave + sombra moderna
KPI/status: fundo suave /5 ou /10 + borda semântica + ícone colorido
Header de seção: cor sólida apenas quando valorizar o contexto
Ações principais: cor sólida permitida em botões e CTAs
Alertas críticos: vermelho/destructive apenas em avisos reais
Evitar: página inteira verde, blocos sólidos repetidos, cards pesados lado a lado
```

4. Criar/ajustar utilitários globais
- Reforçar classes reutilizáveis para cards modernos, status cards, painéis de filtro e headers semânticos.
- Adicionar variações suficientes para evitar que tudo fique verde:
  - financeiro/receitas: `success`
  - estoque/produtos/alertas de atenção: `warning`
  - cadastro/informação/configuração: `info`
  - ações principais: `primary`
  - risco/erro/vencido: `destructive`
  - áreas neutras: `muted/card`

5. Migração controlada página por página
- Substituir cores fixas por tokens semânticos.
- Trocar blocos sólidos grandes por cartões neutros com acentos.
- Manter cores sólidas apenas onde fazem sentido: botões, badges ativos, alertas e headers pontuais.
- Corrigir classes dinâmicas inválidas que o Tailwind não gera corretamente.

6. Validação
- Rodar verificação TypeScript/build após as alterações.
- Conferir que a migração não alterou lógica de negócio, queries, autenticação, rotas ou providers.
- Evitar refatoração estrutural; a mudança será visual e incremental.

Observação técnica
- Já existe um volume grande de ocorrências ainda espalhadas pelo sistema, então a correção será feita por padrões globais + ajustes pontuais nas páginas mais visíveis para garantir consistência sem quebrar funcionalidades.