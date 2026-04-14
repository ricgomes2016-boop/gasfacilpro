import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Building2, Users, Store } from "lucide-react";
import type { Parada, TipoParada } from "./RotaAtacadoMap";
import { getDefaultsByTipo } from "./RotaAtacadoMap";

const TIPO_OPTIONS = [
  { value: "saida", label: "🟢 Saída (empresa)" },
  { value: "coleta", label: "🔵 Coleta (distribuidora)" },
  { value: "transferencia", label: "🟣 Transferência (filial)" },
  { value: "venda", label: "🟠 Venda (cliente/revenda)" },
  { value: "retorno", label: "🔴 Retorno" },
];

const IMPACTO_OPTIONS = [
  { value: "entrada", label: "↓ Entrada (estoque sobe)" },
  { value: "saida", label: "↑ Saída (estoque desce)" },
  { value: "nenhum", label: "— Nenhum" },
];

interface EntidadeOption {
  id: string;
  nome: string;
}

interface Props {
  parada: Parada;
  index: number;
  onChange: (id: string, field: string, value: any) => void;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
  distribuidoras: EntidadeOption[];
  unidades: EntidadeOption[];
  clientes: EntidadeOption[];
}

function getEntidadeIcon(tipo: string) {
  switch (tipo) {
    case "coleta": return <Building2 className="h-3 w-3" />;
    case "transferencia": return <Store className="h-3 w-3" />;
    case "venda": return <Users className="h-3 w-3" />;
    default: return null;
  }
}

function getEntidadeLabel(tipo: string) {
  switch (tipo) {
    case "coleta": return "Distribuidora";
    case "transferencia": return "Filial Destino";
    case "venda": return "Cliente/Revenda";
    default: return null;
  }
}

function getEntidadeList(tipo: string, distribuidoras: EntidadeOption[], unidades: EntidadeOption[], clientes: EntidadeOption[]) {
  switch (tipo) {
    case "coleta": return distribuidoras;
    case "transferencia": return unidades;
    case "venda": return clientes;
    default: return [];
  }
}

function getEntidadeTipo(tipoParada: string) {
  switch (tipoParada) {
    case "coleta": return "distribuidora";
    case "transferencia": return "unidade";
    case "venda": return "cliente";
    default: return "";
  }
}

export function ParadaForm({
  parada, index, onChange, onRemove, onMoveUp, onMoveDown,
  isFirst, isLast, distribuidoras, unidades, clientes,
}: Props) {
  const entidadeLabel = getEntidadeLabel(parada.tipo_parada);
  const entidadeList = getEntidadeList(parada.tipo_parada, distribuidoras, unidades, clientes);
  const showEntidade = !!entidadeLabel;

  const handleTipoChange = (newTipo: string) => {
    const defaults = getDefaultsByTipo(newTipo as TipoParada);
    onChange(parada.id, "tipo_parada", newTipo);
    onChange(parada.id, "impacto_estoque", defaults.impacto_estoque);
    onChange(parada.id, "impacto_financeiro", defaults.impacto_financeiro);
    onChange(parada.id, "entidade_id", "");
    onChange(parada.id, "entidade_nome", "");
    onChange(parada.id, "entidade_tipo", getEntidadeTipo(newTipo));
  };

  const handleEntidadeChange = (entidadeId: string) => {
    const ent = entidadeList.find((e) => e.id === entidadeId);
    onChange(parada.id, "entidade_id", entidadeId);
    onChange(parada.id, "entidade_nome", ent?.nome || "");
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isFirst} onClick={() => onMoveUp(index)}>
            <span className="text-xs">▲</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isLast} onClick={() => onMoveDown(index)}>
            <span className="text-xs">▼</span>
          </Button>
        </div>
        <span className="text-sm font-bold text-muted-foreground w-6">#{index + 1}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm truncate block font-medium">{parada.endereco || parada.cidade || "Sem endereço"}</span>
          {parada.entidade_nome && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {getEntidadeIcon(parada.tipo_parada)} {parada.entidade_nome}
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemove(parada.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Tipo de parada */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tipo de Parada</Label>
          <Select value={parada.tipo_parada} onValueChange={handleTipoChange}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Impacto Estoque</Label>
          <Select value={parada.impacto_estoque} onValueChange={(v) => onChange(parada.id, "impacto_estoque", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {IMPACTO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Entidade vinculada */}
      {showEntidade && (
        <div>
          <Label className="text-xs flex items-center gap-1">
            {getEntidadeIcon(parada.tipo_parada)} {entidadeLabel}
          </Label>
          <Select value={parada.entidade_id || ""} onValueChange={handleEntidadeChange}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={`Selecionar ${entidadeLabel?.toLowerCase()}`} /></SelectTrigger>
            <SelectContent>
              {entidadeList.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Impacto financeiro */}
      <div className="flex items-center gap-2">
        <Switch
          checked={parada.impacto_financeiro}
          onCheckedChange={(v) => onChange(parada.id, "impacto_financeiro", v)}
          className="scale-75"
        />
        <Label className="text-xs text-muted-foreground">Gera registro financeiro</Label>
      </div>

      {/* Quantidades */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">P13</Label>
          <Input type="number" min={0} className="h-8 text-xs" value={parada.qtd_p13}
            onChange={(e) => onChange(parada.id, "qtd_p13", parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <Label className="text-xs">P20</Label>
          <Input type="number" min={0} className="h-8 text-xs" value={parada.qtd_p20}
            onChange={(e) => onChange(parada.id, "qtd_p20", parseInt(e.target.value) || 0)} />
        </div>
        <div>
          <Label className="text-xs">P45</Label>
          <Input type="number" min={0} className="h-8 text-xs" value={parada.qtd_p45}
            onChange={(e) => onChange(parada.id, "qtd_p45", parseInt(e.target.value) || 0)} />
        </div>
      </div>

      {/* Cidade + Observações */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Cidade</Label>
          <Input className="h-8 text-xs" value={parada.cidade}
            onChange={(e) => onChange(parada.id, "cidade", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Observações</Label>
          <Input className="h-8 text-xs" value={parada.observacoes} placeholder="Opcional"
            onChange={(e) => onChange(parada.id, "observacoes", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
