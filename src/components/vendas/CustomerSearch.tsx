import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Search, UserPlus, User, Phone, MapPin, Loader2, Map, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone, formatCEP } from "@/hooks/useInputMasks";
import { geocodeAddress } from "@/lib/geocoding";
import { MapPickerDialog } from "@/components/ui/map-picker-dialog";
import type { GeocodingResult } from "@/lib/geocoding";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { toast } from "sonner";
import { VendaSectionHeader } from "./VendaSectionHeader";

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
}

interface CustomerData {
  id: string | null;
  nome: string;
  telefone: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  observacao: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface CustomerSearchProps {
  value: CustomerData;
  onChange: (data: CustomerData) => void;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
  };
}

// Normaliza string removendo acentos para comparação case/diacritic-insensitive
const normalize = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Destaca em <strong> os trechos do texto que coincidem com qualquer token da busca
function highlightMatch(text: string, term: string): React.ReactNode {
  if (!text) return text;
  const tokens = (term || "")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) return text;

  const normText = normalize(text);
  // mapeia cada caractere da string normalizada para seu índice na original (NFD pode mudar tamanho)
  // estratégia simples: buscar no texto original em paralelo, case/diacritic insensitive,
  // marcando intervalos que correspondem.
  const ranges: Array<[number, number]> = [];
  for (const tk of tokens) {
    const nTk = normalize(tk);
    if (!nTk) continue;
    let from = 0;
    while (from <= normText.length - nTk.length) {
      const idx = normText.indexOf(nTk, from);
      if (idx === -1) break;
      ranges.push([idx, idx + nTk.length]);
      from = idx + nTk.length;
    }
  }
  if (ranges.length === 0) return text;
  // merge overlapping
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  const out: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([s, e], i) => {
    if (s > cursor) out.push(text.slice(cursor, s));
    out.push(
      <strong key={i} className="font-semibold text-foreground">
        {text.slice(s, e)}
      </strong>,
    );
    cursor = e;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return <>{out}</>;
}

