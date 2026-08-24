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
