import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";

interface ClienteSugestao {
  id: string;
  nome: string;
  telefone: string | null;
  bairro: string | null;
  endereco: string | null;
}

interface Props {
  value: string;
  onChange: (nome: string, cliente?: ClienteSugestao) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ClienteAutocompleteInput({ value, onChange, placeholder, disabled }: Props) {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const [results, setResults] = useState<ClienteSugestao[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (term: string) => {
    if (!empresa?.id || term.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("autocomplete_clientes_v2" as any, {
        _empresa_id: empresa.id,
        _unidade_id: unidadeAtual?.id || null,
        _termo: term.trim(),
        _limite: 12,
      });
      if (!error && data) {
        setResults(
          (data as any[]).map((c) => ({
            id: c.id,
            nome: c.nome,
            telefone: c.telefone,
            bairro: c.bairro,
            endereco: c.endereco,
          })),
        );
        setOpen(true);
      }
    } finally {
      setLoading(false);
    }
  }, [empresa?.id, unidadeAtual?.id]);

  const handleChange = (v: string) => {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(v), 300);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder || "Buscar cliente cadastrado..."}
          disabled={disabled}
          className="pl-8"
        />
        {loading && (
          <Loader2 className="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c.nome, c);
                setOpen(false);
                setResults([]);
              }}
              className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border last:border-0"
            >
              <div className="text-sm font-medium">{c.nome}</div>
              <div className="text-xs text-muted-foreground truncate">
                {[c.telefone, c.bairro || c.endereco].filter(Boolean).join(" • ")}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && value.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-xs text-muted-foreground">
          Nenhum cliente encontrado. O nome digitado será usado.
        </div>
      )}
    </div>
  );
}
