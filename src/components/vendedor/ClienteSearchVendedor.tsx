import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, UserPlus, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";

export interface ClienteVendedor {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  cep: string | null;
  tipo?: string | null;
}

interface Props {
  value: ClienteVendedor | null;
  onChange: (c: ClienteVendedor | null) => void;
  onRequestCadastro: (termo: string) => void;
}

export function ClienteSearchVendedor({ value, onChange, onRequestCadastro }: Props) {
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();
  const [termo, setTermo] = useState("");
  const [results, setResults] = useState<ClienteVendedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(
    async (t: string) => {
      if (!empresa?.id || t.trim().length < 2) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("autocomplete_clientes_v2" as any, {
          _empresa_id: empresa.id,
          _unidade_id: unidadeAtual?.id || null,
          _termo: t.trim(),
          _limite: 12,
        });
        if (!error && data) {
          setResults(
            (data as any[]).map((c) => ({
              id: c.id,
              nome: c.nome,
              telefone: c.telefone,
              endereco: c.endereco,
              numero: c.numero ?? null,
              bairro: c.bairro,
              cidade: c.cidade ?? null,
              cep: c.cep ?? null,
              tipo: c.tipo ?? null,
            })),
          );
          setOpen(true);
          setSearched(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [empresa?.id, unidadeAtual?.id],
  );

  const handleChange = (v: string) => {
    setTermo(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setResults([]);
      setOpen(false);
      setSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(v), 300);
  };

  if (value) {
    return (
      <div className="flex items-start justify-between p-3 border rounded-lg bg-accent/30">
        <div className="min-w-0">
          <p className="font-medium truncate">{value.nome}</p>
          {value.telefone && <p className="text-xs text-muted-foreground">{value.telefone}</p>}
          {(value.endereco || value.bairro) && (
            <p className="text-xs text-muted-foreground truncate">
              <MapPin className="inline h-3 w-3 mr-1" />
              {[value.endereco && value.numero ? `${value.endereco}, ${value.numero}` : value.endereco, value.bairro, value.cidade]
                .filter(Boolean)
                .join(" • ")}
            </p>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 text-base"
          placeholder="Buscar por endereço, rua, bairro, nome ou telefone"
          value={termo}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full bg-popover border border-border rounded-md shadow-lg max-h-72 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(c);
                setTermo("");
                setOpen(false);
                setResults([]);
              }}
              className="w-full text-left px-3 py-2 hover:bg-accent border-b border-border last:border-0"
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {[c.endereco && c.numero ? `${c.endereco}, ${c.numero}` : c.endereco, c.bairro]
                      .filter(Boolean)
                      .join(" — ") || "Sem endereço"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[c.nome, c.telefone, c.cidade].filter(Boolean).join(" • ")}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {searched && !loading && results.length === 0 && termo.trim().length >= 2 && (
        <div className="border border-dashed rounded-md p-3 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          <Button
            type="button"
            size="sm"
            onClick={() => onRequestCadastro(termo)}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Cadastrar novo cliente
          </Button>
        </div>
      )}

      {termo.trim().length < 2 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onRequestCadastro("")}
          className="w-full"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Cadastrar novo cliente
        </Button>
      )}
    </div>
  );
}
