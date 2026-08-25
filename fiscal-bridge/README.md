# fiscal-bridge

Serviço externo (Node.js 20 + TypeScript) que executa a comunicação **mTLS com a SEFAZ**
em nome das Edge Functions. O runtime das functions (Deno/Rustls) não conclui o handshake
exigido pelo IIS da SEFAZ nos webservices `NFeDistribuicaoDFe` e `NFeRecepcaoEvento4`;
este bridge resolve isso usando o módulo `https`/`tls` do Node com TLS 1.2, PFX + senha,
HTTP/1.1 e sem keepAlive.

## Endpoints internos

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/health` | Healthcheck sem informação sensível |
| POST | `/dfe/distribuicao` | Distribuição DF-e por último NSU (`{ unidadeId, cnpj, ultNSU }`) |
| POST | `/dfe/consulta-chave` | Consulta/download do XML por chave (`{ unidadeId, cnpj, chave }`) |
| POST | `/dfe/manifestar` | Ciência, Confirmação, Desconhecimento, Operação não Realizada |

Todas as rotas POST exigem assinatura HMAC (abaixo). Respostas são sempre JSON
`{ ok, motivo?, mensagem?, ... }`.

## Autenticação Edge → bridge

Cada requisição envia:

- `x-bridge-timestamp`: epoch em milissegundos
- `x-bridge-nonce`: UUID único por requisição
- `x-bridge-signature`: `HMAC_SHA256(FISCAL_BRIDGE_SECRET, "<timestamp>.<nonce>.<caminho>.<corpo>")` em hex

O bridge valida a janela de **120 s**, rejeita nonce repetido (anti-replay) e compara a
assinatura em tempo constante. O corpo assinado é exatamente o corpo transmitido.

## Certificado

O PFX **não** trafega entre Edge e bridge. O bridge o baixa sob demanda do bucket privado
`certificados-fiscais` (`unidades.certificado_a1_path` / `certificado_a1_senha`) usando a
service role configurada por variável de ambiente, mantém tudo **apenas em memória** durante
a chamada, zera o buffer ao final e nunca grava em disco. Antes de falar com a SEFAZ, o bridge
valida vencimento e a correspondência entre o CNPJ da unidade, o CNPJ informado pela Edge e o
CNPJ do certificado.

## Logs

Logs em JSON, com sanitização obrigatória: PEM, base64 longo, XML, números longos (CNPJ/chave),
senhas e tokens são substituídos por marcadores. Nada sensível é devolvido nas mensagens de erro.

## Implantação em VPS (Docker)

```bash
git clone <repo> && cd fiscal-bridge
cp env.example .env            # preencha os valores; chmod 600 .env
openssl rand -hex 32           # gere FISCAL_BRIDGE_SECRET

docker build -t fiscal-bridge .
docker run -d --name fiscal-bridge \
  --restart unless-stopped \
  --env-file .env \
  -p 127.0.0.1:8443:8443 \
  fiscal-bridge
```

O container escuta **apenas em 127.0.0.1**. O HTTPS público é obrigatório e fica no proxy
reverso (Caddy/Nginx + Let's Encrypt):

```
fiscal.seudominio.com.br {
  reverse_proxy 127.0.0.1:8443
}
```

### Firewall

```bash
ufw default deny incoming
ufw allow 22/tcp
ufw allow 443/tcp
ufw enable
```

A porta 8443 nunca deve ser exposta à internet. Saída necessária: `www1.nfe.fazenda.gov.br:443`
e o host do backend Lovable Cloud.

### Segredos nas Edge Functions

Cadastre em Configurações do Projeto → Secrets:

- `FISCAL_BRIDGE_URL` = `https://fiscal.seudominio.com.br`
- `FISCAL_BRIDGE_SECRET` = mesmo valor do `.env` do bridge

Sem essas duas variáveis, as functions respondem `bridge_nao_configurado` com orientação
clara e **não** tentam falar diretamente com a SEFAZ.

### Rotação do segredo

