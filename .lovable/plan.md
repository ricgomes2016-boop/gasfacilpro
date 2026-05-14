## Objetivo

Adicionar um diagnóstico do certificado A1 (e-CNPJ) e uma forma rápida de validar se a assinatura PAdES gerada está correta — sem precisar emitir um orçamento real.

---

## 1. Edge Function: novo modo "diagnóstico" no `assinar-pdf`

Adicionar `acao: "diagnostico" | "assinar" | "amostra"` no body (default `assinar`, mantém compatibilidade).

- **`diagnostico`** (não assina nada):
  - Baixa o `.pfx` do bucket `certificados-fiscais`
  - Abre com `node-forge` usando a senha cadastrada
  - Retorna: `titular`, `cnpj`, `emissor` (CN do issuer), `validade_inicio`, `validade_fim`, `serial`, `algoritmo`, `dias_para_vencer`, `cadeia_icp_brasil` (true/false a partir do issuer "AC ... ICP-Brasil"), `tamanho_chave`
  - Erros granulares: `pfx_nao_encontrado`, `senha_invalida`, `pfx_corrompido`, `vencido`

- **`amostra`** (gera + assina um PDF de teste de 1 página):
  - Cria um PDF mínimo com `pdf-lib` ("Documento de teste — Assinatura Digital — <data>")
  - Aplica o mesmo fluxo de `assinar` (placeholder + P12Signer + SignPdf)
  - Retorna `pdfBase64Assinado` para download

## 2. Cliente: helper de diagnóstico

Em `src/services/digitalSignature/signPdfClient.ts`, adicionar:
- `diagnosticarCertificado(unidadeId)` → retorna o objeto de diagnóstico
- `gerarPdfAmostraAssinado(unidadeId)` → baixa um PDF assinado de teste

## 3. UI: nova página "Diagnóstico de Assinatura Digital"

Rota: `/configuracoes/assinatura-digital/diagnostico` (ou um card dentro da página atual de Unidades, no bloco "Certificado A1").

Conteúdo:
- **Bloco 1 — Status do certificado** (badge verde/vermelho)
  - Titular, CNPJ, Emissor, Validade (com countdown), Serial, ICP-Brasil ✓/✗
- **Bloco 2 — Teste de assinatura**
  - Botão **"Gerar PDF de teste assinado"** → faz download de `teste-assinatura.pdf`
  - Instruções curtas: abrir no **Adobe Acrobat Reader** → painel "Assinaturas" deve mostrar:
    - Assinado por: <titular>
    - "A assinatura é VÁLIDA" (após confirmar a Raiz ICP-Brasil como confiável; Adobe tem opção "Adicionar à lista de identidades confiáveis")
    - Data, motivo e local
- **Bloco 3 — Logs**
  - Última resposta da edge function em formato cru (collapsible) para debug

## 4. Acesso rápido a partir de Orçamentos › Fundepar

No diálogo onde já existe o switch "Assinar digitalmente", adicionar link:
> "Não tem certeza se o certificado funciona? Testar agora →"
que abre a página de diagnóstico em nova aba.

---

## Detalhes técnicos

- **Validação ICP-Brasil**: checar se `cert.issuer.getField("CN").value` contém `"ICP-Brasil"` ou `"AC "`. A validação completa de cadeia exige as ACs raízes do ITI; isso fica fora do escopo (Adobe Reader já faz essa validação ao abrir o PDF).
- **PAdES vs CMS detached**: o `@signpdf/signpdf` aplica CMS PKCS#7 em `/Contents` com `/SubFilter /adbe.pkcs7.detached` — Adobe Reader reconhece como **PAdES-B-B**. Sem timestamp (TSA) — adicionar TSA ICP-Brasil é opcional e fica fora do escopo desta etapa.
- **Tamanho do placeholder**: 16384 bytes já está adequado para certificados A1 ICP-Brasil.
- **Sem mudanças de DB**: usa o `.pfx` já cadastrado em `unidades.certificado_a1_path/senha/validade/titular`.
- **Sem novas dependências**: tudo já está no `assinar-pdf`.

## Como você vai validar

1. Abre **Configurações › Assinatura Digital › Diagnóstico**
2. Confirma os dados do certificado (titular = razão social, CNPJ correto, validade futura, ICP-Brasil ✓)
3. Clica **"Gerar PDF de teste assinado"** → abre no Adobe Reader
4. Painel "Assinaturas" mostra a assinatura com seu nome/CNPJ. Se aparecer "validade desconhecida" basta marcar a Raiz ICP-Brasil como confiável uma vez.
5. Volta em Orçamentos › Fundepar, ativa o switch e gera um PDF real — o carimbo continua igual e a assinatura digital é embutida no arquivo.
