import { useState, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, Plus, Search, Edit, Trash2, Phone, MapPin, FileText, Loader2, Camera, Check, X, Filter, Download, ImageIcon, ChevronDown, Navigation, FileUp, Merge, Building2, SearchCheck, Smartphone, ShoppingCart, History, Store } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrecosNegociadosTab } from "@/components/clientes/PrecosNegociadosTab";
import { HistoricoComprasDialog } from "@/components/clientes/HistoricoComprasDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { CpfCnpjInput } from "@/components/ui/cpf-cnpj-input";
import { formatPhone, formatCEP, validateCpfCnpj } from "@/hooks/useInputMasks";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { geocodeAddress, type GeocodingResult } from "@/lib/geocoding";
import { MapPickerDialog } from "@/components/ui/map-picker-dialog";
import { useRegrasCadastro } from "@/hooks/useRegrasCadastro";
import { MesclarClientesDialog } from "@/components/clientes/MesclarClientesDialog";
import { ClienteUnidadesDialog } from "@/components/clientes/ClienteUnidadesDialog";
import { FinancialHeroCard } from "@/components/ui/financial-hero-card";

interface Cliente {
  id: string;
  codigo_cliente?: number | null;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado?: string | null;
  cep: string | null;
  tipo: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean | null;
  created_at: string;
  cadastro_app?: boolean;
  inscricao_estadual?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  codigo_municipio?: string | null;
}

interface FormData {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  tipo: string;
  inscricao_estadual: string;
  razao_social: string;
  nome_fantasia: string;
  codigo_municipio: string;
}

const initialFormData: FormData = {
  nome: "",
  cpf: "",
  telefone: "",
  email: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  tipo: "residencial",
  inscricao_estadual: "",
  razao_social: "",
  nome_fantasia: "",
  codigo_municipio: "",
};

