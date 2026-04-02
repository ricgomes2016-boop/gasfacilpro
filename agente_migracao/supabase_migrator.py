"""
supabase_migrator.py — Envia os clientes padronizados para o Supabase (GasFácil Pro)
"""

import requests
import json
import time
import os
from datetime import datetime


class SupabaseMigrator:
    def __init__(self, config: dict):
        self.url = config["supabase"]["url"].rstrip("/")
        self.key = config["supabase"]["service_role_key"]
        self.batch_size = config.get("migracao", {}).get("batch_size", 50)
        self.parar_no_erro = config.get("migracao", {}).get("parar_no_erro", False)
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",  # upsert: não duplica se já existir
        }
        self.erros = []
        self.migrados = 0
        self.atualizados = 0

    def testar_conexao(self) -> bool:
        """Verifica se a conexão com o Supabase está funcionando"""
        try:
            resp = requests.get(
                f"{self.url}/rest/v1/clientes?limit=1",
                headers=self.headers,
                timeout=10,
            )
            if resp.status_code in (200, 206):
                print("✅ Conexão com Supabase OK!")
                return True
            else:
                print(f"❌ Supabase retornou status {resp.status_code}: {resp.text[:200]}")
                return False
        except Exception as e:
            print(f"❌ Erro ao conectar no Supabase: {e}")
            return False

    def migrar_clientes(self, clientes: list) -> dict:
        """Migra lista de clientes em lotes para o Supabase"""
        total = len(clientes)
        print(f"\n🚀 Iniciando migração de {total} clientes...")
        print(f"   Tamanho do lote: {self.batch_size}")

        lotes = [clientes[i:i + self.batch_size] for i in range(0, total, self.batch_size)]

        for idx, lote in enumerate(lotes):
            print(f"\n   📦 Lote {idx + 1}/{len(lotes)} ({len(lote)} registros)...", end=" ")
            try:
                self._enviar_lote(lote)
                print(f"✅")
            except Exception as e:
                print(f"❌ {e}")
                self.erros.append({"lote": idx + 1, "erro": str(e)})
                if self.parar_no_erro:
                    print("   ⛔ Parando por configuração parar_no_erro=true")
                    break
            # Pequena pausa para não sobrecarregar a API
            if idx < len(lotes) - 1:
                time.sleep(0.3)

        return {
            "total_enviado": total,
            "migrados": self.migrados,
            "atualizados": self.atualizados,
            "erros": len(self.erros),
            "detalhes_erros": self.erros,
        }

    def _enviar_lote(self, lote: list):
        """Envia um lote via upsert no Supabase REST API"""
        resp = requests.post(
            f"{self.url}/rest/v1/clientes",
            headers={**self.headers, "Prefer": "resolution=merge-duplicates,return=representation"},
            data=json.dumps(lote, ensure_ascii=False, default=str),
            timeout=30,
        )
        if resp.status_code in (200, 201):
            retorno = resp.json()
            self.migrados += len(retorno)
        elif resp.status_code == 409:
            # Conflito (duplicado) — tenta upsert por nome
            self._upsert_individual(lote)
        else:
            raise Exception(f"HTTP {resp.status_code}: {resp.text[:300]}")

    def _upsert_individual(self, lote: list):
        """Envia registro por registro quando o lote todo falha"""
        for cliente in lote:
            try:
                resp = requests.post(
                    f"{self.url}/rest/v1/clientes",
                    headers={**self.headers, "Prefer": "resolution=merge-duplicates"},
                    data=json.dumps(cliente, ensure_ascii=False, default=str),
                    timeout=10,
                )
                if resp.status_code in (200, 201):
                    self.migrados += 1
                else:
                    self.erros.append({
                        "cliente": cliente.get("nome", "?"),
                        "erro": f"HTTP {resp.status_code}: {resp.text[:100]}"
                    })
            except Exception as e:
                self.erros.append({"cliente": cliente.get("nome", "?"), "erro": str(e)})
