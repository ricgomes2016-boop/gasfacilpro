

## Atualizar imagens e dicas de segurança — Japa Gás (padrão brasileiro)

As 6 imagens atuais da seção "Dicas de Segurança" mostram botijões em formatos europeus/asiáticos (verde-água com válvula exposta, vermelho alto tipo LPG europeu) que não correspondem ao **botijão P13 brasileiro padrão** (cilíndrico baixo, cor cinza/prata com alça superior, lacre plástico colorido no registro).

### 1. Pesquisa de referência (fontes brasileiras)

Consultar conteúdo oficial de:
- **ABNT NBR 13523 / 15514** (instalações residenciais de GLP)
- **Sindigás** (Sindicato Nacional das Empresas Distribuidoras de GLP) — cartilha "Uso Seguro do Gás"
- **Corpo de Bombeiros (PR/SP)** — orientações públicas
- **Ultragaz, Liquigás, Copagaz, Nacional Gás** — páginas de segurança ao consumidor

Para garantir que as dicas reflitam o padrão real brasileiro (mangueira amarela NBR 8613 com validade de 5 anos impressa, regulador com selo INMETRO trocado a cada 5 anos — não 10, lacre plástico com cor do ano, posição vertical em área externa ventilada, etc.).

### 2. Revisar conteúdo das 6 dicas

Ajustar textos com base na pesquisa:

| # | Título | Ajuste principal |
|---|--------|------------------|
| 1 | Verifique o lacre do botijão | Mencionar lacre plástico colorido e selo INMETRO |
| 2 | Instale em área ventilada | Reforçar "área externa, nunca dentro de armário fechado" (NBR 13523) |
| 3 | Teste com água e sabão | Manter — é o padrão recomendado pelo Sindigás |
| 4 | Mangueira e regulador | **Corrigir**: mangueira **amarela NBR 8613** trocar a cada 5 anos, regulador a cada **5 anos** (não 10) |
| 5 | Em caso de vazamento | Acrescentar "não ligue/desligue interruptores" e ligue 193 |
| 6 | Mantenha em pé, longe do calor | Reforçar distância mínima de 1,5m do fogão |

### 3. Regerar as 6 imagens com padrão brasileiro

Gerar novas fotos via Lovable AI (`google/gemini-3.1-flash-image-preview` para qualidade superior) com prompts explícitos descrevendo:

- **Botijão P13 brasileiro**: cilindro de aço cinza/prata de ~13kg, alça superior em arco, base circular preta, registro/válvula no topo com lacre plástico colorido, etiqueta com logo da distribuidora
- **Cozinha brasileira**: ambiente típico residencial brasileiro (não europeu)
- **Mangueira amarela** visível nas fotos de instalação
- **Regulador prata com selo INMETRO** circular

Salvar substituindo `src/assets/japa-gas/seguranca-{1..6}.jpg`.

### 4. Arquivos

- **Editar**: `src/pages/publico/JapaGas.tsx` (textos das dicas)
- **Substituir**: `src/assets/japa-gas/seguranca-1.jpg` … `seguranca-6.jpg` (novas imagens padrão BR)

### Observação técnica

- Usar `google/gemini-3.1-flash-image-preview` (qualidade pro, rápido) ao invés de `gemini-2.5-flash-image` para garantir realismo dos detalhes (lacre, INMETRO, mangueira amarela).
- Manter paleta visual coerente (tons quentes/teal de fundo) para harmonia com o restante do site.
- Sem alterações de layout, rotas ou backend.

