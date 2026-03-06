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

export function CustomerSearch({ value, onChange }: CustomerSearchProps) {
  const { unidadeAtual } = useUnidade();
  const [searchResults, setSearchResults] = useState<Cliente[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [unidadeClienteIds, setUnidadeClienteIds] = useState<string[] | null>(null);

  // Fetch cliente IDs for current unidade
  useEffect(() => {
    if (!unidadeAtual?.id) {
      setUnidadeClienteIds(null);
      return;
    }
    supabase
      .from("cliente_unidades")
      .select("cliente_id")
      .eq("unidade_id", unidadeAtual.id)
      .then(({ data }) => {
        setUnidadeClienteIds(data ? data.map((d: any) => d.cliente_id) : []);
      });
  }, [unidadeAtual?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Função de busca principal - somente por telefone e nome
  const executeSearch = useCallback(async (term: string, field: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    setActiveField(field);
    setIsSearching(true);

    try {
      const filterByUnidade = unidadeClienteIds && unidadeClienteIds.length > 0;

      if (field === "telefone") {
        const cleanTerm = term.replace(/\D/g, "");
        if (cleanTerm.length < 2) {
          setSearchResults([]);
          setShowResults(false);
          setIsSearching(false);
          return;
        }

        let query = supabase
          .from("clientes")
          .select("id, nome, telefone, endereco, numero, bairro, cep, cidade")
          .eq("ativo", true)
          .ilike("telefone", `%${cleanTerm}%`)
          .limit(8);

        if (filterByUnidade) {
          query = query.in("id", unidadeClienteIds);
        }

        const { data, error } = await query;
        if (!error && data) {
          setSearchResults(data);
          setShowResults(data.length > 0);
        }
      } else if (field === "nome") {
        // Nome busca em nome, endereco, bairro, cidade
        const terms = term.trim().split(/\s+/).filter(t => t.length >= 2);
        if (terms.length === 0) {
          setSearchResults([]);
          setShowResults(false);
          setIsSearching(false);
          return;
        }

        let query = supabase
          .from("clientes")
          .select("id, nome, telefone, endereco, numero, bairro, cep, cidade")
          .eq("ativo", true)
          .limit(50);

        if (filterByUnidade) {
          query = query.in("id", unidadeClienteIds);
        }

        const { data, error } = await query;
        if (!error && data) {
          const normalize = (s: string) =>
            s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const filtered = data.filter(cliente => {
            const searchable = normalize([
              cliente.nome || "",
              cliente.endereco || "",
              cliente.bairro || "",
              cliente.cidade || "",
              cliente.numero || "",
            ].join(" "));
            return terms.every(t => searchable.includes(normalize(t)));
          }).slice(0, 8);

          setSearchResults(filtered);
          setShowResults(filtered.length > 0);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    } finally {
      setIsSearching(false);
    }
  }, [unidadeClienteIds]);

  const searchClientes = useCallback((term: string, field: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (term.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      executeSearch(term, field);
    }, 300);
  }, [executeSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const selectCliente = (cliente: Cliente) => {
    onChange({
      ...value,
      id: cliente.id,
      nome: cliente.nome,
      telefone: cliente.telefone || "",
      endereco: cliente.endereco || "",
      numero: cliente.numero || "",
      bairro: cliente.bairro || "",
      cep: cliente.cep || "",
    });
    setShowResults(false);
    setSearchResults([]);
  };

  const handleFieldChange = (field: keyof CustomerData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue, id: field === "nome" || field === "telefone" ? null : value.id });
  };

  // Geocode address on blur
  const handleAddressBlur = async () => {
    const fullAddress = [value.endereco, value.numero, value.bairro, value.cep].filter(Boolean).join(", ");
    if (fullAddress.length < 5) return;

    setIsGeocoding(true);
    const result = await geocodeAddress(fullAddress);
    if (result) {
      onChange({
        ...value,
        latitude: result.latitude,
        longitude: result.longitude,
        bairro: value.bairro || result.bairro || "",
      });
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

  return (
    <Card ref={searchRef}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-5 w-5" />
          Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Row */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
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
                className="pl-10"
                maxLength={16}
              />
            </div>
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Nome do Cliente</Label>
            <Input
              placeholder="Nome do cliente"
              value={value.nome}
              onChange={(e) => {
                handleFieldChange("nome", e.target.value);
                searchClientes(e.target.value, "nome");
              }}
            />
          </div>
          <Button
            variant="outline"
            className="mt-5"
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
              });
            }}
            title="Novo cliente (limpar campos)"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>

        {/* Autocomplete Results */}
        {showResults && searchResults.length > 0 && (
          <div className="relative z-50">
            <div className="absolute top-0 left-0 right-0 max-w-md bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
              {searchResults.map((cliente) => (
                <button
                  key={cliente.id}
                  className="w-full px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
                  onClick={() => selectCliente(cliente)}
                >
                  <p className="font-medium text-sm">{cliente.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {cliente.telefone} • {[cliente.endereco, cliente.numero, cliente.bairro].filter(Boolean).join(", ")}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Address Row */}
        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-3 relative">
            <Label className="text-xs text-muted-foreground">Endereço</Label>
            <div className="relative flex gap-1">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rua, Avenida..."
                  value={value.endereco}
                  onChange={(e) => {
                    handleFieldChange("endereco", e.target.value);
                  }}
                  onBlur={handleAddressBlur}
                  className="pl-10"
                />
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
            {value.latitude && value.longitude && (
              <p className="text-[10px] text-muted-foreground mt-1">
                📍 {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Número</Label>
            <Input
              placeholder="Nº"
              value={value.numero}
              onChange={(e) => handleFieldChange("numero", e.target.value)}
              onBlur={handleAddressBlur}
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
