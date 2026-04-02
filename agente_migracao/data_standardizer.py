"""
data_standardizer.py — Padroniza dados de clientes do AteSystem
"""

import re
import unicodedata


def padronizar_clientes(registros: list, mapeamento: dict) -> tuple[list, list]:
    """
    Recebe lista de dicts com campos do AteSystem e retorna:
    - lista de clientes prontos para inserir no Supabase
    - lista de pendências (registros com problemas)
    """
    clientes_ok = []
    pendencias = []

    for i, registro in enumerate(registros):
        try:
            cliente = _transformar_registro(registro, mapeamento)
            erros = _validar_cliente(cliente)
            if erros:
                pendencias.append({"registro_original": registro, "erros": erros, "linha": i + 1})
            else:
                clientes_ok.append(cliente)
        except Exception as e:
            pendencias.append({"registro_original": registro, "erros": [str(e)], "linha": i + 1})

    return clientes_ok, pendencias


def _transformar_registro(registro: dict, mapeamento: dict) -> dict:
    """Converte um registro do AteSystem para o formato do GasFácil Pro"""
    def get(campo_destino):
        campo_origem = mapeamento.get(campo_destino)
        if campo_origem and campo_origem in registro:
            val = registro[campo_origem]
            return str(val).strip() if val is not None else ""
        return ""

    nome = _limpar_texto(get("nome"))
    telefone = _normalizar_telefone(get("telefone") or get("telefone2"))
    cpf = _normalizar_cpf(get("cpf"))
    cep = _normalizar_cep(get("cep"))
    endereco_completo = _montar_endereco(get("endereco"), get("numero"))

    # Detecta tipo de cliente (residencial / comercial)
    tipo_raw = get("tipo").upper()
    if any(x in tipo_raw for x in ["COMERC", "EMPRES", "JURIDIC", "CNPJ", "J"]):
        tipo = "comercial"
    else:
        tipo = "residencial"

    # Detecta se está ativo
    ativo_raw = get("ativo").upper()
    if ativo_raw in ("0", "N", "NAO", "NÃO", "INATIVO", "BLOQUEADO", "F", "FALSE"):
        ativo = False
    else:
        ativo = True

    return {
        "nome": nome,
        "cpf": cpf or None,
        "telefone": telefone or None,
        "email": get("email").lower() or None,
        "endereco": endereco_completo or None,
        "bairro": _limpar_texto(get("bairro")) or None,
        "cidade": _limpar_texto(get("cidade")) or None,
        "cep": cep or None,
        "tipo": tipo,
        "ativo": ativo,
    }


def _limpar_texto(texto: str) -> str:
    """Remove espaços extras e caracteres de controle"""
    if not texto:
        return ""
    return " ".join(texto.split())


def _normalizar_telefone(fone: str) -> str:
    """Remove tudo que não é dígito e padroniza para (XX) XXXXX-XXXX"""
    if not fone:
        return ""
    digitos = re.sub(r"\D", "", fone)
    if len(digitos) == 11:
        return f"({digitos[:2]}) {digitos[2:7]}-{digitos[7:]}"
    elif len(digitos) == 10:
        return f"({digitos[:2]}) {digitos[2:6]}-{digitos[6:]}"
    elif len(digitos) >= 8:
        return digitos  # retorna só os dígitos se não souber o formato
    return ""


def _normalizar_cpf(cpf: str) -> str:
    """Mantém apenas os dígitos do CPF/CNPJ"""
    if not cpf:
        return ""
    digitos = re.sub(r"\D", "", cpf)
    if len(digitos) in (11, 14):
        return digitos
    return ""  # CPF/CNPJ inválido — retorna vazio


def _normalizar_cep(cep: str) -> str:
    """Normaliza CEP para 8 dígitos"""
    if not cep:
        return ""
    digitos = re.sub(r"\D", "", cep)
    return digitos if len(digitos) == 8 else ""


def _montar_endereco(logradouro: str, numero: str) -> str:
    """Junta endereço + número"""
    partes = [_limpar_texto(logradouro)]
    if numero and numero.strip() and numero.strip() not in ("0", "S/N", "SN"):
        partes.append(f"nº {numero.strip()}")
    return ", ".join(p for p in partes if p)


def _validar_cliente(cliente: dict) -> list:
    """Retorna lista de erros de validação"""
    erros = []
    if not cliente.get("nome") or len(cliente["nome"]) < 2:
        erros.append("Nome ausente ou muito curto")
    if not cliente.get("telefone") and not cliente.get("email"):
        erros.append("Sem telefone nem e-mail (ao menos um é recomendado)")
    return erros


def remover_duplicados(clientes: list) -> tuple[list, int]:
    """Remove clientes duplicados por CPF ou por nome+telefone"""
    vistos_cpf = {}
    vistos_nome_fone = {}
    resultado = []
    removidos = 0

    for c in clientes:
        chave_cpf = c.get("cpf")
        chave_nf = f"{c.get('nome', '').lower()}|{c.get('telefone', '')}"

        if chave_cpf and chave_cpf in vistos_cpf:
            removidos += 1
            continue
        if chave_nf in vistos_nome_fone:
            removidos += 1
            continue

        if chave_cpf:
            vistos_cpf[chave_cpf] = True
        vistos_nome_fone[chave_nf] = True
        resultado.append(c)

    return resultado, removidos