1. Gere o novo valor (`openssl rand -hex 32`).
2. Atualize `FISCAL_BRIDGE_SECRET` nos Secrets do projeto.
3. Atualize o `.env` do VPS e reinicie: `docker restart fiscal-bridge`.
4. Faça uma sincronização de teste; em caso de erro `bridge_nao_autorizado`, os valores divergem.

Rotação recomendada a cada 90 dias, ou imediatamente após qualquer suspeita de vazamento.

### Healthcheck

```bash
curl -fsS https://fiscal.seudominio.com.br/health
# {"ok":true,"servico":"fiscal-bridge","ambiente":"producao"}

docker inspect --format '{{.State.Health.Status}}' fiscal-bridge
docker logs --tail 50 fiscal-bridge
```

## Desenvolvimento

```bash
npm install
npm run typecheck
npm test        # assinatura/replay, sanitização e parsing SOAP/gzip/base64
npm run dev
```

---

## Modo local (agente no PC do escritório, sem VPS)

Quando não há servidor, o mesmo código roda como **agente local**: ele lê o certificado A1
direto do disco do PC e atende apenas `http://127.0.0.1:8787`. O navegador (aba do ERP) chama
o agente, recebe os XMLs e envia ao backend para validação/gravação — o agente nunca fala com
o banco e o `.pfx` nunca sai da máquina.

```text
Navegador (ERP)  --http://127.0.0.1:8787-->  Agente local (A1 no disco)  --mTLS-->  SEFAZ
       |                                            XMLs brutos
       +---- função "dfe-ingerir" (valida e grava com RLS) ---> banco
```

### Instalação profissional no Windows (recomendada)

Tudo é feito por um instalador idempotente. **Nada de senha em texto**: a senha do
certificado e o token de pareamento são cifrados com **DPAPI (usuário atual)** e gravados
como blob em `%LOCALAPPDATA%\GasFacil\AgenteFiscal`, com ACL só para o seu usuário e SYSTEM.

