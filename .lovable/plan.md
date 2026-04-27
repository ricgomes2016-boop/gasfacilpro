Plano para extrair o design da imagem e criar um novo tema em Personalização Visual / Aparência.

1. Criar um novo tema global inspirado na referência
- Nome sugerido: “Weihu Pastel” ou “Dashboard Pastel”.
- Visual: SaaS moderno, claro, minimalista, com sidebar suave e cards coloridos em tons pastel.
- Manter o tema atual “SaaS Moderno” intacto e adicionar este como uma nova opção.

2. Paleta extraída da imagem
- Fundo geral: cinza muito claro / gelo `#F4F5F7`.
- Cards e painéis: branco suave `#FFFFFF` com leve transparência.
- Texto principal: quase preto `#15151A`.
- Texto secundário: cinza `#6F7280`.
- Primária roxa: `#6D4AFF`.
- Primária escura/ícone: `#4F32D8`.
- Azul pastel: `#DDEBFF` / destaque `#5C83C9`.
- Lilás pastel: `#E7DFFF` / destaque `#6C4DB5`.
- Pêssego/laranja pastel: `#FFE5C4` / destaque `#B87422`.
- Verde mint: `#CFF6E9` / destaque `#2FA36E`.
- Rosa pastel: `#FFD9F1` / destaque `#C45AAB`.

3. Fonte e estilo visual
- Usar a fonte já compatível com o projeto: `Plus Jakarta Sans`, próxima do visual arredondado da imagem e alinhada à memória do projeto.
- Pesos: 500 para textos normais, 600/700 para títulos e menus.
- Cantos arredondados mais fortes: 18px a 24px em cards, botões e inputs.
- Sombras muito suaves, sem bordas pesadas.

4. Adicionar o tema em Aparência / Personalização Visual
- Atualizar `src/lib/brandThemes.ts` para incluir um novo `BrandThemeId`.
- Atualizar `src/styles/brand-themes.css` com a classe do novo tema.
- Adicionar o preset em `src/pages/config/PersonalizacaoVisual.tsx`, na seção “Temas Prontos”, com preview de gradiente/paleta.
- Garantir que ao clicar no tema ele aplique o tema global via `useDashboardTheme`, como o “SaaS Moderno”.

5. Ajustar tokens globais do tema, sem alterar lógica
O novo tema vai controlar somente variáveis visuais:
- `--background`, `--foreground`, `--card`, `--muted`, `--primary`, `--secondary`, `--accent`, `--border`, `--input`, `--ring`.
- Sidebar com fundo claro/pastel inspirado na imagem, não necessariamente escura.
- Estados ativos com “pill” branco e texto roxo.
- Cards com sombras leves e bordas translúcidas.

6. CSS escopado para o tema novo
Adicionar regras globais somente quando o tema estiver ativo, por exemplo:
- Cards mais arredondados e com sombra suave.
- Inputs com aparência de busca moderna.
- Tabelas mais leves, com hover sutil.
- Badges em tons pastel.
- Sidebar com fundo claro, divisórias suaves e item ativo em pill.

7. Não mexer no que foi proibido
- Não alterar rotas.
- Não alterar funcionalidades.
- Não refatorar `App.tsx`, providers ou estrutura geral.
- Não alterar regras de banco, autenticação ou RLS.
- Não substituir componentes por uma nova arquitetura.

8. Validação
- Rodar checagem TypeScript após as alterações.
- Conferir se o tema aparece em Personalização Visual e em Configurações/Aparência, quando aplicável.
- Confirmar que os outros temas continuam disponíveis e funcionando.

Detalhes técnicos previstos:
```text
Arquivos principais:
- src/lib/brandThemes.ts
- src/styles/brand-themes.css
- src/pages/config/PersonalizacaoVisual.tsx

Possível id do tema:
- pastel-dashboard

Classe CSS:
- brand-theme-pastel-dashboard
```

Resultado esperado:
O sistema terá um novo tema selecionável em Personalização Visual/Aparência, extraído da imagem enviada: visual claro, moderno, SaaS, com roxo principal, tons pastel em cards/status, sidebar suave e componentes arredondados, mantendo toda a lógica atual intacta.