import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Merge, AlertTriangle, ChevronRight, MapPin, Phone, Mail, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Cliente {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  tipo: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean | null;
  created_at: string;
}

interface DuplicateGroup {
  key: string;
  label: string;
  icon: "address" | "name";
  clientes: Cliente[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged: () => void;
}

function normalizeStr(s: string | null | undefined): string {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function buildAddressKey(c: Cliente): string {
  const parts = [
    normalizeStr(c.endereco),
    normalizeStr(c.numero),
    normalizeStr(c.bairro),
    normalizeStr(c.cidade),
  ].filter(Boolean);
  return parts.join("|");
}

function buildNameKey(c: Cliente): string {
  return normalizeStr(c.nome);
}

export function MesclarClientesDialog({ open, onOpenChange, onMerged }: Props) {
  const [step, setStep] = useState<"detect" | "merge">("detect");
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [addressGroups, setAddressGroups] = useState<DuplicateGroup[]>([]);
  const [nameGroups, setNameGroups] = useState<DuplicateGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [masterId, setMasterId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("nome");

  useEffect(() => {
    if (open) {
      setStep("detect");
      setSelectedGroup(null);
      setSelectedIds(new Set());
      setMasterId("");
      setActiveTab("nome");
      detectDuplicates();
    }
  }, [open]);

  const detectDuplicates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("ativo", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by normalized address
      const addrMap = new Map<string, Cliente[]>();
      const nameMap = new Map<string, Cliente[]>();

      for (const c of data || []) {
        // Address grouping
        const addrKey = buildAddressKey(c);
        if (addrKey && addrKey !== "|||") {
          if (!addrMap.has(addrKey)) addrMap.set(addrKey, []);
          addrMap.get(addrKey)!.push(c);
        }

        // Name grouping
        const nameKey = buildNameKey(c);
        if (nameKey) {
          if (!nameMap.has(nameKey)) nameMap.set(nameKey, []);
          nameMap.get(nameKey)!.push(c);
        }
      }

      const addrGroups: DuplicateGroup[] = [];
      addrMap.forEach((clientes, key) => {
        if (clientes.length > 1) {
          const sample = clientes[0];
          const label = [sample.endereco, sample.numero, sample.bairro, sample.cidade]
            .filter(Boolean)
            .join(", ");
          addrGroups.push({ key, label, icon: "address", clientes });
        }
      });

      const nGroups: DuplicateGroup[] = [];
      nameMap.forEach((clientes, key) => {
        if (clientes.length > 1) {
          nGroups.push({ key, label: clientes[0].nome, icon: "name", clientes });
        }
      });

      setAddressGroups(addrGroups);
      setNameGroups(nGroups);
    } catch (err: any) {
      toast.error("Erro ao buscar duplicatas: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const openGroup = (group: DuplicateGroup) => {
    setSelectedGroup(group);
    setSelectedIds(new Set(group.clientes.map(c => c.id)));
    setMasterId(group.clientes[0].id);
    setStep("merge");
  };

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 2) return prev;
        next.delete(id);
        if (masterId === id) setMasterId([...next][0]);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleMerge = async () => {
    if (!selectedGroup || !masterId || selectedIds.size < 2) return;
    const toMerge = [...selectedIds].filter(id => id !== masterId);
    if (toMerge.length === 0) return;

    setMerging(true);
    try {
      for (const dupId of toMerge) {
        await supabase
          .from("pedidos")
          .update({ cliente_id: masterId })
          .eq("cliente_id", dupId);
      }

      const { error } = await supabase
        .from("clientes")
        .update({ ativo: false })
        .in("id", toMerge);

      if (error) throw error;

      toast.success(`${toMerge.length} cliente(s) mesclado(s) com sucesso!`);
      onMerged();

      await detectDuplicates();
      setStep("detect");
      setSelectedGroup(null);
    } catch (err: any) {
      toast.error("Erro ao mesclar: " + err.message);
    } finally {
      setMerging(false);
    }
  };

  const currentGroups = activeTab === "nome" ? nameGroups : addressGroups;

  const renderGroupList = (groups: DuplicateGroup[]) => {
    if (groups.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          {activeTab === "nome" ? <User className="h-10 w-10 opacity-30" /> : <MapPin className="h-10 w-10 opacity-30" />}
          <p className="text-sm font-medium">Nenhuma duplicata encontrada!</p>
          <p className="text-xs">
            {activeTab === "nome" ? "Todos os clientes possuem nomes únicos." : "Todos os clientes possuem endereços únicos."}
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {groups.length} grupo{groups.length !== 1 ? "s" : ""} com {activeTab === "nome" ? "nome" : "endereço"} repetido
          </Badge>
        </div>
        <ScrollArea className="flex-1 max-h-[45vh]">
          <div className="space-y-2 pr-2">
            {groups.map((group) => (
              <button
                key={group.key}
                onClick={() => openGroup(group)}
                className="w-full text-left border rounded-lg p-3 hover:bg-muted/60 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {group.icon === "name" ? (
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium truncate">{group.label || "Não informado"}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {group.clientes.length} clientes
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 ml-5">
                      {group.clientes.map(c => (
                        <span key={c.id} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {group.icon === "name" ? (c.bairro || c.telefone || c.cpf || c.id.slice(0, 8)) : c.nome}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-primary" />
            Mesclar Clientes Duplicados
          </DialogTitle>
          <DialogDescription>
            {step === "detect"
              ? "Identifique e mescle clientes duplicados por nome ou endereço."
              : `Escolha qual registro manter como principal e quais serão mesclados.`}
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: detect */}
        {step === "detect" && (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                Buscando duplicatas...
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="nome" className="gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Por Nome
                    {nameGroups.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] h-4 px-1 ml-1">{nameGroups.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="endereco" className="gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    Por Endereço
                    {addressGroups.length > 0 && (
                      <Badge variant="destructive" className="text-[10px] h-4 px-1 ml-1">{addressGroups.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="nome" className="flex-1 flex flex-col gap-3 mt-3">
                  {renderGroupList(nameGroups)}
                </TabsContent>
                <TabsContent value="endereco" className="flex-1 flex flex-col gap-3 mt-3">
                  {renderGroupList(addressGroups)}
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}

        {/* STEP 2: merge */}
        {step === "merge" && selectedGroup && (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
              {selectedGroup.icon === "name" ? <User className="h-3.5 w-3.5 shrink-0" /> : <MapPin className="h-3.5 w-3.5 shrink-0" />}
              <span className="font-medium">{selectedGroup.label}</span>
            </div>

            <div className="grid gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Selecione os clientes a mesclar (mín. 2)
              </p>
              <ScrollArea className="max-h-[40vh]">
                <div className="space-y-2 pr-2">
                  {selectedGroup.clientes.map((c) => {
                    const isSelected = selectedIds.has(c.id);
                    const isMaster = masterId === c.id;
                    return (
                      <div
                        key={c.id}
                        className={`border rounded-lg p-3 transition-colors ${isSelected ? "border-primary/40 bg-primary/5" : "opacity-50"}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleId(c.id)}
                            disabled={isMaster}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{c.nome}</span>
                              {isMaster && (
                                <Badge className="text-[10px] h-4 px-1.5">Principal</Badge>
                              )}
                              {c.cpf && (
                                <span className="text-xs text-muted-foreground">{c.cpf}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {c.telefone && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />{c.telefone}
                                </span>
                              )}
                              {c.email && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" />{c.email}
                                </span>
                              )}
                              {c.endereco && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />{[c.endereco, c.numero, c.bairro].filter(Boolean).join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-2 ml-7">
                            <button
                              onClick={() => setMasterId(c.id)}
                              className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                                isMaster
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:border-primary text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {isMaster ? "✓ Registro principal" : "Definir como principal"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <strong>Atenção:</strong> Os clientes não-principais serão desativados e seus pedidos transferidos para o cliente principal. Esta ação não pode ser desfeita.
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "merge" ? (
            <>
              <Button variant="outline" onClick={() => setStep("detect")} disabled={merging}>
                ← Voltar
              </Button>
              <Button
                onClick={handleMerge}
                disabled={merging || selectedIds.size < 2 || !masterId}
                variant="destructive"
              >
                <Merge className="h-4 w-4 mr-1.5" />
                {merging ? "Mesclando..." : `Mesclar ${selectedIds.size} clientes`}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
