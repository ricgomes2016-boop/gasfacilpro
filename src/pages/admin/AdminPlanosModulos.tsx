import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, Search, Save, ChevronDown, ChevronRight } from "lucide-react";

type PlanoKey = "basico" | "starter" | "enterprise";

interface Modulo {
  id: string;
  modulo_key: string;
  modulo_label: string;
  modulo_grupo: string;
  path: string | null;
  planos: string[];
}

const PLANOS: { key: PlanoKey; label: string; color: string }[] = [
  { key: "basico", label: "Básico", color: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
  { key: "starter", label: "Starter", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { key: "enterprise", label: "Enterprise", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
];

export default function AdminPlanosModulos() {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("plano_modulos" as any)
      .select("id, modulo_key, modulo_label, modulo_grupo, path, planos")
      .order("modulo_grupo")
      .order("modulo_label");
    if (error) toast.error("Erro ao carregar módulos: " + error.message);
    setModulos(((data || []) as unknown as Modulo[]));
    setDirty(false);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const toggle = (id: string, plano: PlanoKey) => {
    setModulos((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const has = m.planos.includes(plano);
        return { ...m, planos: has ? m.planos.filter((p) => p !== plano) : [...m.planos, plano] };
      })
    );
    setDirty(true);
  };

  const setColumn = (plano: PlanoKey, value: boolean, ids: string[]) => {
    const idSet = new Set(ids);
    setModulos((prev) =>
      prev.map((m) => {
        if (!idSet.has(m.id)) return m;
        const has = m.planos.includes(plano);
        if (value && !has) return { ...m, planos: [...m.planos, plano] };
        if (!value && has) return { ...m, planos: m.planos.filter((p) => p !== plano) };
        return m;
      })
    );
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Atualiza linha a linha em paralelo
      const updates = await Promise.all(
        modulos.map((m) =>
          supabase
            .from("plano_modulos" as any)
            .update({ planos: m.planos, updated_at: new Date().toISOString() })
            .eq("id", m.id)
        )
      );
      const failed = updates.filter((r) => r.error);
      if (failed.length > 0) {
        toast.error(`Falha em ${failed.length} módulo(s)`);
      } else {
        toast.success("Mapeamento salvo!");
        setDirty(false);
      }
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return modulos;
    return modulos.filter(
      (m) =>
        m.modulo_label.toLowerCase().includes(t) ||
        m.modulo_grupo.toLowerCase().includes(t) ||
        (m.path || "").toLowerCase().includes(t)
    );
  }, [modulos, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Modulo[]>();
    filtered.forEach((m) => {
      const arr = map.get(m.modulo_grupo) || [];
      arr.push(m);
      map.set(m.modulo_grupo, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const toggleGroup = (g: string) => {
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Lock className="h-6 w-6 text-primary" />
              Planos &amp; Módulos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Marque quais páginas/módulos do sistema cada plano do SaaS pode acessar. {modulos.length} módulos cadastrados.
            </p>
          </div>
          <Button onClick={handleSave} disabled={!dirty || saving} className="gradient-primary text-primary-foreground shadow-glow">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar alterações
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por módulo, grupo ou rota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/80"
          />
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold w-[55%]">Módulo</TableHead>
                  {PLANOS.map((p) => (
                    <TableHead key={p.key} className="text-center font-semibold">
                      <Badge variant="secondary" className={`${p.color} font-semibold`}>{p.label}</Badge>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : grouped.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      Nenhum módulo encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  grouped.flatMap(([grupo, items]) => {
                    const isClosed = closed.has(grupo);
                    const ids = items.map((m) => m.id);
                    const header = (
                      <TableRow key={`g-${grupo}`} className="bg-muted/20 hover:bg-muted/30">
                        <TableCell className="font-bold text-sm">
                          <button
                            type="button"
                            onClick={() => toggleGroup(grupo)}
                            className="flex items-center gap-2 hover:text-primary"
                          >
                            {isClosed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {grupo}
                            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                          </button>
                        </TableCell>
                        {PLANOS.map((p) => {
                          const allOn = items.every((m) => m.planos.includes(p.key));
                          const someOn = items.some((m) => m.planos.includes(p.key));
                          return (
                            <TableCell key={p.key} className="text-center">
                              <Checkbox
                                checked={allOn ? true : someOn ? "indeterminate" : false}
                                onCheckedChange={(v) => setColumn(p.key, v === true, ids)}
                                aria-label={`Marcar todos ${grupo} para ${p.label}`}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                    if (isClosed) return [header];
                    const rows = items.map((m) => (
                      <TableRow key={m.id} className="hover:bg-muted/10">
                        <TableCell>
                          <div className="pl-6">
                            <div className="text-sm font-medium">{m.modulo_label}</div>
                            {m.path && (
                              <div className="text-[11px] text-muted-foreground font-mono">{m.path}</div>
                            )}
                          </div>
                        </TableCell>
                        {PLANOS.map((p) => (
                          <TableCell key={p.key} className="text-center">
                            <Checkbox
                              checked={m.planos.includes(p.key)}
                              onCheckedChange={() => toggle(m.id, p.key)}
                              aria-label={`${m.modulo_label} no plano ${p.label}`}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ));
                    return [header, ...rows];
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {dirty && (
          <div className="sticky bottom-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-primary-foreground shadow-glow">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar alterações
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