export default function CadastroClientesCad() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { regras } = useRegrasCadastro();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterBairro, setFilterBairro] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  // Address autocomplete state
  const [addressSuggestions, setAddressSuggestions] = useState<GeocodingResult[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addressDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Map picker state
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [clienteLatLng, setClienteLatLng] = useState<{ lat: number; lng: number } | null>(null);

  // Photo import state
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [extractedClients, setExtractedClients] = useState<FormData[]>([]);
  const [selectedClients, setSelectedClients] = useState<Set<number>>(new Set());
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Mesclar clientes
  const [isMesclarOpen, setIsMesclarOpen] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState<Set<string>>(new Set());
  const [mesclarPreSelected, setMesclarPreSelected] = useState<string[] | undefined>(undefined);

  const toggleMergeId = (id: string) => {
    setSelectedMergeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Unidades dialog
  const [unidadesDialogOpen, setUnidadesDialogOpen] = useState(false);
  const [unidadesClienteId, setUnidadesClienteId] = useState("");
  const [unidadesClienteNome, setUnidadesClienteNome] = useState("");

  // Histórico de compras
  const [historicoOpen, setHistoricoOpen] = useState(false);
  const [historicoCliente, setHistoricoCliente] = useState<{ id: string; nome: string } | null>(null);

  // CPF/CNPJ lookup
  const [isLookingUpCpfCnpj, setIsLookingUpCpfCnpj] = useState(false);

  // Exportar clientes
  const [isExporting, setIsExporting] = useState(false);

  const handleExportarClientes = async () => {
    if (isExporting) return;
    if (!empresa?.id) {
      toast({ title: "Empresa não identificada", variant: "destructive" });
      return;
    }
    setIsExporting(true);
    try {
      const columns =
        "id,codigo_cliente,nome,cpf,telefone,email,endereco,numero,bairro,cidade,estado,cep,tipo,ativo,created_at";
      const pageSize = 500;
      const all: any[] = [];
      let from = 0;
      // Exporta todos os clientes da empresa (RLS já limita ao escopo do usuário).
      // Paginação por PK (id) evita ordenação custosa em bases grandes.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("clientes")
          .select(columns)
          .eq("empresa_id", empresa.id)
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      // Ordenação por nome no cliente (mais rápido que forçar ORDER BY nome no server)
      all.sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));



      if (all.length === 0) {
        toast({ title: "Nenhum cliente encontrado" });
        return;
      }


      const headers = ["Código","Nome","CPF/CNPJ","Telefone","Email","Endereço","Número","Bairro","Cidade","Estado","CEP","Tipo","Ativo","Cadastrado em"];
      const escape = (v: any) => {
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return /[",;\n]/.test(s) ? `"${s}"` : s;
      };
      const rows = all.map(c => [
        c.codigo_cliente ?? "",
        c.nome ?? "",
        c.cpf ?? "",
        c.telefone ?? "",
        c.email ?? "",
        c.endereco ?? "",
        c.numero ?? "",
        c.bairro ?? "",
        c.cidade ?? "",
        c.estado ?? "",
        c.cep ?? "",
        c.tipo ?? "",
        c.ativo ? "Sim" : "Não",
        c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR") : "",
      ].map(escape).join(";"));
      const csv = "\uFEFF" + [headers.join(";"), ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `clientes_${(empresa.nome || "empresa").replace(/\s+/g, "_")}_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: `${all.length} cliente(s) exportado(s)` });
    } catch (err: any) {
      console.error("Erro ao exportar clientes:", err);
      toast({ title: "Erro ao exportar", description: err.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const [stats, setStats] = useState({
    total: 0,
    ativos: 0,
    residenciais: 0,
    comerciais: 0,
    revendedores: 0,
  });

  // Paginação server-side (otimizado para grandes volumes)
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce do searchTerm: aguarda 450ms antes de disparar busca no servidor
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      const term = searchTerm.trim();
      // Só dispara busca server-side se vazio OU >= 2 chars
      if (term.length === 0 || term.length >= 2) {
        setDebouncedSearch(term);
        setCurrentPage(0);
      }
    }, 450);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm]);

  useEffect(() => {
    fetchClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id, unidadeAtual?.id, currentPage, debouncedSearch, filterStatus]);

  // Stats são caros — recalcular apenas quando muda empresa/unidade (não a cada digitação ou paginação)
  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa?.id, unidadeAtual?.id]);

  const fetchStats = async () => {
    if (!empresa?.id) {
      setStats({ total: 0, ativos: 0, residenciais: 0, comerciais: 0, revendedores: 0 });
      return;
    }
    try {
      let unidadeIds: string[] | null = null;

      if (unidadeAtual?.id) {
        // Buscar IDs de clientes vinculados à unidade (paginado)
        const ids: string[] = [];
        let from = 0;
        const pageSize = 1000;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await supabase
            .from("cliente_unidades")
            .select("cliente_id")
            .eq("unidade_id", unidadeAtual.id)
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          ids.push(...data.map((d: any) => d.cliente_id));
          if (data.length < pageSize) break;
          from += pageSize;
        }
        if (ids.length === 0) {
          setStats({ total: 0, ativos: 0, residenciais: 0, comerciais: 0, revendedores: 0 });
          return;
        }
        unidadeIds = ids;
      }

      const applyScope = (q: any) => {
        let r = q.eq("empresa_id", empresa.id);
        if (unidadeIds) r = r.in("id", unidadeIds);
        return r;
      };

      const [{ count: cTotal }, { count: cAtivos }, { count: cRes }, { count: cCom }, { count: cRev }] = await Promise.all([
        applyScope(supabase.from("clientes").select("id", { count: "exact", head: true })),
        applyScope(supabase.from("clientes").select("id", { count: "exact", head: true })).eq("ativo", true),
        applyScope(supabase.from("clientes").select("id", { count: "exact", head: true })).eq("tipo", "residencial"),
        applyScope(supabase.from("clientes").select("id", { count: "exact", head: true })).eq("tipo", "comercial"),
        applyScope(supabase.from("clientes").select("id", { count: "exact", head: true })).eq("tipo", "revendedor"),
      ]);

      setStats({
        total: cTotal || 0,
        ativos: cAtivos || 0,
        residenciais: cRes || 0,
        comerciais: cCom || 0,
        revendedores: cRev || 0,
      });
    } catch (e) {
      console.error("Erro ao calcular stats:", e);
    }
  };

  const fetchClientes = async () => {
    if (!empresa?.id) {
      setClientes([]);
      setTotalCount(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Status filter mapping
      const apenasAtivos = filterStatus === "ativo" ? true : (filterStatus === "inativo" ? false : null);

      const { data, error } = await supabase.rpc("buscar_clientes_paginado", {
        _empresa_id: empresa.id,
        _unidade_id: unidadeAtual?.id || null,
        _termo: debouncedSearch || null,
        _apenas_ativos: apenasAtivos === null ? false : apenasAtivos,
        _limite: PAGE_SIZE,
        _offset: currentPage * PAGE_SIZE,
      });

      if (error) throw error;

      const rows = (data || []) as any[];
      let lista = rows;
      if (filterStatus === "inativo") {
        lista = rows.filter((c) => !c.ativo);
      }

      setClientes(lista as any);
      const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;
      setTotalCount(total);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os clientes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const buscarCEP = async () => {
    const cep = formData.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          estado: data.uf || prev.estado,
          codigo_municipio: data.ibge || prev.codigo_municipio,
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
  };

  // Auto-lookup CPF/CNPJ from BrasilAPI
  const buscarCpfCnpj = async (rawValue: string) => {
    const numbers = rawValue.replace(/\D/g, "");
    if (numbers.length !== 14) return; // Only CNPJ for now (CPF requires auth)

    setIsLookingUpCpfCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${numbers}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast({ title: "CNPJ não encontrado", description: "Verifique o número informado.", variant: "destructive" });
        }
        return;
      }
      const data = await res.json();
      setFormData((prev) => ({
        ...prev,
        nome: prev.nome || data.razao_social || data.nome_fantasia || "",
        razao_social: prev.razao_social || data.razao_social || "",
        nome_fantasia: prev.nome_fantasia || data.nome_fantasia || "",
        endereco: prev.endereco || data.logradouro || "",
        numero: prev.numero || data.numero || "",
        bairro: prev.bairro || data.bairro || "",
        cidade: prev.cidade || data.municipio || "",
        estado: prev.estado || data.uf || "",
        codigo_municipio: prev.codigo_municipio || String(data.codigo_municipio_ibge || data.codigo_municipio || "") || "",
        cep: prev.cep || data.cep?.replace(/(\d{5})(\d{3})/, "$1-$2") || "",
        email: prev.email || data.email || "",
        telefone: prev.telefone || data.ddd_telefone_1?.replace(/^(\d{2})(\d+)/, "($1) $2") || "",
        tipo: prev.tipo === "residencial" ? "comercial" : prev.tipo,
      }));
      toast({ title: "Dados encontrados!", description: `Razão social: ${data.razao_social || data.nome_fantasia}` });
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
    } finally {
      setIsLookingUpCpfCnpj(false);
    }
  };

  // Address autocomplete search using Nominatim
  const searchAddress = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearchingAddress(true);
    try {
      const cidade = formData.cidade || unidadeAtual?.cidade || "";
      const searchQuery = cidade ? `${query}, ${cidade}, Brasil` : `${query}, Brasil`;
      const encoded = encodeURIComponent(searchQuery);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=br&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "pt-BR" } }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const results: GeocodingResult[] = data.map((item: any) => {
          const addr = item.address || {};
          return {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            displayName: item.display_name,
            endereco: addr.road || undefined,
            bairro: addr.suburb || addr.neighbourhood || undefined,
            cidade: addr.city || addr.town || addr.village || undefined,
            cep: addr.postcode || undefined,
          };
        });
        setAddressSuggestions(results);
        setShowSuggestions(true);
      } else {
        setAddressSuggestions([]);
      }
    } catch (error) {
      console.error("Erro ao buscar endereço:", error);
    } finally {
      setIsSearchingAddress(false);
    }
  }, [formData.cidade, unidadeAtual?.cidade]);

  const handleAddressInputChange = (value: string) => {
    handleChange("endereco", value);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    addressDebounceRef.current = setTimeout(() => searchAddress(value), 500);
  };

  const selectAddressSuggestion = (suggestion: GeocodingResult) => {
    setFormData(prev => ({
      ...prev,
      endereco: suggestion.endereco || prev.endereco,
      bairro: suggestion.bairro || prev.bairro,
      cidade: suggestion.cidade || prev.cidade,
    }));
    setClienteLatLng({ lat: suggestion.latitude, lng: suggestion.longitude });
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  const handleMapConfirm = (result: GeocodingResult) => {
    setFormData(prev => ({
      ...prev,
      endereco: result.endereco || prev.endereco,
      bairro: result.bairro || prev.bairro,
      cidade: result.cidade || prev.cidade,
    }));
    setClienteLatLng({ lat: result.latitude, lng: result.longitude });
  };

  const openCreateModal = () => {
    setEditingCliente(null);
    // Auto-fill city from selected unit
    const cidadeUnidade = unidadeAtual?.cidade || "";
    setFormData({ ...initialFormData, cidade: cidadeUnidade, codigo_municipio: (unidadeAtual as any)?.codigo_municipio || "" });
    setClienteLatLng(null);
    setShowSuggestions(false);
    setIsModalOpen(true);
  };

  const openEditModal = async (cliente: Cliente) => {
    setEditingCliente(cliente);
    // Buscar campos extras (IE, razão social, etc.) diretamente do banco
    let extras: Partial<Cliente> = {};
    try {
      const { data } = await supabase
        .from("clientes")
        .select("inscricao_estadual, razao_social, nome_fantasia, estado, codigo_municipio")
        .eq("id", cliente.id)
        .maybeSingle();
      if (data) extras = data as any;
    } catch (e) {
      console.error("Erro ao carregar campos extras do cliente:", e);
    }
    // O campo numero é salvo separado no banco. Se não tiver, tentar extrair do endereço legado.
    let rua = cliente.endereco || "";
    let num = cliente.numero || "";
    let comp = "";
    if (!num && rua) {
      const match = rua.match(/^(.+?),\s*(?:Nº\s*)?(\d+\w*)(?:\s*[-,]\s*(.+))?$/);
      if (match) {
        rua = match[1].trim();
        num = match[2].trim();
        comp = match[3]?.trim() || "";
      }
    }
    setFormData({
      nome: cliente.nome,
      cpf: cliente.cpf || "",
      telefone: cliente.telefone || "",
      email: cliente.email || "",
      endereco: rua,
      numero: num,
      complemento: comp,
      bairro: cliente.bairro || "",
      cidade: cliente.cidade || "",
      estado: (extras.estado ?? cliente.estado) || "",
      cep: cliente.cep || "",
      tipo: cliente.tipo || "residencial",
      inscricao_estadual: (extras.inscricao_estadual ?? cliente.inscricao_estadual) || "",
      razao_social: (extras.razao_social ?? cliente.razao_social) || "",
      nome_fantasia: (extras.nome_fantasia ?? cliente.nome_fantasia) || "",
      codigo_municipio: (extras.codigo_municipio ?? cliente.codigo_municipio) || "",
    });
    // Load existing lat/lng
    if (cliente.latitude && cliente.longitude) {
      setClienteLatLng({ lat: cliente.latitude, lng: cliente.longitude });
    } else {
      setClienteLatLng(null);
    }
    setShowSuggestions(false);
    setIsModalOpen(true);
  };

  const checkDuplicates = async (_cpf: string, _excludeId?: string) => {
    // CPF/CNPJ duplicado é permitido (mesmo CNPJ pode pertencer a múltiplos clientes)
    return true;
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do cliente é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (regras.telefone_obrigatorio && !formData.telefone.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O telefone é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (regras.email_obrigatorio && !formData.email.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O e-mail é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (regras.cpf_obrigatorio && !formData.cpf.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O CPF/CNPJ é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (regras.endereco_obrigatorio && !formData.endereco.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O endereço é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    // Validar CPF/CNPJ se preenchido
    if (formData.cpf) {
      const cpfValidation = validateCpfCnpj(formData.cpf);
      const numbers = formData.cpf.replace(/\D/g, "");
      if ((numbers.length === 11 || numbers.length === 14) && !cpfValidation.valid) {
        toast({
          title: "CPF/CNPJ inválido",
          description: "Por favor, verifique o CPF/CNPJ informado.",
          variant: "destructive",
        });
        return;
      }
    }

    // Verificar duplicatas
    const noDuplicates = await checkDuplicates(formData.cpf, editingCliente?.id);
    if (!noDuplicates) return;

    setIsSaving(true);

    try {
      // Salvar endereço (rua) e número separados no banco
      const enderecoRua = formData.endereco.trim() || null;
      const enderecoNumero = formData.numero.trim() || null;

      // Geocode if we don't have coordinates yet
      let lat = clienteLatLng?.lat || null;
      let lng = clienteLatLng?.lng || null;
      if (!lat && enderecoRua) {
        const fullAddr = [
          enderecoRua,
          enderecoNumero,
          formData.bairro,
          formData.cidade,
        ].filter(Boolean).join(", ");
        const geo = await geocodeAddress(fullAddr);
        if (geo) {
          lat = geo.latitude;
          lng = geo.longitude;
        }
      }

      const clienteData: Record<string, any> = {
        nome: formData.nome.trim(),
        cpf: formData.cpf || null,
        telefone: formData.telefone || null,
        email: formData.email || null,
        endereco: enderecoRua,
        numero: enderecoNumero,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
        cep: formData.cep || null,
        tipo: formData.tipo,
        latitude: lat,
        longitude: lng,
        inscricao_estadual: formData.inscricao_estadual.trim() || null,
        razao_social: formData.razao_social.trim() || null,
        nome_fantasia: formData.nome_fantasia.trim() || null,
        codigo_municipio: formData.codigo_municipio.trim() || null,
      };

      if (editingCliente) {
        // Update
        const { error } = await supabase
          .from("clientes")
          .update(clienteData as any)
          .eq("id", editingCliente.id);

        if (error) throw error;

        toast({
          title: "Cliente atualizado!",
          description: `${formData.nome} foi atualizado com sucesso.`,
        });
      } else {
        // Create — must include empresa_id for RLS tenant isolation
        if (!empresa?.id) {
          toast({
            title: "Erro",
            description: "Empresa não identificada. Faça login novamente.",
            variant: "destructive",
          });
          return;
        }

        const { data: newCliente, error } = await supabase
          .from("clientes")
          .insert({ ...clienteData, ativo: true, empresa_id: empresa.id } as any)
          .select("id")
          .single();

        if (error) throw error;

        // Associate with current unidade
        if (newCliente && unidadeAtual?.id) {
          await supabase
            .from("cliente_unidades")
            .insert({ cliente_id: newCliente.id, unidade_id: unidadeAtual.id });
        }

        toast({
          title: "Cliente cadastrado!",
          description: `${formData.nome} foi adicionado com sucesso.`,
        });
      }

      setIsModalOpen(false);
      fetchClientes();
      fetchStats();
    } catch (error: any) {
      console.error("Erro ao salvar cliente:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o cliente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (cliente: Cliente) => {
    try {
      const { error } = await supabase
        .from("clientes")
        .update({ ativo: !cliente.ativo })
        .eq("id", cliente.id);

      if (error) throw error;

      toast({
        title: cliente.ativo ? "Cliente inativado" : "Cliente ativado",
        description: `${cliente.nome} foi ${cliente.ativo ? "inativado" : "ativado"}.`,
      });

      fetchClientes();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível alterar o status.",
        variant: "destructive",
      });
    }
  };

  // Photo import functions
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Formato inválido", description: "Use JPG, PNG ou WebP.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB.", variant: "destructive" });
      return;
    }

    setIsProcessingPhoto(true);
    setIsPhotoModalOpen(true);
    setExtractedClients([]);
    setSelectedClients(new Set());

    try {
      // Compress image before sending
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1600;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          resolve(dataUrl.split(",")[1]);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      const { data, error } = await supabase.functions.invoke("extract-clients-from-image", {
        body: { image_base64: base64, mime_type: file.type },
      });

      if (error) throw error;
      if (!data?.clientes || data.clientes.length === 0) {
        toast({ title: "Nenhum cliente encontrado", description: "A IA não conseguiu extrair dados da imagem.", variant: "destructive" });
        setIsPhotoModalOpen(false);
        return;
      }

      const mapped: FormData[] = data.clientes.map((c: any) => ({
        nome: c.nome || "",
        cpf: c.cpf || "",
        telefone: c.telefone || "",
        email: c.email || "",
        endereco: c.endereco || "",
        numero: c.numero || "",
        complemento: c.complemento || "",
        bairro: c.bairro || "",
        cidade: c.cidade || "",
        cep: c.cep || "",
        tipo: c.tipo || "residencial",
      }));

      setExtractedClients(mapped);
      setSelectedClients(new Set(mapped.map((_, i) => i)));
      toast({ title: `${mapped.length} cliente(s) encontrado(s)!`, description: "Revise e confirme o cadastro." });
    } catch (error: any) {
      console.error("Erro ao processar foto:", error);
      toast({ title: "Erro ao processar", description: error.message || "Falha na leitura da imagem.", variant: "destructive" });
      setIsPhotoModalOpen(false);
    } finally {
      setIsProcessingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  // PDF import function
  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast({ title: "Formato inválido", description: "Use apenas arquivos PDF.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB.", variant: "destructive" });
      return;
    }

    setIsProcessingPhoto(true);
    setIsPhotoModalOpen(true);
    setExtractedClients([]);
    setSelectedClients(new Set());

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("extract-clients-from-pdf", {
        body: { pdf_base64: base64 },
      });

      if (error) throw error;
      if (!data?.clientes || data.clientes.length === 0) {
        toast({ title: "Nenhum cliente encontrado", description: "A IA não conseguiu extrair dados do PDF.", variant: "destructive" });
        setIsPhotoModalOpen(false);
        return;
      }

      const mapped: FormData[] = data.clientes.map((c: any) => ({
        nome: c.nome || "",
        cpf: c.cpf || "",
        telefone: c.telefone || "",
        email: c.email || "",
        endereco: c.endereco || "",
        numero: c.numero || "",
        complemento: c.complemento || "",
        bairro: c.bairro || "",
        cidade: c.cidade || "",
        cep: c.cep || "",
        tipo: c.tipo || "residencial",
      }));

      setExtractedClients(mapped);
      setSelectedClients(new Set(mapped.map((_, i) => i)));
      toast({ title: `${mapped.length} cliente(s) encontrado(s)!`, description: "Revise e confirme o cadastro." });
    } catch (error: any) {
      console.error("Erro ao processar PDF:", error);
      toast({ title: "Erro ao processar", description: error.message || "Falha na leitura do PDF.", variant: "destructive" });
      setIsPhotoModalOpen(false);
    } finally {
      setIsProcessingPhoto(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const handleSaveBulkClients = async () => {
    const toSave = extractedClients.filter((_, i) => selectedClients.has(i));
    if (toSave.length === 0) {
      toast({ title: "Nenhum cliente selecionado", variant: "destructive" });
      return;
    }

    setIsSavingBulk(true);
    try {
      const skipped: string[] = [];
      const inserts = [];

      for (const c of toSave) {
        // CPF/CNPJ duplicado é permitido


        inserts.push({
          nome: c.nome.trim(),
          cpf: c.cpf || null,
          telefone: c.telefone || null,
          email: c.email || null,
          endereco: c.endereco || null,
          numero: c.numero || null,
          bairro: c.bairro || null,
          cidade: c.cidade || null,
          cep: c.cep || null,
          tipo: c.tipo,
          ativo: true,
          empresa_id: empresa?.id || null,
        });
      }

      if (inserts.length > 0) {
        const { data: insertedData, error: insertError } = await supabase.from("clientes").insert(inserts).select("id");
        if (insertError) throw insertError;

        // Associate bulk-imported clients with current unidade
        if (insertedData && unidadeAtual?.id) {
          const cuInserts = insertedData.map((c: any) => ({ cliente_id: c.id, unidade_id: unidadeAtual.id }));
          await supabase.from("cliente_unidades").insert(cuInserts);
        }
      }

      let message = `${inserts.length} cliente(s) cadastrado(s) com sucesso.`;
      if (skipped.length > 0) {
        message += `\n\n${skipped.length} cliente(s) ignorado(s):\n${skipped.join("\n")}`;
      }

      toast({ 
        title: inserts.length > 0 ? "Importação concluída" : "Nenhum cliente foi importado",
        description: message
      });
      
      if (inserts.length > 0) {
        setIsPhotoModalOpen(false);
        setExtractedClients([]);
        fetchClientes();
      }
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingBulk(false);
    }
  };

  const toggleClientSelection = (index: number) => {
    setSelectedClients(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Filter clients
  // OBS: busca textual e filterStatus já são tratados no servidor (RPC paginada).
  // Aqui aplicamos apenas filtros locais sobre a página retornada (50 itens).
  const filteredClientes = clientes.filter((cliente) => {
    const matchesTipo = filterTipo === "todos" || cliente.tipo === filterTipo;

    const clienteDate = new Date(cliente.created_at);
    const matchesDataInicio = !filterDataInicio || clienteDate >= new Date(filterDataInicio);
    const matchesDataFim = !filterDataFim || clienteDate <= new Date(filterDataFim + "T23:59:59");

    const matchesBairro = !filterBairro ||
      cliente.bairro?.toLowerCase().includes(filterBairro.toLowerCase());

    return matchesTipo && matchesDataInicio && matchesDataFim && matchesBairro;
  });

  const clearFilters = () => {
    setFilterTipo("todos");
    setFilterStatus("todos");
    setFilterDataInicio("");
    setFilterDataFim("");
    setFilterBairro("");
    setSearchTerm("");
    setCurrentPage(0);
  };

  const hasActiveFilters = filterTipo !== "todos" || filterStatus !== "todos" || filterDataInicio || filterDataFim || filterBairro;

  // Extrair bairros únicos para o select
  const bairrosUnicos = Array.from(new Set(clientes.map(c => c.bairro).filter(Boolean) as string[])).sort();

  return (
    <MainLayout>
      <Header title="Cadastro de Clientes" subtitle="Gerencie os clientes da revenda" />
      <div className="p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="modern-panel flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              onChange={handlePdfSelect}
              className="hidden"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="import" className="gap-2 flex-1 sm:flex-none">
                  <Camera className="h-4 w-4" />
                  Importar
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="h-4 w-4 mr-2" />
                  Tirar Foto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => photoInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Selecionar Imagem
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => pdfInputRef.current?.click()}>
                  <FileUp className="h-4 w-4 mr-2" />
                  Importar PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant={selectedMergeIds.size >= 2 ? "default" : "outline"}
              className="gap-2 flex-1 sm:flex-none"
              onClick={() => {
                if (selectedMergeIds.size >= 2) {
                  setMesclarPreSelected([...selectedMergeIds]);
                } else {
                  setMesclarPreSelected(undefined);
                }
                setIsMesclarOpen(true);
              }}
            >
              <Merge className="h-4 w-4" />
              {selectedMergeIds.size >= 2 ? `Mesclar (${selectedMergeIds.size})` : "Mesclar"}
            </Button>
            <Button
              variant="outline"
              className="gap-2 flex-1 sm:flex-none"
              onClick={handleExportarClientes}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exportar
            </Button>
            <Button className="gap-2 flex-1 sm:flex-none" onClick={openCreateModal}>
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-5">
          <FinancialHeroCard title="Total" value={stats.total} subtitle="Clientes cadastrados" color="primary" icon={Users} />
          <FinancialHeroCard title="Ativos" value={stats.ativos} subtitle={`${stats.total > 0 ? Math.round((stats.ativos / stats.total) * 100) : 0}% da base`} color="success" icon={Users} progress={stats.total > 0 ? Math.round((stats.ativos / stats.total) * 100) : 0} />
          <FinancialHeroCard title="Residenciais" value={stats.residenciais} subtitle="Perfil doméstico" color="info" icon={Users} />
          <FinancialHeroCard title="Comerciais" value={stats.comerciais} subtitle="Perfil empresarial" color="warning" icon={Users} />
          <FinancialHeroCard title="Revendedores" value={stats.revendedores} subtitle="Parceiros" color="violet" icon={Store} />
        </div>


        {/* Client List */}
        <Card className="modern-panel border-border/60 shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CardTitle>Lista de Clientes</CardTitle>
                  <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] font-medium">
                    {filteredClientes.length}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, telefone, CPF, endereço, bairro ou número..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-9 pl-9"
                    />
                  </div>
                  <Button
                    variant={showFilters ? "default" : "outline"}
                    size="icon"
                    onClick={() => setShowFilters(!showFilters)}
                    className="relative h-9 w-9 shrink-0"
                  >
                    <Filter className="h-4 w-4" />
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Filtros avançados */}
              {showFilters && (
                <div className="semantic-filter-panel grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Tipo</Label>
                    <Select value={filterTipo} onValueChange={setFilterTipo}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="residencial">Residencial</SelectItem>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                        <SelectItem value="revendedor">Revendedor</SelectItem>
                        <SelectItem value="condominio">Condomínio</SelectItem>
                        <SelectItem value="orgao_publico">Órgão Público</SelectItem>
                        <SelectItem value="rural">Rural</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Cadastro de</Label>
                    <Input 
                      type="date" 
                      value={filterDataInicio} 
                      onChange={(e) => setFilterDataInicio(e.target.value)} 
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Cadastro até</Label>
                    <Input 
                      type="date" 
                      value={filterDataFim} 
                      onChange={(e) => setFilterDataFim(e.target.value)} 
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Bairro</Label>
                    <Select value={filterBairro || "todos"} onValueChange={(v) => setFilterBairro(v === "todos" ? "" : v)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {bairrosUnicos.map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasActiveFilters && (
                    <div className="col-span-full flex justify-between items-center pt-1">
                      <span className="text-xs text-muted-foreground">
                        {filteredClientes.length} de {clientes.length} cliente(s)
                      </span>
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                        <X className="h-3 w-3 mr-1" /> Limpar filtros
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredClientes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum cliente encontrado</p>
              </div>
            ) : (
              <>
                {/* Mobile Cards */}
                <div className="space-y-3 md:hidden">
                  {filteredClientes.map((cliente) => (
                    <div key={cliente.id} className="semantic-mobile-card">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={selectedMergeIds.has(cliente.id)}
                          onCheckedChange={() => toggleMergeId(cliente.id)}
                          className="mt-1"
                          aria-label="Selecionar para mesclar"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-start gap-2">
                            {cliente.codigo_cliente && (
                              <span className="shrink-0 rounded-full border border-border/60 bg-muted/45 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
                                #{cliente.codigo_cliente}
                              </span>
                            )}
                            <p className="line-clamp-2 min-w-0 break-words text-base font-semibold leading-snug text-foreground">{cliente.nome}</p>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge variant={cliente.ativo ? "default" : "destructive"} className="h-5 rounded-full px-2 text-[10px] font-medium leading-none">
                              {cliente.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                            {cliente.tipo && <Badge variant="outline" className="h-5 rounded-full px-2 text-[10px] font-medium leading-none capitalize">{cliente.tipo}</Badge>}
                            {cliente.bairro && <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] font-medium leading-none">{cliente.bairro}</Badge>}
                            {cliente.cadastro_app && (
                              <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] font-medium leading-none gap-1">
                                <Smartphone className="h-3 w-3" />
                                App
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="hidden">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Lançar venda" onClick={() => navigate(`/vendas/nova?cliente_id=${cliente.id}`)}>
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Histórico" onClick={() => { setHistoricoCliente({ id: cliente.id, nome: cliente.nome }); setHistoricoOpen(true); }}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Unidades" onClick={() => { setUnidadesClienteId(cliente.id); setUnidadesClienteNome(cliente.nome); setUnidadesDialogOpen(true); }}>
                            <Building2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(cliente)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleStatus(cliente)}>
                            {cliente.ativo ? <X className="h-4 w-4 text-destructive" /> : <Check className="h-4 w-4 text-success" />}
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 text-sm text-muted-foreground">
                        {cliente.telefone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{cliente.telefone}</span>
                          </div>
                        )}
                        {(cliente.endereco || cliente.bairro) && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2 min-w-0 break-words">
                              {[cliente.endereco, cliente.numero, cliente.bairro].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-5 gap-1 border-t border-border/45 pt-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-full"
                          title="Lançar venda"
                          aria-label={`Lançar venda para ${cliente.nome}`}
                          onClick={() => navigate(`/vendas/nova?cliente_id=${cliente.id}`)}
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-full"
                          title="Histórico"
                          aria-label={`Abrir histórico de ${cliente.nome}`}
                          onClick={() => { setHistoricoCliente({ id: cliente.id, nome: cliente.nome }); setHistoricoOpen(true); }}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-full"
                          title="Unidades"
                          aria-label={`Abrir unidades de ${cliente.nome}`}
                          onClick={() => { setUnidadesClienteId(cliente.id); setUnidadesClienteNome(cliente.nome); setUnidadesDialogOpen(true); }}
                        >
                          <Building2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-full"
                          title="Editar"
                          aria-label={`Editar ${cliente.nome}`}
                          onClick={() => openEditModal(cliente)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-full"
                          title={cliente.ativo ? "Inativar" : "Ativar"}
                          aria-label={`${cliente.ativo ? "Inativar" : "Ativar"} ${cliente.nome}`}
                          onClick={() => handleToggleStatus(cliente)}
                        >
                          {cliente.ativo ? <X className="h-4 w-4 text-destructive" /> : <Check className="h-4 w-4 text-success" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={filteredClientes.length > 0 && filteredClientes.every(c => selectedMergeIds.has(c.id))}
                            onCheckedChange={(v) => {
                              setSelectedMergeIds(prev => {
                                const next = new Set(prev);
                                if (v) filteredClientes.forEach(c => next.add(c.id));
                                else filteredClientes.forEach(c => next.delete(c.id));
                                return next;
                              });
                            }}
                            aria-label="Selecionar todos"
                          />
                        </TableHead>
                        <TableHead className="w-20">Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead className="w-16">Nº</TableHead>
                        <TableHead>Bairro</TableHead>
                        <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                        <TableHead className="text-center">App</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientes.map((cliente) => {
                        const num = cliente.numero || "";
                        const rua = cliente.endereco || "";
                        return (
                          <TableRow key={cliente.id} data-state={selectedMergeIds.has(cliente.id) ? "selected" : undefined}>
                            <TableCell className="w-10">
                              <Checkbox
                                checked={selectedMergeIds.has(cliente.id)}
                                onCheckedChange={() => toggleMergeId(cliente.id)}
                                aria-label={`Selecionar ${cliente.nome}`}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {cliente.codigo_cliente ? `#${cliente.codigo_cliente}` : "-"}
                            </TableCell>
                            <TableCell className="font-medium">{cliente.nome}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm">{cliente.telefone || "-"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 max-w-[180px]">
                                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm truncate">{rua || "-"}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm font-mono">{num || "-"}</TableCell>
                            <TableCell>
                              {cliente.bairro ? <Badge variant="secondary">{cliente.bairro}</Badge> : <span className="text-sm text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <Badge variant="outline">{cliente.tipo || "N/E"}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {cliente.cadastro_app ? (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <Smartphone className="h-3 w-3" />
                                  Sim
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={cliente.ativo ? "default" : "destructive"}>
                                {cliente.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Lançar venda" onClick={() => navigate(`/vendas/nova?cliente_id=${cliente.id}`)}>
                                  <ShoppingCart className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Histórico" onClick={() => { setHistoricoCliente({ id: cliente.id, nome: cliente.nome }); setHistoricoOpen(true); }}>
                                  <History className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Unidades" onClick={() => { setUnidadesClienteId(cliente.id); setUnidadesClienteNome(cliente.nome); setUnidadesDialogOpen(true); }}>
                                  <Building2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditModal(cliente)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleStatus(cliente)}>
                                  {cliente.ativo ? <X className="h-4 w-4 text-destructive" /> : <Check className="h-4 w-4 text-success" />}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {/* Paginação server-side (otimizada para grandes volumes) */}
            {!isLoading && totalCount > 0 && (
              <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">
                  Mostrando <strong>{currentPage * PAGE_SIZE + 1}</strong>–
                  <strong>{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)}</strong> de{" "}
                  <strong>{totalCount.toLocaleString("pt-BR")}</strong> clientes
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Pág. {currentPage + 1} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage + 1 >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal para criar/editar cliente */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl p-3 sm:p-6 overflow-x-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-base sm:text-lg">
              {editingCliente ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="cadastro" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-2 w-full sm:w-fit shrink-0 h-11">
              <TabsTrigger value="cadastro" className="text-xs sm:text-sm">Dados Cadastrais</TabsTrigger>
              <TabsTrigger value="precos" disabled={!editingCliente} className="text-xs sm:text-sm">
                Preço Negociado
              </TabsTrigger>
            </TabsList>
            <TabsContent value="cadastro" className="flex-1 overflow-y-auto min-h-0 mt-3">
          <div className="space-y-3 sm:space-y-4 pr-1">
            <div className="min-w-0">
              <Label className="text-xs sm:text-sm">Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => handleChange("nome", e.target.value)}
                placeholder="Nome completo"
                className="h-9 text-base md:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="min-w-0">
                <Label className="text-xs sm:text-sm">CPF/CNPJ</Label>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <CpfCnpjInput
                      value={formData.cpf}
                      onChange={(value) => handleChange("cpf", value)}
                      placeholder="CPF ou CNPJ"
                      className="h-9 min-w-0 text-base md:text-sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-0 h-9 w-9 shrink-0"
                    disabled={isLookingUpCpfCnpj || formData.cpf.replace(/\D/g, "").length !== 14}
                    onClick={() => buscarCpfCnpj(formData.cpf)}
                    title="Buscar dados na Receita Federal (CNPJ)"
                  >
                    {isLookingUpCpfCnpj ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="min-w-0">
                <Label className="text-xs sm:text-sm">Telefone {regras.telefone_obrigatorio ? "*" : "(opcional)"}</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => handleChange("telefone", e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="h-9 text-base md:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="min-w-0">
                <Label className="text-xs sm:text-sm">
                  {formData.cpf.replace(/\D/g, "").length === 14 ? "Inscrição Estadual" : "RG / Inscrição Estadual"}
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.inscricao_estadual}
                    onChange={(e) => handleChange("inscricao_estadual", e.target.value)}
                    placeholder={formData.cpf.replace(/\D/g, "").length === 14 ? "IE ou ISENTO" : "RG"}
                    className="h-9 flex-1 text-base md:text-sm"
                  />
                  {formData.cpf.replace(/\D/g, "").length === 14 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 text-xs"
                      onClick={() => handleChange("inscricao_estadual", "ISENTO")}
                    >
                      Isento
                    </Button>
                  )}
                </div>
              </div>
              <div className="min-w-0">
                <Label className="text-xs sm:text-sm">Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="email@example.com"
                  className="h-9 text-base md:text-sm"
                />
              </div>
            </div>

            {formData.cpf.replace(/\D/g, "").length === 14 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 p-3 rounded-lg border bg-muted/30">
                <div className="min-w-0 sm:col-span-2">
                  <Label className="text-xs sm:text-sm flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Dados da Empresa (PJ)
                  </Label>
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">Razão Social</Label>
                  <Input
                    value={formData.razao_social}
                    onChange={(e) => handleChange("razao_social", e.target.value)}
                    placeholder="Razão Social"
                    className="h-9 text-base md:text-sm"
                  />
                </div>
                <div className="min-w-0">
                  <Label className="text-xs">Nome Fantasia</Label>
                  <Input
                    value={formData.nome_fantasia}
                    onChange={(e) => handleChange("nome_fantasia", e.target.value)}
                    placeholder="Nome Fantasia"
                    className="h-9 text-base md:text-sm"
                  />
                </div>
              </div>
            )}

            <div className="min-w-0">
              <Label className="text-xs sm:text-sm">CEP</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={formatCEP(formData.cep)}
                  onChange={(e) => handleChange("cep", e.target.value)}
                  placeholder="00000-000"
                  className="h-9 flex-1 text-base md:text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={buscarCEP}
                  disabled={formData.cep.replace(/\D/g, "").length !== 8}
                  className="h-9 w-full sm:w-auto"
                >
                  Buscar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-4">
              <div className="relative min-w-0 sm:col-span-3">
                <Label className="text-xs sm:text-sm">Endereço</Label>
                <div className="relative">
                  <Input
                    value={formData.endereco}
                    onChange={(e) => handleAddressInputChange(e.target.value)}
                    onFocus={() => addressSuggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Digite a rua para buscar..."
                    className="h-9 pr-9 text-base md:text-sm"
                  />
                  {isSearchingAddress && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                {showSuggestions && addressSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-background shadow-lg">
                    {addressSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 border-b last:border-b-0 transition-colors"
                        onMouseDown={() => selectAddressSuggestion(s)}
                      >
                        <p className="font-medium truncate">{s.endereco || s.displayName.split(",")[0]}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[s.bairro, s.cidade, s.cep].filter(Boolean).join(" • ")}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <Label className="text-xs sm:text-sm">Número</Label>
                <Input
                  value={formData.numero}
                  onChange={(e) => handleChange("numero", e.target.value)}
                  placeholder="Nº"
                  className="h-9 text-base md:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="min-w-0">
                <Label className="text-xs sm:text-sm">Complemento</Label>
                <Input
                  value={formData.complemento}
                  onChange={(e) => handleChange("complemento", e.target.value)}
                  placeholder="Apto, bloco, sala..."
                  className="h-9 text-base md:text-sm"
                />
              </div>
              <div className="min-w-0">
                <Label className="text-xs sm:text-sm">Bairro</Label>
                <Input
                  value={formData.bairro}
                  onChange={(e) => handleChange("bairro", e.target.value)}
                  placeholder="Bairro"
                  className="h-9 text-base md:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-8 sm:gap-4">
              <div className="min-w-0 sm:col-span-3">
                <Label className="text-xs sm:text-sm">Cidade</Label>
                <Input
                  value={formData.cidade}
                  onChange={(e) => handleChange("cidade", e.target.value)}
                  placeholder="Cidade"
                  className="h-9 text-base md:text-sm"
                />
              </div>
              <div className="min-w-0 sm:col-span-1">
                <Label className="text-xs sm:text-sm">UF</Label>
                <Input
                  value={formData.estado}
                  onChange={(e) => handleChange("estado", e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="UF"
                  maxLength={2}
                  className="h-9 text-base md:text-sm uppercase"
                />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <Label className="text-xs sm:text-sm">Código IBGE Município</Label>
                <Input
                  value={formData.codigo_municipio}
                  onChange={(e) => handleChange("codigo_municipio", e.target.value.replace(/\D/g, "").slice(0, 7))}
                  placeholder="Auto pelo CEP"
                  maxLength={7}
                  className="h-9 text-base md:text-sm"
                  title="Código IBGE do município (necessário para NF-e). Preenchido automaticamente ao buscar o CEP."
                />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <Label className="text-xs sm:text-sm">Tipo</Label>
                <Select value={formData.tipo} onValueChange={(value) => handleChange("tipo", value)}>
                  <SelectTrigger className="h-9 text-base md:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residencial">Residencial</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="revendedor">Revendedor</SelectItem>
                    <SelectItem value="condominio">Condomínio</SelectItem>
                    <SelectItem value="orgao_publico">Órgão Público</SelectItem>
                    <SelectItem value="rural">Rural</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Location indicator + map picker */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-start sm:items-center gap-2 text-sm flex-1 min-w-0">
                <MapPin className={`h-4 w-4 shrink-0 mt-0.5 sm:mt-0 ${clienteLatLng ? "text-primary" : "text-muted-foreground"}`} />
                {clienteLatLng ? (
                  <span className="text-foreground text-xs sm:text-sm">
                    📍 Localização definida — Lat: {clienteLatLng.lat.toFixed(5)}, Lng: {clienteLatLng.lng.toFixed(5)}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs sm:text-sm">Localização será calculada automaticamente ao salvar</span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsMapPickerOpen(true)}
                className="shrink-0 w-full sm:w-auto"
              >
                <Navigation className="h-3.5 w-3.5 mr-1" />
                {clienteLatLng ? "Ajustar no Mapa" : "Definir no Mapa"}
              </Button>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3 sm:pt-4">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="w-full sm:w-auto" onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>
            </TabsContent>
            <TabsContent value="precos" className="flex-1 overflow-y-auto min-h-0 mt-3">
              {editingCliente && <PrecosNegociadosTab clienteId={editingCliente.id} />}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Modal para importar por foto */}
      <Dialog open={isPhotoModalOpen} onOpenChange={setIsPhotoModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle>Importar Clientes da Foto</DialogTitle>
          </DialogHeader>
          {isProcessingPhoto ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p>Processando imagem...</p>
              </div>
            </div>
          ) : extractedClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum cliente extraído</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[60vh] overflow-y-auto space-y-2">
                {extractedClients.map((client, index) => {
                  const enderecoExibido = [client.endereco, client.numero ? `Nº ${client.numero}` : "", client.complemento].filter(Boolean).join(", ");
                  return (
                    <div key={index} className={`flex gap-3 items-start border p-3 rounded-lg transition-colors ${selectedClients.has(index) ? "bg-primary/5 border-primary/30" : ""}`}>
                      <Checkbox
                        checked={selectedClients.has(index)}
                        onCheckedChange={() => toggleClientSelection(index)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium truncate">{client.nome}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">{client.tipo || "residencial"}</Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 mt-1">
                          {client.telefone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {client.telefone}
                            </p>
                          )}
                          {client.cpf && (
                            <p className="text-xs text-muted-foreground">CPF: {client.cpf}</p>
                          )}
                          {enderecoExibido && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 col-span-full">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{enderecoExibido}{client.bairro ? ` — ${client.bairro}` : ""}{client.cidade ? `, ${client.cidade}` : ""}</span>
                            </p>
                          )}
                          {client.cep && (
                            <p className="text-xs text-muted-foreground">CEP: {client.cep}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsPhotoModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveBulkClients} disabled={isSavingBulk || selectedClients.size === 0}>
                  {isSavingBulk ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    `Importar ${selectedClients.size} cliente(s)`
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Map Picker Dialog */}
      <MapPickerDialog
        open={isMapPickerOpen}
        onOpenChange={setIsMapPickerOpen}
        initialPosition={clienteLatLng}
        onConfirm={handleMapConfirm}
      />

      {/* Mesclar Clientes Dialog */}
      <MesclarClientesDialog
        open={isMesclarOpen}
        onOpenChange={(o) => {
          setIsMesclarOpen(o);
          if (!o) setMesclarPreSelected(undefined);
        }}
        onMerged={() => {
          setSelectedMergeIds(new Set());
          fetchClientes();
        }}
        preSelectedIds={mesclarPreSelected}
      />

      {/* Cliente Unidades Dialog */}
      <ClienteUnidadesDialog
        open={unidadesDialogOpen}
        onOpenChange={setUnidadesDialogOpen}
        clienteId={unidadesClienteId}
        clienteNome={unidadesClienteNome}
        onSaved={fetchClientes}
      />

      <HistoricoComprasDialog
        open={historicoOpen}
        onOpenChange={setHistoricoOpen}
        clienteId={historicoCliente?.id ?? null}
        clienteNome={historicoCliente?.nome ?? ""}
      />
    </MainLayout>
  );
}
