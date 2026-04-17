

## Diagnóstico: por que você não encontrou o tema GásMais

O código está implementado e o toggle existe — está em **Configurações → card "Aparência"**, logo abaixo do seletor Claro/Escuro/Sistema (linha 558 de `Configuracoes.tsx`, componente `GasmaisThemeToggle`).

Você está atualmente na rota `/auth` (tela de login), por isso não vê. Para encontrar:

1. Faça login no ERP
2. Menu lateral → **Configurações**
3. Role a página até o card **"Aparência"** (ícone de sol)
4. Abaixo de "Tema" tem o switch **"Tema GásMais (Dashboard + Sidebar)"**
5. Ative o switch → vá para o **Dashboard** e veja a nova paleta laranja/azul + sidebar escura

## Possíveis problemas a investigar (caso ainda não apareça depois do login)

Se mesmo após login você não ver o toggle no card Aparência, as causas prováveis são:

1. **Card Aparência abaixo da dobra** — só aparece rolando. Solução: nenhuma, é só rolar.
2. **Permissão / RBAC esconde a página inteira** — improvável já que você acessou antes.
3. **Cache do navegador** — versão antiga da página Configurações sem o novo componente.

## Plano de melhoria (se você quiser que eu mexa)

Para ficar mais visível e não passar despercebido, posso:

- **Mover o toggle para o topo do card Aparência** (acima do ThemeSelector), com um badge "Novo".
- **Adicionar um atalho rápido no Header** (ícone de paleta) que ativa/desativa direto, sem ir em Configurações.
- **Mostrar um banner discreto no Dashboard** ("Experimente o novo tema GásMais →") na primeira visita, dispensável.

Me confirme se quer que eu aplique alguma dessas melhorias OU se é apenas questão de você logar e rolar até o card. Não vou alterar nada agora — aguardo sua decisão.

