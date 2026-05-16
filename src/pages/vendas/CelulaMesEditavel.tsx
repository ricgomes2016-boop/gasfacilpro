import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  valor: number;
  manual: number;
  metrica: "qtd" | "faturamento";
  editavel: boolean;
  onSalvar: (novoValor: number) => void;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CelulaMesEditavel({ valor, manual, metrica, editavel, onSalvar }: Props) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando) {
      setTexto(metrica === "qtd" ? String(Math.round(valor)) : valor.toFixed(2));
      setTimeout(() => inputRef.current?.focus(), 0);
      setTimeout(() => inputRef.current?.select(), 10);
    }
  }, [editando]);

  const display = metrica === "qtd"
    ? Math.round(valor).toLocaleString("pt-BR")
    : formatCurrency(valor);

  const temManual = manual > 0;

  const confirmar = () => {
    const num = parseFloat(texto.replace(",", ".")) || 0;
    setEditando(false);
    if (num !== valor) onSalvar(num);
  };

  if (!editavel) {
    return <span className="inline-block w-full text-center tabular-nums text-muted-foreground">{display}</span>;
  }

  if (editando) {
    return (
      <Input
        ref={inputRef}
        type="number"
        step="any"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.currentTarget.blur(); }
          if (e.key === "Escape") { setEditando(false); }
        }}
        className="h-8 w-24 text-right text-sm px-2 ml-auto"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      title={temManual ? `Inclui lançamento manual de ${manual.toLocaleString("pt-BR")}` : "Clique para lançar venda histórica"}
      className={cn(
        "group inline-flex w-full min-w-[72px] items-center justify-end gap-1 rounded px-2 py-1 tabular-nums hover:bg-muted/50",
        temManual && "text-primary font-semibold"
      )}
    >
      <span>{display}</span>
      {temManual && <span className="size-1.5 rounded-full bg-primary" />}
      <Pencil className="size-3 opacity-0 group-hover:opacity-60" />
    </button>
  );
}
