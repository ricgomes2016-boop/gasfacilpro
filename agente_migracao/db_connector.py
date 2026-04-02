"""
db_connector.py — Módulo de conexão ao banco Firebird do AteSystem
Tenta múltiplas estratégias de acesso (sem precisar de senha)
"""

import sys
import os


def conectar_firebird(config: dict):
    """
    Tenta conectar ao banco Firebird com múltiplas estratégias.
    Retorna a conexão ativa ou lança exceção com diagnóstico.
    """
    db_path = config["firebird"]["database"]
    user = config["firebird"].get("user", "SYSDBA")
    charset = config["firebird"].get("charset", "WIN1252")
    host = config["firebird"].get("host", "embedded")

    if not os.path.exists(db_path):
        raise FileNotFoundError(
            f"\n❌ Arquivo do banco não encontrado: {db_path}\n"
            f"   Verifique o caminho em config.yaml → firebird.database"
        )

    estrategias = [
        {"descricao": "Modo Embedded (sem senha)", "embedded": True, "password": ""},
        {"descricao": "SYSDBA / masterkey (padrão de fábrica)", "embedded": False, "password": "masterkey"},
        {"descricao": "SYSDBA / sem senha", "embedded": False, "password": ""},
        {"descricao": "SYSDBA / masterpass", "embedded": False, "password": "masterpass"},
    ]

    ultimo_erro = None

    for estrategia in estrategias:
        print(f"   🔑 Tentando: {estrategia['descricao']}...", end=" ")
        conn = _tentar_conectar_fdb(db_path, user, estrategia["password"], charset, estrategia["embedded"], host)
        if conn:
            print("✅ Conectado!")
            return conn
        conn = _tentar_conectar_driver(db_path, user, estrategia["password"], charset, estrategia["embedded"], host)
        if conn:
            print("✅ Conectado!")
            return conn
        print("❌")

    raise ConnectionError(
        "\n❌ Não foi possível conectar ao banco Firebird.\n"
        "   Soluções possíveis:\n"
        "   1. Verifique se o Firebird Client está instalado (fbclient.dll)\n"
        "   2. Use o IBExpert para resetar a senha do SYSDBA\n"
        "   3. Baixe o FBPassword: https://www.firebirdsql.org/en/password-recovery/\n"
        "   4. Configure a senha correta em config.yaml → firebird.password"
    )


def _tentar_conectar_fdb(db_path, user, password, charset, embedded, host):
    """Tenta conectar usando a biblioteca fdb (legado)"""
    try:
        import fdb
        if embedded:
            conn = fdb.connect(
                database=db_path,
                user=user,
                password=password or "masterkey",
                charset=charset,
                fb_library_name=_find_fbclient(),
            )
        else:
            conn = fdb.connect(
                host=host if host not in ("embedded", "") else "localhost",
                database=db_path,
                user=user,
                password=password or "masterkey",
                charset=charset,
            )
        return conn
    except ImportError:
        return None
    except Exception:
        return None


def _tentar_conectar_driver(db_path, user, password, charset, embedded, host):
    """Tenta conectar usando firebird-driver (Python moderno)"""
    try:
        import firebird.driver as fb
        if embedded:
            conn = fb.connect(
                database=db_path,
                user=user,
                password=password or "masterkey",
                charset=charset,
            )
        else:
            host_str = host if host not in ("embedded", "") else "localhost"
            conn = fb.connect(
                database=f"{host_str}/{db_path}",
                user=user,
                password=password or "masterkey",
                charset=charset,
            )
        return conn
    except ImportError:
        return None
    except Exception:
        return None


def _find_fbclient():
    """Tenta localizar o fbclient.dll automaticamente no Windows"""
    caminhos_comuns = [
        r"C:\Program Files\Firebird\Firebird_3_0\fbclient.dll",
        r"C:\Program Files\Firebird\Firebird_2_5\fbclient.dll",
        r"C:\Program Files (x86)\Firebird\Firebird_3_0\fbclient.dll",
        r"C:\Program Files (x86)\Firebird\Firebird_2_5\fbclient.dll",
        r"C:\Windows\System32\fbclient.dll",
        r"C:\Windows\SysWOW64\fbclient.dll",
    ]
    for caminho in caminhos_comuns:
        if os.path.exists(caminho):
            return caminho
    return None  # deixa a biblioteca encontrar sozinha


def listar_tabelas(conn) -> list:
    """Retorna lista de todas as tabelas de usuário no banco Firebird"""
    sql = """
        SELECT TRIM(RDB$RELATION_NAME)
        FROM RDB$RELATIONS
        WHERE RDB$SYSTEM_FLAG = 0
          AND RDB$VIEW_BLR IS NULL
        ORDER BY RDB$RELATION_NAME
    """
    cur = conn.cursor()
    cur.execute(sql)
    return [row[0] for row in cur.fetchall()]


def descrever_tabela(conn, nome_tabela: str) -> list:
    """Retorna lista de dicts com {campo, tipo, tamanho, nulo} para uma tabela"""
    sql = """
        SELECT
            TRIM(rf.RDB$FIELD_NAME) AS campo,
            TRIM(t.RDB$TYPE_NAME) AS tipo,
            f.RDB$FIELD_LENGTH AS tamanho,
            rf.RDB$NULL_FLAG AS obrigatorio
        FROM RDB$RELATION_FIELDS rf
        JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE
        LEFT JOIN RDB$TYPES t ON t.RDB$TYPE = f.RDB$FIELD_TYPE AND t.RDB$FIELD_NAME = 'RDB$FIELD_TYPE'
        WHERE rf.RDB$RELATION_NAME = ?
        ORDER BY rf.RDB$FIELD_POSITION
    """
    cur = conn.cursor()
    cur.execute(sql, (nome_tabela,))
    colunas = ["campo", "tipo", "tamanho", "obrigatorio"]
    return [dict(zip(colunas, row)) for row in cur.fetchall()]
