

## Restaurar visibilidade do painel "Importar XML do Outlook" em Transportadora › Compras

### Diagnóstico
O painel **continua existindo no código** (`src/pages/transportadora/TranspCompras.tsx`, linhas 379–430), com botões **Importar XML**, **Buscar agora** e **Reprocessar mês**, e as edge functions `importar_xml_outlook` e `reprocessar_xml_outlook` estão íntegras. Ou seja: nada foi removido.

O problema é **visual / de layout**: o painel foi colocado dentro do mesmo container flex do cabeçalho (`flex gap-3 items-end flex-wrap`), junto de Período, Filial e botão "Nova Compra". Em telas largas ele "encolhe" entre os outros itens; em telas estreitas tenta ocupar `w-full` mas fica comprimido entre cabeçalho e abas, passando despercebido. Some-se a isso que ele fica **acima das Tabs** (Compras / Análise GLP / Produtos), então quem entra direto na aba "Compras" e rola para ver KPIs nem repara que o painel está logo acima.

### O que será entregue

**1. Mover o painel para uma seção própria, com destaque**
- Tirar o painel de dentro do `<div className="flex gap-3 items-end flex-wrap">` do cabeçalho.
- Posicionar como **um Card próprio**, logo abaixo do cabeçalho e **antes das Tabs**, ocupando 100% da largura.
- Título visível: **"📧 Importar NF-e do Outlook"** com ícone e badge "Conectado".

**2. Layout responsivo limpo**
- Linha 1: campo "Filtrar remetente" (flex-1) + "Últimos (dias)" (w-32).
- Linha 2: três botões lado a lado — **Importar XML** (primário), **Buscar agora** (outline), **Reprocessar mês** (secondary).
- Rodapé: "Última importação: dd/MM HH:mm · X novos · Y já existentes · Z erros".

**3. Aviso quando o Outlook não estiver conectado**
- Verificar status do conector Microsoft Outlook via `standard_connectors`. Se desconectado, exibir alerta amarelo: *"Outlook desconectado. Reconecte em Integrações para importar XMLs por e-mail."* com botão de atalho.

**4. Atalho redundante dentro da aba "Compras"**
- Adicionar botão pequeno **"Importar XML do e-mail"** no topo da `ComprasListaTable`, que abre/rola até o painel — para quem entra direto na aba e não percebe o card acima das Tabs.

**5. Corrigir bug pequeno encontrado**
- O segundo botão (linha 410, "Buscar agora") chama a mesma função `importarXmlOutlook` do botão "Importar XML" — são duplicados. Vou unificar em **um único botão** "Buscar XMLs no Outlook" para evitar confusão, mantendo "Reprocessar mês" como ação separada.

### Arquivos alterados
- `src/pages/transportadora/TranspCompras.tsx` — mover painel para fora do cabeçalho, transformar em Card, simplificar botões, adicionar verificação de status do Outlook.

### Critérios de aceite
- Em `/transportadora/compras` aparece um Card destacado **"Importar NF-e do Outlook"** logo abaixo do título "Compras" e antes das Tabs.
- O Card mostra status do Outlook (conectado/desconectado) e última importação.
- Botões "Buscar XMLs no Outlook" e "Reprocessar mês" funcionam (chamam as mesmas edge functions atuais).
- Em mobile (≤640px) o Card mantém botões empilhados sem cortar texto.
- Se o conector Outlook estiver desconectado, surge alerta com link para reconectar.

