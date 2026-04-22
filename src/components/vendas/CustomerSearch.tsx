import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Search, UserPlus, User, Phone, MapPin, Loader2, Map } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone, formatCEP } from "@/hooks/useInputMasks";
import { geocodeAddress } from "@/lib/geocoding";
import { MapPickerDialog } from "@/components/ui/map-picker-dialog";
import type { GeocodingResult } from "@/lib/geocoding";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";

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
  const [isGeocoding, setIsGeocoding] = useState(false);
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

  // Busca via RPC autocomplete_clientes (otimizada para grandes volumes)
  const executeSearch = useCallback(async (term: string, field: string) => {
    if (term.length < 2 || !empresa?.id) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    setActiveField(field);
    setIsSearching(true);

    try {
      const searchTerm = field === "telefone" ? term.replace(/\D/g, "") : term.trim();
      if (searchTerm.length < 2) {
        setSearchResults([]);
        setShowResults(false);
        setIsSearching(false);
        return;
      }

      const { data, error } = await supabase.rpc("autocomplete_clientes_v2" as any, {
        _empresa_id: empresa.id,
        _unidade_id: unidadeAtual?.id || null,
        _termo: searchTerm,
        _limite: 12,
      });

      if (!error && data) {
        // v2 returns: id, nome, telefone, endereco, numero, bairro, cep, cidade
        const mapped: Cliente[] = (data as any[]).map((c) => ({
          id: c.id,
          nome: c.nome,
          telefone: c.telefone,
          endereco: c.endereco,
          numero: c.numero,
          bairro: c.bairro,
          cep: c.cep ?? null,
          cidade: c.cidade ?? null,
        }));
        setSearchResults(mapped);
        setShowResults(mapped.length > 0);
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
    if (field === "nome" || field === "telefone") updates.id = null;
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

  // Show "new client" feedback
  const showNewClientHint = !isSearching && value.nome.trim().length >= 2 && !value.id && !showResults;

  return (
    <Card className="w-full min-w-0 max-w-full overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-5 w-5 shrink-0" />
          <span className="truncate">Cliente</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 w-full min-w-0 max-w-full">
        {/* Search Row */}
        <div className="flex flex-col sm:flex-row gap-3 min-w-0" ref={searchRef}>
          <div className="flex-1 relative min-w-0">
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="(00) 00000-0000"
                value={value.telefone}
                onChange={(e) => {
                  const formatted = formatPhone(e.target.value);
                  handleFieldChange("telefone", formatted);
                  searchClientes(formatted, "telefone");
                }}
                className="pl-10 w-full"
                maxLength={16}
              />
            </div>
          </div>
          <div className="flex-1 relative min-w-0">
            <Label className="text-xs text-muted-foreground">Nome do Cliente</Label>
            <div className="relative">
              <Input
                placeholder="Nome do cliente"
                value={value.nome}
                onChange={(e) => {
                  handleFieldChange("nome", e.target.value);
                  searchClientes(e.target.value, "nome");
                }}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {showNewClientHint && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                ✨ Novo cliente — será cadastrado automaticamente
              </p>
            )}
          </div>
          <Button
            variant="outline"
            className="self-stretch sm:self-end sm:mt-5 shrink-0 w-full sm:w-10"
            size="icon"
            onClick={() => {
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
            }}
            title="Novo cliente (limpar campos)"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Autocomplete Results */}
        {showResults && searchResults.length > 0 && (
          <div className="relative z-50 w-full min-w-0">
            <div className="absolute top-0 left-0 right-0 sm:max-w-md bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
              {searchResults.map((cliente) => (
                <button
                  key={cliente.id}
                  className="w-full min-w-0 px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectCliente(cliente);
                  }}
                >
                  <p className="font-medium text-sm truncate">{cliente.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {cliente.telefone} • {[cliente.endereco, cliente.numero, cliente.bairro].filter(Boolean).join(", ")}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

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
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Bairro</Label>
            <Input
              placeholder="Bairro"
              value={value.bairro}
              onChange={(e) => handleFieldChange("bairro", e.target.value)}
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
