import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Compras() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .order("date", { ascending: false })
      .limit(200);

    if (!error) setData(data || []);
    setLoading(false);
  };

  const filtered = data.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.supplier || "").toLowerCase().includes(q) ||
      (p.product || "").toLowerCase().includes(q)
    );
  });

  const total = filtered.reduce((s, i) => s + (i.total_value || 0), 0);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Compras</h1>

      <input
        placeholder="Buscar fornecedor ou produto"
        className="border px-3 py-2 rounded w-full"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="bg-blue-50 border rounded p-3 text-sm">
        <b>Total:</b> R$ {total.toFixed(2)}
      </div>

      {loading && <p>Carregando...</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">Sem resultados</p>
      )}

      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.id} className="border rounded p-3 text-sm">
            <div><b>Fornecedor:</b> {p.supplier}</div>
            <div><b>Produto:</b> {p.product}</div>
            <div><b>Qtd:</b> {p.quantity}</div>
            <div><b>Total:</b> R$ {p.total_value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
