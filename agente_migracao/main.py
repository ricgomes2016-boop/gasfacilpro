"""
main.py — Orquestrador do Agente de Migração AteSystem → GasFácil Pro

Uso:
  python main.py                → Executa migração completa
  python main.py --analisar     → Apenas analisa o banco, sem migrar
  python main.py --dry-run      → Simula migração, não envia para Supabase
"""

import sys
import os
import json
import yaml
import argparse
from datetime import datetime


def carregar_config(caminho: str = "config.yaml") -> dict:
    if not os.path.exists(caminho):
        print(f"❌ Arquivo config.yaml não encontrado em: {caminho}")
        print("   Copie o config.yaml de exemplo e preencha seus dados.")
        sys.exit(1)
    with open(caminho, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main():
    parser = argparse.ArgumentParser(description="Agente de Migração AteSystem → GasFácil Pro")
    parser.add_argument("--analisar", action="store_true", help="Apenas analisa o banco, sem migrar")
    parser.add_argument("--dry-run", action="store_true", help="Simula migração sem enviar para Supabase")
    parser.add_argument("--config", default="config.yaml", help="Caminho para o arquivo config.yaml")
    args = parser.parse_args()

    print("=" * 60)
    print("  🔥 Agente de Migração AteSystem → GasFácil Pro")
    print("=" * 60)

    # ── 1. Carregar configuração ──────────────────────────────────
    config = carregar_config(args.config)
    output_dir = config.get("migracao", {}).get("output_dir", "./logs")
    os.makedirs(output_dir, exist_ok=True)

    # ── 2. Conectar ao Firebird ───────────────────────────────────
    print(f"\n📂 Conectando ao banco AteSystem...")
    print(f"   Arquivo: {config['firebird']['database']}")

    from db_connector import conectar_firebird, listar_tabelas
    try:
        conn = conectar_firebird(config)
    except (FileNotFoundError, ConnectionError) as e:
        print(e)
        sys.exit(1)

    # ── 3. Descobrir e analisar tabela de clientes ────────────────
    from schema_analyzer import descobrir_tabela_clientes, mapear_campos, exportar_schema

    tabelas = listar_tabelas(conn)
    nome_tabela = descobrir_tabela_clientes(conn)
    if not nome_tabela:
        print("❌ Não foi possível identificar a tabela de clientes. Encerrando.")
        conn.close()
        sys.exit(1)

    mapeamento = mapear_campos(conn, nome_tabela)
    exportar_schema(tabelas, mapeamento, nome_tabela, output_dir)

    if args.analisar:
        print("\n✅ Análise concluída! (modo --analisar, migração não realizada)")
        conn.close()
        return

    # ── 4. Extrair dados do Firebird ──────────────────────────────
    print(f"\n📤 Extraindo clientes da tabela {nome_tabela}...")
    cur = conn.cursor()

    campos_select = ", ".join(
        f'"{v}"' for v in mapeamento.values()
    )
    cur.execute(f'SELECT {campos_select} FROM "{nome_tabela}"')

    colunas = [desc[0] for desc in cur.description]
    registros_raw = [dict(zip(colunas, row)) for row in cur.fetchall()]
    conn.close()

    print(f"   Total de registros extraídos: {len(registros_raw)}")

    # ── 5. Padronizar dados ───────────────────────────────────────
    print(f"\n🧹 Padronizando dados...")
    from data_standardizer import padronizar_clientes, remover_duplicados

    clientes, pendencias = padronizar_clientes(registros_raw, mapeamento)
    clientes, qtd_duplicados = remover_duplicados(clientes)

    print(f"   ✅ Prontos para migrar: {len(clientes)}")
    print(f"   ⚠️  Pendências (dados inválidos): {len(pendencias)}")
    print(f"   🔁 Duplicados removidos: {qtd_duplicados}")

    # Salva pendências para revisão
    if pendencias:
        caminho_pend = os.path.join(output_dir, "pendencias.json")
        with open(caminho_pend, "w", encoding="utf-8") as f:
            json.dump(pendencias, f, ensure_ascii=False, indent=2, default=str)
        print(f"   📄 Pendências salvas em: {caminho_pend}")

    if args.dry_run:
        print("\n✅ Dry-run concluído! Nenhum dado enviado para o Supabase.")
        print("   Verifique os arquivos em:", output_dir)
        return

    if not clientes:
        print("\n⚠️  Nenhum cliente válido para migrar.")
        return

    # ── 6. Confirmar antes de migrar ──────────────────────────────
    print(f"\n{'─' * 60}")
    print(f"  Pronto para migrar {len(clientes)} clientes para o GasFácil Pro.")
    confirmar = input("  Confirmar? (s/N): ").strip().lower()
    if confirmar not in ("s", "sim", "y", "yes"):
        print("  ❌ Migração cancelada pelo usuário.")
        return

    # ── 7. Migrar para Supabase ───────────────────────────────────
    from supabase_migrator import SupabaseMigrator

    migrador = SupabaseMigrator(config)
    if not migrador.testar_conexao():
        print("❌ Falha na conexão com Supabase. Verifique config.yaml → supabase.")
        sys.exit(1)

    resultado = migrador.migrar_clientes(clientes)

    # ── 8. Relatório final ────────────────────────────────────────
    _gerar_relatorio(resultado, pendencias, qtd_duplicados, output_dir)


def _gerar_relatorio(resultado: dict, pendencias: list, duplicados: int, output_dir: str):
    """Gera relatório final da migração"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    caminho = os.path.join(output_dir, f"relatorio_{timestamp}.json")

    relatorio = {
        "timestamp": datetime.now().isoformat(),
        "resumo": {
            "total_extraido_firebird": resultado["total_enviado"] + len(pendencias) + duplicados,
            "duplicados_removidos": duplicados,
            "pendencias_invalidas": len(pendencias),
            "enviados_supabase": resultado["total_enviado"],
            "migrados_com_sucesso": resultado["migrados"],
            "erros_supabase": resultado["erros"],
        },
        "erros_supabase": resultado["detalhes_erros"],
    }

    with open(caminho, "w", encoding="utf-8") as f:
        json.dump(relatorio, f, ensure_ascii=False, indent=2)

    print(f"\n{'=' * 60}")
    print("  📊 RELATÓRIO FINAL")
    print(f"{'=' * 60}")
    r = relatorio["resumo"]
    print(f"  Extraídos do AteSystem:      {r['total_extraido_firebird']}")
    print(f"  Duplicados removidos:         {r['duplicados_removidos']}")
    print(f"  Pendências (inválidos):       {r['pendencias_invalidas']}")
    print(f"  Enviados para Supabase:       {r['enviados_supabase']}")
    print(f"  ✅ Migrados com sucesso:      {r['migrados_com_sucesso']}")
    print(f"  ❌ Erros no Supabase:         {r['erros_supabase']}")
    print(f"\n  📄 Relatório completo: {caminho}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