export function CustomerSearch({ value, onChange }: CustomerSearchProps) {
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);
  const [ultimoPedidoInfo, setUltimoPedidoInfo] = useState<{
    valor: number;
    data: string;
    forma: string | null;
  } | null>(null);
  const [loadingUltimo, setLoadingUltimo] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimResult[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const addressRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const addressDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
      if (addressRef.current && !addressRef.current.contains(event.target as Node)) {
        setShowAddressSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Busca multicampo: nome, telefone, endereço, número, bairro.
  // Estratégia: RPC retorna candidatos; refinamos no cliente exigindo TODOS os tokens.
  const executeSearch = useCallback(async (term: string, field: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2 || !empresa?.id) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    setActiveField(field);
    setIsSearching(true);

    try {
      // Tokens de busca (case/diacritic insensitive)
      const tokens = trimmed.split(/\s+/).filter((t) => t.length >= 1).map(normalize);
      // Termos enviados ao RPC: termo completo primeiro para endereços compostos
      // (ex: "maria lucas") e tokens depois para evitar perder resultados pelo LIMIT.
      const onlyDigits = trimmed.replace(/\D/g, "");
      const primaryTerm =
        onlyDigits.length >= trimmed.length - 2 && onlyDigits.length >= 4
          ? onlyDigits
          : trimmed;
      const extraTerms = onlyDigits === primaryTerm
        ? []
        : tokens.slice().sort((a, b) => b.length - a.length).filter((t) => t !== normalize(primaryTerm)).slice(0, 3);
      const rpcTerms = Array.from(new Set([primaryTerm, ...extraTerms]));

      const runAutocomplete = async (unidadeId: string | null) => Promise.all(
        rpcTerms.map((rpcTerm) => supabase.rpc("autocomplete_clientes_v2" as any, {
          _empresa_id: empresa.id,
          _unidade_id: unidadeId,
          _termo: rpcTerm,
          _limite: 80,
        }))
      );

      const responses = await runAutocomplete(unidadeAtual?.id || null);
      let rows = responses.flatMap(({ data, error }) => (!error && data ? data as any[] : []));

      // Em migrações de filial para matriz, alguns clientes podem ficar apenas com
      // empresa_id correto, mas sem vínculo atualizado em cliente_unidades.
      // O fallback continua isolado por empresa, só remove o filtro de unidade.
      if (rows.length === 0 && unidadeAtual?.id) {
        const fallbackResponses = await runAutocomplete(null);
        rows = fallbackResponses.flatMap(({ data, error }) => (!error && data ? data as any[] : []));
      }

      if (rows.length > 0) {
        const uniqueRows = Array.from(new globalThis.Map<string, any>(rows.map((c) => [c.id, c])).values());
        const mapped: Cliente[] = uniqueRows.map((c) => ({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone,
          endereco: c.endereco,
          numero: c.numero,
          bairro: c.bairro,
          cep: c.cep ?? null,
          cidade: c.cidade ?? null,
        }));

        // Refina exigindo que todos os tokens apareçam na "haystack" do cliente
        const refined = mapped.filter((c) => {
          const haystack = normalize(
            [c.nome, c.telefone, c.endereco, c.numero, c.bairro, c.cidade]
              .filter(Boolean)
              .join(" "),
          );
          return tokens.every((tk) => haystack.includes(tk));
        });

        const finalList = (refined.length > 0 ? refined : mapped).slice(0, 12);
        setSearchResults(finalList);
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(true);
      }
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    } finally {
      setIsSearching(false);
    }
  }, [empresa?.id, unidadeAtual?.id]);


  const searchClientes = useCallback((term: string, field: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (term.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      executeSearch(term, field);
    }, 300);
  }, [executeSearch]);

  // Resolve CEP via ViaCEP (primary source for Brazilian addresses)
  const resolverCepViaViaCEP = useCallback(async (logradouro: string, cidade?: string, bairroHint?: string): Promise<string | null> => {
    const uf = unidadeAtual?.estado || "PR";
    const cidadeUsar = cidade || unidadeAtual?.cidade || "";
    if (!logradouro || !cidadeUsar) return null;

    try {
      // Extract just the street name without type prefix for better matching
      const cleanLogradouro = logradouro.replace(/^(Rua|Avenida|Av\.|Travessa|Tv\.|Alameda|Al\.|Praça|Pc\.)\s+/i, "").trim();
      const searchTerm = cleanLogradouro.length >= 3 ? cleanLogradouro : logradouro;
      
      const response = await fetch(
        `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidadeUsar)}/${encodeURIComponent(searchTerm)}/json/`
      );
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        // If we have a bairro hint, try to find exact match
        if (bairroHint) {
          const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const match = data.find((d: any) => normalize(d.bairro || "").includes(normalize(bairroHint)));
          if (match?.cep) return formatCEP(match.cep);
        }
        // Otherwise return first result
        if (data[0].cep) return formatCEP(data[0].cep);
      }
    } catch (e) {
      console.error("Erro ao buscar CEP via ViaCEP:", e);
    }
    return null;
  }, [unidadeAtual?.estado, unidadeAtual?.cidade]);

  // Address autocomplete via Nominatim
  const searchAddress = useCallback(async (term: string) => {
    if (term.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    setIsSearchingAddress(true);
    try {
      const cidade = unidadeAtual?.cidade || "";
      const estado = unidadeAtual?.estado || "";
      const query = encodeURIComponent(`${term}, ${cidade}, ${estado}`.trim());
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=br&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "pt-BR" } }
      );
      const data: NominatimResult[] = await response.json();
      if (data && data.length > 0) {
        setAddressSuggestions(data);
        setShowAddressSuggestions(true);
      } else {
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
      }
    } catch (error) {
      console.error("Erro ao buscar endereço:", error);
    } finally {
      setIsSearchingAddress(false);
    }
  }, [unidadeAtual?.cidade, unidadeAtual?.estado]);

  const debouncedAddressSearch = useCallback((term: string) => {
    if (addressDebounceRef.current) {
      clearTimeout(addressDebounceRef.current);
    }
    if (term.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }
    addressDebounceRef.current = setTimeout(() => {
      searchAddress(term);
    }, 500);
  }, [searchAddress]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    setHighlightIndex(0);
  }, [searchResults]);

  const selectCliente = async (cliente: Cliente) => {
    let cep = cliente.cep || "";
    try {
      const { data } = await supabase
        .from("clientes")
        .select("cep")
        .eq("id", cliente.id)
        .maybeSingle();
      if (data?.cep) cep = data.cep;
    } catch (e) {
      console.error("Erro ao carregar CEP do cliente:", e);
    }

    onChange({
      ...value,
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone || "",
      endereco: cliente.endereco || "",
      numero: cliente.numero || "",
      bairro: cliente.bairro || "",
      cep,
    });
    setShowResults(false);
    setSearchResults([]);
    setSearchTerm("");

    // Carrega último pedido pago do cliente (último valor que ele pagou)
    setUltimoPedidoInfo(null);
    setLoadingUltimo(true);
    try {
      const { data: ult } = await supabase
        .from("pedidos")
        .select("valor_total, created_at, forma_pagamento, status")
        .eq("cliente_id", cliente.id)
        .in("status", ["entregue", "concluido", "finalizado", "pago"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let pedido = ult;
      if (!pedido) {
        // Fallback: pega o último pedido qualquer (exceto cancelado)
        const { data: any2 } = await supabase
          .from("pedidos")
          .select("valor_total, created_at, forma_pagamento, status")
          .eq("cliente_id", cliente.id)
          .neq("status", "cancelado")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        pedido = any2 ?? null;
      }

      if (pedido) {
        setUltimoPedidoInfo({
          valor: Number(pedido.valor_total) || 0,
          data: pedido.created_at as string,
          forma: (pedido as any).forma_pagamento ?? null,
        });
      }
    } catch (e) {
      console.error("Erro ao carregar último pedido do cliente:", e);
    } finally {
      setLoadingUltimo(false);
    }
  };

  const selectAddress = async (result: NominatimResult) => {
    const addr = result.address || {};
    const road = addr.road || value.endereco;
    const bairro = addr.suburb || addr.neighbourhood || value.bairro;
    const cidade = addr.city || addr.town || addr.village || unidadeAtual?.cidade || "";

    // Set address fields immediately (without CEP yet)
    const baseUpdate = {
      ...value,
      endereco: road,
      bairro,
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    };
    onChange({ ...baseUpdate, cep: value.cep }); // keep old CEP while resolving
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);

    // Always resolve CEP via ViaCEP (primary source)
    const cepViaCEP = await resolverCepViaViaCEP(road, cidade, bairro);
    if (cepViaCEP) {
      onChange({ ...baseUpdate, cep: cepViaCEP });
    } else {
      // Fallback: use Nominatim postcode if ViaCEP failed
      const cepNominatim = addr.postcode ? formatCEP(addr.postcode) : "";
      if (cepNominatim) {
        onChange({ ...baseUpdate, cep: cepNominatim });
      }
    }
  };

  const handleFieldChange = (field: keyof CustomerData, fieldValue: string) => {
    const updates: Partial<CustomerData> = { [field]: fieldValue };
    // Clear coords when address is edited so blur re-validates
    if (field === "endereco") {
      updates.latitude = null;
      updates.longitude = null;
    }
    onChange({ ...value, ...updates });
  };

  // Geocode address on blur — always re-validate CEP
  const handleAddressBlur = async () => {
    if (!value.endereco || value.endereco.length < 3) return;

    setIsGeocoding(true);
    try {
      // Build full address with unit city/state context
      const cidade = unidadeAtual?.cidade || "";
      const estado = unidadeAtual?.estado || "";
      const fullAddress = [value.endereco, value.numero, value.bairro, cidade, estado].filter(Boolean).join(", ");

      // Geocode if no coords
      if (!value.latitude || !value.longitude) {
        const result = await geocodeAddress(fullAddress);
        if (result) {
          onChange({
            ...value,
            latitude: result.latitude,
            longitude: result.longitude,
            bairro: value.bairro || result.bairro || "",
          });
        }
      }

      // Always resolve CEP via ViaCEP if not set or generic
      if (!value.cep || value.cep.replace(/\D/g, "").endsWith("000")) {
        const cep = await resolverCepViaViaCEP(value.endereco, cidade, value.bairro);
        if (cep) {
          onChange({
            ...value,
            latitude: value.latitude,
            longitude: value.longitude,
            bairro: value.bairro,
            cep,
          });
        }
      }
    } catch (e) {
      console.error("Erro no blur do endereço:", e);
    }
    setIsGeocoding(false);
  };

  // Handle map picker confirmation
  const handleMapConfirm = (result: GeocodingResult) => {
    onChange({
      ...value,
      latitude: result.latitude,
      longitude: result.longitude,
      endereco: result.endereco || value.endereco,
      bairro: result.bairro || value.bairro,
      cep: result.cep || value.cep,
    });
  };

  // CEP lookup
  const buscarCEP = async (cepValue: string) => {
    const cep = cepValue.replace(/\D/g, "");
    if (cep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        onChange({
          ...value,
          endereco: data.logradouro || value.endereco,
          bairro: data.bairro || value.bairro,
        });
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
  };

  const handleCEPChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCEP(e.target.value);
    handleFieldChange("cep", formatted);
    if (formatted.replace(/\D/g, "").length === 8) {
      buscarCEP(formatted);
    }
  };

  const salvarClienteAtual = async () => {
    if (!value.nome.trim()) {
      toast.error("Informe o nome do cliente antes de salvar");
      return;
    }

    if (!empresa?.id) {
      toast.error("Empresa não identificada. Faça login novamente.");
      return;
    }

    setIsSavingCustomer(true);
    try {
      if (value.id) {
        const { error } = await supabase
          .from("clientes")
          .update({
            nome: value.nome.trim(),
            telefone: value.telefone || null,
            endereco: value.endereco || null,
            numero: value.numero || null,
            bairro: value.bairro || null,
            cep: value.cep || null,
            latitude: value.latitude ?? null,
            longitude: value.longitude ?? null,
          })
          .eq("id", value.id);

        if (error) throw error;
        toast.success("Cliente atualizado");
        return;
      }

      const { data: novoCliente, error } = await supabase
        .from("clientes")
        .insert({
          nome: value.nome.trim(),
          telefone: value.telefone || null,
          endereco: value.endereco || null,
          numero: value.numero || null,
          bairro: value.bairro || null,
          cep: value.cep || null,
          cidade: unidadeAtual?.cidade || null,
          tipo: "residencial",
          ativo: true,
          empresa_id: empresa.id,
          latitude: value.latitude ?? null,
          longitude: value.longitude ?? null,
        })
        .select("id")
        .single();

      if (error) throw error;
      if (novoCliente?.id && unidadeAtual?.id) {
        const { error: unidadeError } = await supabase.from("cliente_unidades").insert({
          cliente_id: novoCliente.id,
          unidade_id: unidadeAtual.id,
        });
        if (unidadeError) console.error("Erro ao associar cliente à unidade:", unidadeError);
      }
      if (novoCliente?.id) onChange({ ...value, id: novoCliente.id });
      toast.success("Cliente salvo");
    } catch (error: any) {
      console.error("Erro ao salvar cliente:", error);
      toast.error(error?.message || "Erro ao salvar cliente");
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Show "new client" feedback
  const showNewClientHint = !isSearching && value.nome.trim().length >= 2 && !value.id && !showResults;

  return (
    <Card className="venda-card w-full min-w-0 max-w-full overflow-hidden">
      <VendaSectionHeader title="Cliente" icon={<User className="h-5 w-5 shrink-0" />} tone="info" className="pb-3" />
      <CardContent className="space-y-3 w-full min-w-0 max-w-full">
        {/* Combobox de busca multicampo */}
        <div className="relative min-w-0" ref={searchRef}>
          <Label className="text-xs text-muted-foreground">Buscar cliente</Label>
          <div className="flex gap-2 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                role="combobox"
                aria-expanded={showResults}
                aria-controls="customer-search-listbox"
                aria-autocomplete="list"
                autoComplete="off"
                placeholder="Nome, telefone, endereço, número ou bairro…"
                value={searchTerm}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchTerm(v);
                  searchClientes(v, "multi");
                  if (v.trim().length >= 2) setShowResults(true);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowResults(true);
                }}
                onKeyDown={(e) => {
                  if (!showResults || searchResults.length === 0) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.min(i + 1, searchResults.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const sel = searchResults[highlightIndex];
                    if (sel) selectCliente(sel);
                  } else if (e.key === "Escape") {
                    setShowResults(false);
                  }
                }}
                className="pl-10 pr-10 w-full"
                data-venda-enter-skip
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}

              {/* Popover de resultados — absoluto, z-50, sem deslocar layout */}
              {showResults && (
                <div
                  id="customer-search-listbox"
                  role="listbox"
                  ref={resultsListRef}
                  className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover text-popover-foreground border border-border rounded-md shadow-lg max-h-72 overflow-y-auto"
                >
                  {searchResults.length === 0 && !isSearching && searchTerm.trim().length >= 2 && (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      Nenhum cliente encontrado. Preencha os campos abaixo para cadastrar.
                    </div>
                  )}
                  {searchResults.map((cliente, idx) => {
                    const enderecoLinha = [cliente.endereco, cliente.numero].filter(Boolean).join(", ");
                    const linha2 = [enderecoLinha, cliente.bairro].filter(Boolean).join(" - ");
                    const isActive = idx === highlightIndex;
                    return (
                      <button
                        key={cliente.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        className={`w-full text-left px-4 py-2.5 border-b border-border last:border-0 transition-colors ${
                          isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
                        }`}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectCliente(cliente);
                        }}
                      >
                        <p className="font-medium text-sm truncate">
                          {highlightMatch(cliente.nome, searchTerm)}
                          {cliente.telefone && (
                            <span className="ml-2 text-xs text-muted-foreground font-normal">
                              {highlightMatch(cliente.telefone, searchTerm)}
                            </span>
                          )}
                        </p>
                        {linha2 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {highlightMatch(linha2, searchTerm)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => {
                setSearchTerm("");
                setSearchResults([]);
                setShowResults(false);
                setUltimoPedidoInfo(null);
                onChange({
                  ...value,
                  id: null,
                  nome: "",
                  telefone: "",
                  endereco: "",
                  numero: "",
                  complemento: "",
                  bairro: "",
                  cep: "",
                  observacao: "",
                  latitude: null,
                  longitude: null,
                });
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              title="Novo cliente (limpar campos)"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shrink-0 gap-1.5 px-2 sm:px-3"
              onClick={salvarClienteAtual}
              disabled={isSavingCustomer || !value.nome.trim()}
              title={value.id ? "Salvar alterações do cliente" : "Salvar novo cliente"}
            >
              {isSavingCustomer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden sm:inline">Salvar cliente</span>
              <span className="sm:hidden">Salvar</span>
            </Button>
          </div>
          {showNewClientHint && (
            <p className="text-[10px] text-muted-foreground mt-1">
              ✨ Cliente não encontrado — preencha abaixo e será cadastrado automaticamente
            </p>
          )}
          {value.id && (loadingUltimo || ultimoPedidoInfo) && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs">
              {loadingUltimo ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Buscando último pedido…
                </span>
              ) : ultimoPedidoInfo ? (
                <>
                  <span className="text-muted-foreground">Último valor pago:</span>
                  <strong className="text-primary">
                    {ultimoPedidoInfo.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </strong>
                  <span className="text-muted-foreground">
                    em {new Date(ultimoPedidoInfo.data).toLocaleDateString("pt-BR")}
                    {ultimoPedidoInfo.forma ? ` · ${ultimoPedidoInfo.forma}` : ""}
                  </span>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Campos de identificação (sempre visíveis para edição/cadastro) */}
        <div className="grid gap-3 sm:grid-cols-2 min-w-0">
          <div className="min-w-0">
            <Label className="text-xs text-muted-foreground">Nome do Cliente</Label>
            <Input
              placeholder="Nome do cliente"
              value={value.nome}
              onChange={(e) => handleFieldChange("nome", e.target.value)}
              data-venda-enter-next
            />
          </div>
          <div className="min-w-0">
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="(00) 00000-0000"
                value={value.telefone}
                onChange={(e) => handleFieldChange("telefone", formatPhone(e.target.value))}
                className="pl-10 w-full"
                maxLength={16}
                data-venda-enter-next
              />
            </div>
          </div>
        </div>

        {/* Address Row */}
        <div className="grid gap-3 md:grid-cols-4 min-w-0">
          <div className="md:col-span-3 relative min-w-0" ref={addressRef}>
            <Label className="text-xs text-muted-foreground">Endereço</Label>
            <div className="flex gap-1 min-w-0">
              <div className="relative flex-1 min-w-0">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rua, Avenida... (busca cliente também)"
                  value={value.endereco}
                  onChange={(e) => {
                    handleFieldChange("endereco", e.target.value);
                    debouncedAddressSearch(e.target.value);
                    // Também busca cliente por endereço quando não há cliente selecionado
                    if (!value.id) searchClientes(e.target.value, "endereco");
                  }}
                  onBlur={() => {
                    // delay to allow click on suggestion
                    setTimeout(() => {
                      setShowAddressSuggestions(false);
                      handleAddressBlur();
                    }, 200);
                  }}
                  className="pl-10 w-full"
                  data-venda-enter-next
                />
                {isSearchingAddress && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => setMapPickerOpen(true)}
                title="Selecionar no mapa"
              >
                {isGeocoding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Map className="h-4 w-4" />
                )}
              </Button>
            </div>
            {/* Address suggestions dropdown */}
            {showAddressSuggestions && addressSuggestions.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                {addressSuggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full px-4 py-2.5 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectAddress(s);
                    }}
                  >
                    <p className="text-sm truncate">{s.display_name}</p>
                  </button>
                ))}
              </div>
            )}
            {value.latitude && value.longitude && (
              <p className="text-[10px] text-muted-foreground mt-1 truncate">
                📍 {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <Label className="text-xs text-muted-foreground">Número</Label>
            <Input
              placeholder="Nº"
              value={value.numero}
              onChange={(e) => handleFieldChange("numero", e.target.value)}
              onBlur={handleAddressBlur}
              className="w-full"
              data-venda-enter-next
            />
          </div>
        </div>

        {/* Complement & Neighborhood */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">Complemento</Label>
            <Input
              placeholder="Apto, Bloco..."
              value={value.complemento}
              onChange={(e) => handleFieldChange("complemento", e.target.value)}
              data-venda-enter-next
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Bairro</Label>
            <Input
              placeholder="Bairro"
              value={value.bairro}
              onChange={(e) => handleFieldChange("bairro", e.target.value)}
              data-venda-enter-next
            />
          </div>
        </div>

        {/* CEP */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">CEP</Label>
            <Input
              placeholder="00000-000"
              value={value.cep}
              onChange={handleCEPChange}
              maxLength={9}
              data-venda-enter-next
            />
          </div>
        </div>

        {/* Observation */}
        <div>
          <Label className="text-xs text-muted-foreground">Observação do Pedido</Label>
          <Textarea
            placeholder="Observações sobre a entrega..."
            value={value.observacao}
            onChange={(e) => handleFieldChange("observacao", e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>
      </CardContent>

      {/* Map Picker Dialog */}
      <MapPickerDialog
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        initialPosition={
          value.latitude && value.longitude
            ? { lat: value.latitude, lng: value.longitude }
            : null
        }
        onConfirm={handleMapConfirm}
      />
    </Card>
  );
}
