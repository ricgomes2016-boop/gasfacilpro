# Conferência de Estoque — saldo inicial editável (Master) e novos cards

## O que muda

### 1. Tabela por tipo de usuário
- **Usuário Master**: vê o fluxo completo (Saldo inicial, Entrada, Total inicial, Cheio, Transferência, Venda esperada) e pode **editar o saldo inicial**.
- **Demais usuários**: a tabela volta a ser como antes — por produto (P13, P20, P45, Água) apenas **Cheio, Vazio e Total**.

### 2. Editar saldo inicial (só Master)
- Ao tocar no saldo inicial aparece a pergunta: **"Tem certeza que deseja editar o saldo inicial?"**.
- Confirmando, abre o campo para digitar o novo valor (cheio e vazio) e salvar.
- O valor editado substitui o calculado (contagem do dia anterior) para aquela loja, produto e dia, e fica registrado quem alterou e quando.
- A regra também é garantida no servidor: só Master consegue gravar.

### 3. Cards acima da tabela (visual renovado)
Sem soma geral de todos os produtos. Quatro cards, cada um com uma linha por produto:

```text
Saldo inicial          Cheios        Vazios        Venda esperada
P13  200 cheio/300 vazio  P13  186    P13  300      P13  136
P20   10 cheio/ 10 vazio  P20    2    P20   10      P20    2
P45   10 cheio/ 10 vazio  P45    6    P45   10      P45    1
Água  20 cheio/ 10 vazio  Água  20    Água  10      Água   5
```
- Venda esperada (em cheios) aparece para todos os usuários, para conferir se o vendido está correto.
- Cards com ícone, cor própria (venda esperada em verde), números grandes alinhados e boa leitura no celular (1 coluna em telas pequenas, 2 no tablet, 4 no computador).

## Detalhes técnicos
- "Master" = papéis `super_admin` e `admin` (via `hasAnyRole` + `has_role` no banco). Ajustável se Master for outro papel.
- Nova tabela `estoque_conferencia_saldo_ajustes` (data, unidade_id, empresa_id, produto_grupo, cheio, vazio, editado_por, timestamps; unique por data+unidade+grupo), GRANTs, RLS: leitura por unidades do usuário; insert/update só `admin`/`super_admin`.
- `conferenciaFluxo.ts`: saldo inicial = ajuste se existir, senão contagem do dia anterior; testes para o ajuste sobrepondo o valor e para o exemplo 500+200−100−400=200.
- `ConferenciaEstoque.tsx`: `isMaster` controla colunas da tabela/mobile e botão de edição com `AlertDialog` de confirmação; cards substituídos por um componente de card por produto usando tokens do design system.
