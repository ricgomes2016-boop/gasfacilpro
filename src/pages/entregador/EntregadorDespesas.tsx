import { useState, useRef, useEffect, useCallback } from "react";
import { EntregadorLayout } from "@/components/entregador/EntregadorLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Receipt,
  Camera,
  Fuel,
  Utensils,
  Wrench,
  Car,
  Plus,
  CheckCircle,
  Clock,
  X,
  Image,
  Upload,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface DespesaDB {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  created_at: string;
  status: string;
  categoria: string | null;
}

const tiposDespesa = [
  { id: "combustivel", nome: "Combustível", icon: Fuel, categoria: "combustivel" },
  { id: "refeicao", nome: "Refeição", icon: Utensils, categoria: "alimentacao" },
  { id: "manutencao", nome: "Manutenção", icon: Wrench, categoria: "manutencao" },
  { id: "estacionamento", nome: "Estacionamento", icon: Car, categoria: "estacionamento" },
  { id: "outros", nome: "Outros", icon: Receipt, categoria: "outros" },
];

const statusConfig = {
  pendente: { label: "Pendente", color: "bg-warning/10 text-warning", icon: Clock },
  aprovada: { label: "Aprovada", color: "bg-success/10 text-success", icon: CheckCircle },
  rejeitada: { label: "Rejeitada", color: "bg-destructive/10 text-destructive", icon: X },
};

export default function EntregadorDespesas() {
  const [despesas, setDespesas] = useState<DespesaDB[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [entregadorId, setEntregadorId] = useState<string | null>(null);
  const [entregadorUnidadeId, setEntregadorUnidadeId] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [novaDespesa, setNovaDespesa] = useState({
    tipo: "",
    descricao: "",
    valor: "",
  });
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchDespesas = useCallback(async () => {
    if (!user) return;

    try {
      // Get entregador
      const { data: entregador } = await supabase
        .from("entregadores")
        .select("id, unidade_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (entregador) {
        setEntregadorId(entregador.id);
        setEntregadorUnidadeId(entregador.unidade_id || null);

        const { data, error } = await supabase
          .from("movimentacoes_caixa")
          .select("id, tipo, descricao, valor, created_at, status, categoria")
          .eq("entregador_id", entregador.id)
          .eq("tipo", "saida")
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && data) {
          setDespesas(data);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar despesas:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDespesas();
  }, [fetchDespesas]);

  const totalPendente = despesas
    .filter((d) => d.status === "pendente")
    .reduce((acc, d) => acc + Number(d.valor), 0);

  const totalAprovado = despesas
    .filter((d) => d.status === "aprovada")
    .reduce((acc, d) => acc + Number(d.valor), 0);

  const handleSelecionarFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const enviarDespesa = async () => {
    if (!novaDespesa.tipo || !novaDespesa.valor) {
      toast({
        title: "Dados incompletos",
        description: "Preencha o tipo e valor da despesa.",
        variant: "destructive",
      });
      return;
    }

    if (!entregadorId) {
      toast({
        title: "Erro",
        description: "Você não está cadastrado como entregador.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const tipoInfo = tiposDespesa.find((t) => t.id === novaDespesa.tipo);

    const { error } = await supabase.from("movimentacoes_caixa").insert({
      tipo: "saida",
      descricao: novaDespesa.descricao || tipoInfo?.nome || "",
      valor: Number(novaDespesa.valor),
      categoria: tipoInfo?.categoria || "outros",
      status: "pendente",
      entregador_id: entregadorId,
      solicitante: "entregador",
      unidade_id: entregadorUnidadeId,
    });

    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Despesa enviada!",
        description: "Aguardando aprovação do gestor.",
      });
      setNovaDespesa({ tipo: "", descricao: "", valor: "" });
      setCapturedPhoto(null);
      setDialogAberto(false);
      fetchDespesas();
    }
    setIsSaving(false);
  };

  const getTipoIcon = (categoria: string | null) => {
    const tipo = tiposDespesa.find((t) => t.categoria === categoria);
    return tipo?.icon || Receipt;
  };

  const getCategoriaNome = (categoria: string | null) => {
    const tipo = tiposDespesa.find((t) => t.categoria === categoria);
    return tipo?.nome || categoria || "Outros";
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR");
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return (
      <EntregadorLayout title="Despesas">
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </EntregadorLayout>
    );
  }

  return (
    <EntregadorLayout title="Despesas">
      <div className="p-4 space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-lg font-bold">R$ {totalPendente.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-lg font-bold">R$ {totalAprovado.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Aprovadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botão Nova Despesa */}
        <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 gradient-primary text-white shadow-glow">
              <Camera className="h-5 w-5 mr-2" />
              Registrar Nova Despesa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Nova Despesa</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Área de foto */}
              <div className="space-y-2">
                <Label className="text-xs">Comprovante (Foto)</Label>
                <div className="aspect-video bg-muted rounded-lg flex flex-col items-center justify-center overflow-hidden">
                  {capturedPhoto ? (
                    <div className="relative w-full h-full">
                      <img src={capturedPhoto} alt="Comprovante" className="w-full h-full object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8"
                        onClick={() => setCapturedPhoto(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Image className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Tire uma foto do comprovante</p>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="photo" className="flex-1" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="h-4 w-4" />
                    Câmera
                  </Button>
                  <Button variant="import" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Galeria
                  </Button>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleSelecionarFoto} />
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSelecionarFoto} />
                </div>
              </div>

              {/* Tipo de despesa */}
              <div className="space-y-2">
                <Label className="text-xs">Tipo de Despesa *</Label>
                <Select value={novaDespesa.tipo} onValueChange={(value) => setNovaDespesa({ ...novaDespesa, tipo: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposDespesa.map((tipo) => {
                      const Icon = tipo.icon;
                      return (
                        <SelectItem key={tipo.id} value={tipo.id}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {tipo.nome}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Descrição */}
              <div className="space-y-2">
                <Label className="text-xs">Descrição</Label>
                <Input
                  value={novaDespesa.descricao}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, descricao: e.target.value })}
                  placeholder="Ex: Posto Shell, Restaurante..."
                />
              </div>

              {/* Valor */}
              <div className="space-y-2">
                <Label className="text-xs">Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={novaDespesa.valor}
                  onChange={(e) => setNovaDespesa({ ...novaDespesa, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>

              <Button onClick={enviarDespesa} className="w-full gradient-primary text-white" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                {isSaving ? "Enviando..." : "Enviar Despesa"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Lista de despesas */}
        <Card className="border-none shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Histórico de Despesas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {despesas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma despesa registrada</p>
              </div>
            ) : (
              despesas.map((despesa) => {
                const TipoIcon = getTipoIcon(despesa.categoria);
                const statusKey = despesa.status as keyof typeof statusConfig;
                const statusInfo = statusConfig[statusKey] || statusConfig.pendente;
                const StatusIcon = statusInfo.icon;

                return (
                  <div key={despesa.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <TipoIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate">{despesa.descricao}</p>
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {formatDate(despesa.created_at)} às {formatTime(despesa.created_at)}
                        </p>
                        <p className="font-bold text-primary">
                          R$ {Number(despesa.valor).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </EntregadorLayout>
  );
}
