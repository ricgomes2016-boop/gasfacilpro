import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2, GripVertical } from "lucide-react";
import type { Parada } from "./RotaAtacadoMap";

const TIPO_OPTIONS = [
  { value: "saida", label: "🟢 Saída (empresa)" },
  { value: "coleta", label: "🔵 Coleta (distribuidora)" },
  { value: "transferencia", label: "🟣 Transferência (filial)" },
  { value: "venda", label: "🟠 Venda (cliente/revenda)" },
  { value: "retorno", label: "🔴 Retorno" },
];

const OPERACAO_OPTIONS = [
  { value: "entrada", label: "↓ Entrada (carga entra)" },
  { value: "saida", label: "↑ Saída (carga sai)" },
];

interface Props {
  parada: Parada;
  index: number;
  onChange: (id: string, field: string, value: any) => void;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
}

export function ParadaForm({ parada, index, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: Props) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
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
        <span className="text-sm truncate flex-1 font-medium">{parada.endereco || parada.cidade || "Sem endereço"}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemove(parada.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tipo de Parada</Label>
          <Select value={parada.tipo_parada} onValueChange={(v) => onChange(parada.id, "tipo_parada", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Operação</Label>
          <Select value={parada.operacao} onValueChange={(v) => onChange(parada.id, "operacao", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPERACAO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

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
  );
}
