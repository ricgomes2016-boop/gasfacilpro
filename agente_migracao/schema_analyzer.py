"""
schema_analyzer.py — Analisa o banco AteSystem e descobre a tabela de clientes
"""

import json
import re
from db_connector import listar_tabelas, descrever_tabela


# Padrões de nomes de tabela de clientes comuns em sistemas brasileiros
PADROES_TABELA_CLIENTES = [
    "CLIENTES", "CLIENTE", "CAD_CLIENTES", "CAD_CLIENTE",
    "CADASTRO_CLIENTES", "TB_CLIENTES", "TBL_CLIENTES",
    "PERSONS", "PESSOAS", "CONSUMIDORES",
]

# Campos de clientes que queremos mapear para o GasFácil Pro
CAMPOS_INTERESSE = {
    "nome":      ["NOME", "NOME_CLIENTE", "RAZAO_SOCIAL", "RAZAOSOCIAL", "NM_CLIENTE", "NOME_RAZAO"],
    "cpf":       ["CPF", "CPF_CNPJ", "CPFCNPJ", "CNH", "DOCUMENTO", "CPF_CGC"],
    "telefone":  ["TELEFONE", "FONE", "TEL", "CELULAR", "FONE1", "FONE2", "TEL1", "TEL_RES", "TEL_CEL", "TELEFONE1"],
    "email":     ["EMAIL", "E_MAIL", "EMAI", "EMAIL_CLIENTE"],
    "endereco":  ["ENDERECO", "LOGRADOURO", "RUA", "END", "ENDEREÇO", "RESIDE"],
    "numero":    ["NUMERO", "NUM", "NUM_END", "NUMERO_END", "NR"],
    "bairro":    ["BAIRRO", "BAIRRO_CLIENTE"],
    "cidade":    ["CIDADE", "MUNICIPIO", "CITY", "LOCALIDADE"],
    "cep":       ["CEP", "CODPOSTAL", "COD_POSTAL"],
    "ativo":     ["ATIVO", "STATUS", "SITUACAO", "INATIVO", "BLOQUEADO"],
    "tipo":      ["TIPO", "TIPO_CLIENTE", "CATEGORIA"],
    "obs":       ["OBSERVACAO", "OBS", "OBSERVACOES", "COMPLEMENTO"],
}


def descobrir_tabela_clientes(conn) -> str | None:
    """Encontra automaticamente a tabela de clientes no banco AteSystem"""
    tabelas = listar_tabelas(conn)
    print(f"\n📋 Tabelas encontradas no banco ({len(tabelas)}):")
    for t in tabelas:
        print(f"   • {t}")

    # Busca exata primeiro
    for padrao in PADROES_TABELA_CLIENTES:
        if padrao in tabelas:
            print(f"\n✅ Tabela de clientes identificada: {padrao}")
            return padrao

    # Busca parcial
    for tabela in tabelas:
        for padrao in PADROES_TABELA_CLIENTES:
            if padrao in tabela:
                print(f"\n✅ Tabela de clientes identificada (parcial): {tabela}")
                return tabela

    print("\n⚠️  Tabela de clientes não encontrada automaticamente.")
    print("   Tabelas disponíveis:")
    for i, t in enumerate(tabelas):
        print(f"   [{i}] {t}")
    escolha = input("   Digite o número da tabela de clientes: ").strip()
    if escolha.isdigit() and int(escolha) < len(tabelas):
        return tabelas[int(escolha)]
    return None


def mapear_campos(conn, nome_tabela: str) -> dict:
    """
    Analisa os campos da tabela e retorna o mapeamento
    campo_firebird → campo_gasfacilpro
    """
    campos_tabela = descrever_tabela(conn, nome_tabela)
    nomes_campos = [c["campo"].upper() for c in campos_tabela]

    print(f"\n🔍 Campos encontrados na tabela {nome_tabela}:")
    for c in campos_tabela:
        print(f"   • {c['campo']:30} ({c['tipo']}, {c['tamanho']} bytes)")

    mapeamento = {}
    campos_nao_mapeados = []

    for campo_destino, candidatos in CAMPOS_INTERESSE.items():
        encontrado = False
        for candidato in candidatos:
            if candidato in nomes_campos:
                # Pega o nome original (preservar case do banco)
                nome_original = next(c["campo"] for c in campos_tabela if c["campo"].upper() == candidato)
                mapeamento[campo_destino] = nome_original
                encontrado = True
                break
        if not encontrado:
            campos_nao_mapeados.append(campo_destino)

    print(f"\n✅ Mapeamento de campos ({len(mapeamento)} encontrados, {len(campos_nao_mapeados)} não encontrados):")
    for dest, orig in mapeamento.items():
        print(f"   {orig:30} → clientes.{dest}")

    if campos_nao_mapeados:
        print(f"\n⚠️  Campos não encontrados (serão deixados em branco): {campos_nao_mapeados}")

    return mapeamento


def exportar_schema(tabelas: list, mapeamento: dict, nome_tabela: str, output_dir: str):
    """Salva o schema analisado em JSON para auditoria"""
    import os
    os.makedirs(output_dir, exist_ok=True)
    schema = {
        "tabelas_banco": tabelas,
        "tabela_clientes": nome_tabela,
        "mapeamento_campos": mapeamento,
    }
    caminho = os.path.join(output_dir, "schema_analise.json")
    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(schema, f, ensure_ascii=False, indent=2)
    print(f"\n📄 Schema salvo em: {caminho}")
    return caminho
