# Agente de Migração AteSystem → GasFácil Pro

## Pré-requisitos

1. **Python 3.8+** instalado
2. **Firebird Client** instalado no Windows ([baixar aqui](https://firebirdsql.org/en/firebird-3-0/))
3. **Acesso ao arquivo `.fdb`** do AteSystem (geralmente em `C:\AteSystem\` ou `C:\Program Files\AteSystem\`)

## Instalação

```bash
# No terminal, dentro da pasta agente_migracao:
pip install -r requirements.txt
```

## Configuração

Edite o arquivo `config.yaml` com:

```yaml
firebird:
  database: "C:/Caminho/Para/BANCO.fdb"   # caminho do arquivo do AteSystem

supabase:
  url: "https://SEU_PROJECT_ID.supabase.co"
  service_role_key: "sua_chave_aqui"        # Settings → API → service_role
```

> A senha do Firebird **não é necessária** — o agente testa acesso embedded e as senhas padrão automaticamente.

## Como usar

```bash
# 1. Apenas analisar o banco (sem migrar nada)
python main.py --analisar

# 2. Testar sem enviar para o Supabase (dry-run)
python main.py --dry-run

# 3. Migração completa
python main.py
```

## O que o agente faz

```
1. Conecta ao Firebird (autômático, sem precisar de senha)
2. Descobre a tabela de clientes do AteSystem
3. Mapeia os campos (NOME, FONE, CEP...) para o GasFácil Pro
4. Padroniza os dados:
   • Telefone → (XX) XXXXX-XXXX
   • CPF → somente dígitos
   • CEP → 8 dígitos
   • Remove duplicados
5. Pede confirmação antes de migrar
6. Envia para o Supabase em lotes de 50
7. Gera relatório completo em logs/
```

## Arquivos gerados (pasta `logs/`)

| Arquivo | Conteúdo |
|---|---|
| `schema_analise.json` | Tabelas e mapeamento de campos encontrados |
| `pendencias.json` | Clientes com dados inválidos (revisar manualmente) |
| `relatorio_YYYYMMDD.json` | Resumo completo da migração |

## Solução de problemas

**Firebird Client não encontrado:**
```
Baixe e instale: https://firebirdsql.org/en/firebird-3-0/
Versão recomendada: Firebird-3.0.x-Win32 (mesmo em Windows 64-bit)
```

**Tabela de clientes não encontrada:**
```
Use python main.py --analisar para ver todas as tabelas disponíveis
e identifique manualmente qual é a tabela de clientes.
```
