import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Compras() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("purchases")
      .select("*")
      .order("date", { ascending: false })
      .limit(200);

    if (!error) setData(data || []);
    setLoading(false);
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Compras</h1>

      {loading && <p>Carregando...</p>}

      {!loading && data.length === 0 && (
        <p className="text-sm text-muted-foreground">Sem compras</p>
      )}

      <div className="space-y-2">
        {data.map((p) => (
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
