import { useState, useEffect, useRef, useCallback } from "react";
import { Calculator, Copy, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CalculatorPopoverProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

type Token = number | "+" | "-" | "*" | "/";

function evaluateExpression(expr: string): number {
  const tokens: Token[] = [];
  let i = 0;
  let prevWasOp = true;
  while (i < expr.length) {
    const c = expr[i];
    if (c === " ") { i++; continue; }
    if ("+-*/".includes(c) && !prevWasOp) {
      tokens.push(c as Token);
      prevWasOp = true;
      i++;
      continue;
    }
    let numStr = "";
    if ((c === "-" || c === "+") && prevWasOp) {
      numStr += c;
      i++;
    }
    while (i < expr.length && /[0-9.]/.test(expr[i])) {
      numStr += expr[i];
      i++;
    }
    if (numStr === "" || numStr === "-" || numStr === "+") {
      throw new Error("Expressão inválida");
    }
    const n = parseFloat(numStr);
    if (Number.isNaN(n)) throw new Error("Número inválido");
    tokens.push(n);
    prevWasOp = false;
  }
  if (tokens.length === 0) return 0;

  const pass1: Token[] = [];
  let j = 0;
  while (j < tokens.length) {
    const t = tokens[j];
    if (t === "*" || t === "/") {
      const left = pass1.pop() as number;
      const right = tokens[j + 1] as number;
      if (typeof left !== "number" || typeof right !== "number") throw new Error("Expressão inválida");
      pass1.push(t === "*" ? left * right : left / right);
      j += 2;
    } else {
      pass1.push(t);
      j++;
    }
  }
  let result = pass1[0] as number;
  if (typeof result !== "number") throw new Error("Expressão inválida");
  let k = 1;
  while (k < pass1.length) {
    const op = pass1[k] as "+" | "-";
    const next = pass1[k + 1] as number;
    if (typeof next !== "number") throw new Error("Expressão inválida");
    result = op === "+" ? result + next : result - next;
    k += 2;
  }
  return result;
}

function formatBR(n: number): string {
  if (!isFinite(n)) return "Erro";
  const rounded = Math.round(n * 1e10) / 1e10;
  return rounded.toLocaleString("pt-BR", { maximumFractionDigits: 10 });
}

export function CalculatorPopover({ externalOpen, onExternalClose }: CalculatorPopoverProps) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [display, setDisplay] = useState("0");
  const [history, setHistory] = useState<{ expr: string; result: string }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) onExternalClose?.();
  };

  const inputDigit = useCallback((d: string) => {
    setExpr((prev) => prev + d);
    setDisplay((prev) => (prev === "0" || prev === "Erro" ? d : prev + d));
  }, []);

  const inputDot = useCallback(() => {
    setExpr((prev) => {
      const m = prev.match(/(\d*\.?\d*)$/);
      if (m && m[1].includes(".")) return prev;
      return prev + ".";
    });
    setDisplay((prev) => (prev.includes(",") ? prev : prev + ","));
  }, []);

  const inputOp = useCallback((op: "+" | "-" | "*" | "/") => {
    setExpr((prev) => {
      if (prev === "") return op === "-" ? "-" : prev;
      const last = prev[prev.length - 1];
      if ("+-*/".includes(last)) return prev.slice(0, -1) + op;
      return prev + op;
    });
    const symbol = op === "*" ? "×" : op === "/" ? "÷" : op === "-" ? "−" : "+";
    setDisplay((prev) => {
      const last = prev[prev.length - 1];
      if ("+−×÷".includes(last)) return prev.slice(0, -1) + symbol;
      return prev + symbol;
    });
  }, []);

  const clearAll = useCallback(() => {
    setExpr("");
    setDisplay("0");
  }, []);

  const backspace = useCallback(() => {
    setExpr((prev) => prev.slice(0, -1));
    setDisplay((prev) => {
      if (prev.length <= 1) return "0";
      return prev.slice(0, -1);
    });
  }, []);

  const toggleSign = useCallback(() => {
    setExpr((prev) => {
      const m = prev.match(/(-?\d*\.?\d+)$/);
      if (!m) return prev;
      const num = m[1];
      const start = prev.length - num.length;
      const toggled = num.startsWith("-") ? num.slice(1) : "-" + num;
      const before = prev.slice(0, start);
      if (before.length > 0 && "+-*/".includes(before[before.length - 1])) {
        return before + toggled;
      }
      return before + toggled;
    });
    setDisplay((prev) => prev);
  }, []);

  const percent = useCallback(() => {
    setExpr((prev) => {
      const m = prev.match(/(-?\d*\.?\d+)$/);
      if (!m) return prev;
      const num = parseFloat(m[1]);
      const replaced = (num / 100).toString();
      return prev.slice(0, prev.length - m[1].length) + replaced;
    });
    setDisplay((prev) => {
      const m = prev.match(/([\d.,]+)$/);
      if (!m) return prev;
      const num = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      const replaced = formatBR(num / 100);
      return prev.slice(0, prev.length - m[1].length) + replaced;
    });
  }, []);

  const compute = useCallback(() => {
    if (!expr) return;
    try {
      const result = evaluateExpression(expr);
      const formatted = formatBR(result);
      setHistory((h) => [{ expr: display, result: formatted }, ...h].slice(0, 5));
      setDisplay(formatted);
      setExpr(result.toString());
    } catch {
      setDisplay("Erro");
      setExpr("");
    }
  }, [expr, display]);

  const copyResult = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(display);
      toast.success("Resultado copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }, [display]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const k = e.key;
      if (/^[0-9]$/.test(k)) { e.preventDefault(); inputDigit(k); }
      else if (k === "." || k === ",") { e.preventDefault(); inputDot(); }
      else if (k === "+") { e.preventDefault(); inputOp("+"); }
      else if (k === "-") { e.preventDefault(); inputOp("-"); }
      else if (k === "*") { e.preventDefault(); inputOp("*"); }
      else if (k === "/") { e.preventDefault(); inputOp("/"); }
      else if (k === "%") { e.preventDefault(); percent(); }
      else if (k === "Enter" || k === "=") { e.preventDefault(); compute(); }
      else if (k === "Backspace") { e.preventDefault(); backspace(); }
      else if (k === "Escape") { e.preventDefault(); handleOpenChange(false); }
      else if (k === "c" || k === "C") { e.preventDefault(); clearAll(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, inputDigit, inputDot, inputOp, percent, compute, backspace, clearAll]);

  const Btn = ({
    children,
    onClick,
    variant = "secondary",
    className,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: "secondary" | "default" | "outline" | "ghost";
    className?: string;
  }) => (
    <Button
      type="button"
      variant={variant}
      onClick={onClick}
      className={cn("h-11 text-base font-medium", className)}
    >
      {children}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hidden sm:inline-flex text-muted-foreground hover:text-foreground"
          title="Calculadora"
          aria-label="Calculadora"
        >
          <Calculator className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[280px] p-3"
      >
        <div ref={containerRef} className="space-y-2">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-right">
            <div className="text-xs text-muted-foreground truncate min-h-4" title={display}>
              {display}
            </div>
            <div className="text-2xl font-semibold tabular-nums truncate" title={display}>
              {display}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <Btn onClick={clearAll} variant="outline" className="text-destructive">C</Btn>
            <Btn onClick={toggleSign} variant="outline">±</Btn>
            <Btn onClick={percent} variant="outline">%</Btn>
            <Btn onClick={() => inputOp("/")} variant="default">÷</Btn>

            <Btn onClick={() => inputDigit("7")}>7</Btn>
            <Btn onClick={() => inputDigit("8")}>8</Btn>
            <Btn onClick={() => inputDigit("9")}>9</Btn>
            <Btn onClick={() => inputOp("*")} variant="default">×</Btn>

            <Btn onClick={() => inputDigit("4")}>4</Btn>
            <Btn onClick={() => inputDigit("5")}>5</Btn>
            <Btn onClick={() => inputDigit("6")}>6</Btn>
            <Btn onClick={() => inputOp("-")} variant="default">−</Btn>

            <Btn onClick={() => inputDigit("1")}>1</Btn>
            <Btn onClick={() => inputDigit("2")}>2</Btn>
            <Btn onClick={() => inputDigit("3")}>3</Btn>
            <Btn onClick={() => inputOp("+")} variant="default">+</Btn>

            <Btn onClick={() => inputDigit("0")} className="col-span-2">0</Btn>
            <Btn onClick={inputDot}>,</Btn>
            <Btn onClick={compute} variant="default" className="bg-primary text-primary-foreground">=</Btn>
          </div>

          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyResult}
              className="flex-1 h-8"
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copiar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={backspace}
              className="flex-1 h-8"
            >
              <Delete className="h-3.5 w-3.5 mr-1" />
              Apagar
            </Button>
          </div>

          {history.length > 0 && (
            <div className="border-t pt-2 mt-1">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 font-semibold">
                Histórico
              </div>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {history.map((h, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setDisplay(h.result);
                      setExpr(h.result.replace(/\./g, "").replace(",", "."));
                    }}
                    className="w-full text-right text-xs hover:bg-muted/60 rounded px-1.5 py-0.5 truncate"
                    title={`${h.expr} = ${h.result}`}
                  >
                    <span className="text-muted-foreground">{h.expr} =</span>{" "}
                    <span className="font-medium tabular-nums">{h.result}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