1. Instale o **Node.js 20 ou superior** (https://nodejs.org).
2. Copie a pasta `fiscal-bridge` para o PC (ex.: `C:\gasfacil\fiscal-bridge`).
3. Certificado A1 — duas formas aceitas:
   - **Automática (recomendada):** se o e-CNPJ já estiver instalado no Windows
     (`Cert:\CurrentUser\My`), o instalador seleciona sozinho pelo CNPJ da unidade.
     Só aceita certificado **vigente e com chave privada**; exporta uma **cópia
     operacional** para a pasta privada usando uma **senha aleatória gerada em memória**,
     protegida na hora com DPAPI. Essa senha nunca é exibida, nem passa por linha de
     comando, nem é gravada em texto. O certificado original permanece instalado no Windows.
   - **Manual:** informe o caminho de um arquivo `.pfx` e a senha (digitada oculta).
     Use `-Pfx "C:\caminho\certificado.pfx"` para forçar esse modo.
   Em nenhum caso o sistema baixa o certificado do servidor para o navegador.
4. Clique com o botão direito em `scripts\instalar-agente.bat` → **Executar**.
   O instalador vai:
   - conferir a versão do Node e instalar dependências/compilar;
   - pedir CNPJ e UF e então localizar o certificado no repositório do Windows
     (ou pedir o `.pfx` e a senha, digitada oculta com `-AsSecureString`);
   - **validar o PFX e o CNPJ** antes de concluir;
   - gravar a cópia operacional do certificado na pasta privada com ACL restrita
     (o original — arquivo ou repositório do Windows — permanece intacto);
   - gerar um token forte (32 bytes) e proteger senha + token com DPAPI;
   - registrar a **Tarefa Agendada** de início automático no logon (janela oculta);
   - iniciar o agente, aguardar o `/health` e mostrar a URL e o token na tela.
5. No ERP, em **DF-e Recebidos → Configurar agente local**, informe `http://127.0.0.1:8787`
   e cole o token exibido.

Reinstalar/reparar: rode o instalador de novo — ele reaproveita a configuração existente e
só pergunta o que faltar. Nenhum passo apaga o `.pfx` de origem.

### Comandos do dia a dia

| Script | O que faz |
| --- | --- |
| `scripts\iniciar.ps1` | Inicia o agente (se já estiver rodando, não duplica) |
| `scripts\parar.ps1` | Encerra o agente |
| `scripts\status.ps1` | Mostra estado, porta, ambiente, validade do certificado |
| `scripts\mostrar-token.ps1` | Revela/copia o token de pareamento (só para o usuário local) |
| `scripts\desinstalar.ps1` | Remove tarefa agendada, segredos e a cópia privada do PFX |

Logs: `%LOCALAPPDATA%\GasFacil\AgenteFiscal\logs\agente-fiscal.log`, sanitizados e com
rotação básica. Nunca gravam senha, token, PFX, XML nem CNPJ completo.

### Segurança do modo local

- A senha e o token só existem em memória durante o uso; em disco, apenas o blob DPAPI.
  Fora do Windows o agente **falha com orientação** em vez de voltar para texto puro.
- `/health` responde com o CNPJ mascarado (`**.***.***/****-99`) e só para **origens
  autorizadas** (CORS); `/diagnostico` exige o token.
- **Risco conhecido (XSS):** o token fica no `localStorage` do navegador para o ERP poder
  chamar o agente. Um XSS no ERP conseguiria usar o agente enquanto ele estiver ligado —
  por isso o agente escuta só em `127.0.0.1`, aceita apenas origens conhecidas e o token
  nunca aparece em logs ou mensagens de erro. Rode o instalador de novo para trocar o token
  em caso de suspeita.
- O certificado A1 **nunca** é baixado do servidor para o navegador: a cópia local é um
  passo manual e explícito seu.

### Manifestação pelo agente local (como a nuvem confia nisso)

Ciência, Confirmação, Desconhecimento e Operação não Realizada rodam no agente. O navegador
**não** pode dizer "deu certo" — ele conhece o token e poderia forjar qualquer comprovante.
Por isso o agente devolve o **XML do evento assinado (XMLDSig) com a chave privada do A1**, e
a Edge `dfe-evento-ingerir` valida antes de gravar:

1. assinatura RSA-SHA1 sobre o `<SignedInfo>`;
2. digest SHA-1 do `<infEvento>`;
3. chave/tipo/CNPJ coerentes dentro do XML assinado;
4. a chave pública que assinou é a mesma do A1 da unidade guardado no cofre.

Se o certificado de referência não existir no cofre, a Edge **recusa** e explica — em vez de
registrar uma manifestação sem prova. A chamada à SEFAZ não é refeita na nuvem.

### Docker (alternativa Linux/teste)

```bash
docker run --rm -p 127.0.0.1:8787:8787 \
  -e BRIDGE_MODE=local -e PORT=8787 \
  -v /caminho/agente.json:/app/agente.json \
  fiscal-bridge
```

### Diferenças em relação ao modo servidor

| | Servidor | Local |
|---|---|---|
| Autenticação | HMAC SHA-256 das Edge Functions | Token DPAPI (`X-Agente-Token`) + CORS por origem |
| Certificado | baixado do cofre (Storage) | cópia local com ACL, senha protegida por DPAPI |
| Rotas | distribuição, chave, manifestação | distribuição, chave, manifestação, diagnóstico |
| Porta padrão | 8443 | 8787 (somente 127.0.0.1) |

## Checklist de instalação (imprimir e conferir)

- [ ] Node.js 20+ instalado
- [ ] Pasta `fiscal-bridge` copiada para o PC do escritório
- [ ] Certificado A1 instalado no Windows **ou** arquivo `.pfx` + senha em mãos
- [ ] `scripts\instalar-agente.bat` executado e concluído sem erro
- [ ] `scripts\status.ps1` mostra **online** e validade do certificado em dia
- [ ] Token colado no ERP (DF-e Recebidos → Configurar agente local)
- [ ] Botão **Testar conexão** no ERP ficou verde
- [ ] Uma sincronização de teste trouxe documentos (ou "nenhum novo NSU")
- [ ] Reiniciar o PC e conferir que o agente sobe sozinho no logon
