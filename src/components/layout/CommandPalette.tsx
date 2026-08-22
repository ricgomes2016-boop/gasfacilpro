import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { menuItems } from "./menuItems";
import { supabase } from "@/integrations/supabase/client";
import { Users, ShoppingCart, Search, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  path: string;
  icon: React.ReactNode;
  group: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [clienteResults, setClienteResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "F2") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Flatten menu items for navigation search
  const navItems = useMemo(() => {
    const items: SearchResult[] = [];
    menuItems.forEach((item) => {
      if (item.path) {
        items.push({
          id: item.path,
          label: item.label,
          path: item.path,
          icon: <item.icon className="h-4 w-4" />,
          group: "Navegação",
        });
      }
      item.submenu?.forEach((sub) => {
        items.push({
          id: sub.path,
          label: sub.label,
          sublabel: item.label,
          path: sub.path,
          icon: <sub.icon className="h-4 w-4" />,
          group: item.label,
        });
      });
    });
    return items;
  }, []);

  // Quick actions
  const quickActions: SearchResult[] = useMemo(
    () => [
      {
        id: "action-nova-venda",
        label: "Nova Venda",
        sublabel: "Criar um novo pedido",
        path: "/vendas/nova",
        icon: <ShoppingCart className="h-4 w-4" />,
        group: "Ações Rápidas",
      },
      {
        id: "action-novo-cliente",
        label: "Novo Cliente",
        sublabel: "Cadastrar cliente",
        path: "/clientes/cadastro",
        icon: <Users className="h-4 w-4" />,
        group: "Ações Rápidas",
      },
    ],
    []
  );

  // Search clients in DB
  const searchClientes = useCallback(async (q: string) => {
    if (q.length < 2) {
      setClienteResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone, bairro")
        .eq("ativo", true)
        .or(`nome.ilike.%${q}%,telefone.ilike.%${q}%`)
        .limit(5);

      setClienteResults(
        (data || []).map((c) => ({
          id: `cliente-${c.id}`,
          label: c.nome || "Sem nome",
          sublabel: [c.telefone, c.bairro].filter(Boolean).join(" • "),
          path: `/clientes/cadastro?search=${encodeURIComponent(c.nome || "")}`,
          icon: <Users className="h-4 w-4" />,
          group: "Clientes",
        }))
      );
    } catch {
      setClienteResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => searchClientes(query), 300);
    return () => clearTimeout(timer);
  }, [query, searchClientes]);

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery("");
    navigate(path);
  };

  // Filter nav items
  const filteredNav = query
    ? navItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : navItems.slice(0, 8);

  // Group nav items by parent
  const groupedNav = filteredNav.reduce<Record<string, SearchResult[]>>(
    (acc, item) => {
      const group = item.group;
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    },
    {}
  );

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Buscar no sistema"
        className="flex h-9 w-9 items-center justify-center gap-2 rounded-control border border-border bg-muted/50 text-sm text-muted-foreground transition-colors hover:bg-muted xl:w-44 xl:justify-start xl:px-3 2xl:w-64"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden min-w-0 flex-1 truncate text-left xl:block">Buscar...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-60 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>


      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar página, cliente, ação..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>
            {searching ? "Buscando..." : "Nenhum resultado encontrado."}
          </CommandEmpty>

          {/* Quick Actions */}
          {!query && (
            <CommandGroup heading="⚡ Ações Rápidas">
              {quickActions.map((action) => (
                <CommandItem
                  key={action.id}
                  value={action.label}
                  onSelect={() => handleSelect(action.path)}
                  className="gap-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {action.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.sublabel}</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Client results */}
          {clienteResults.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="👤 Clientes encontrados">
                {clienteResults.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.label} ${c.sublabel}`}
                    onSelect={() => handleSelect(c.path)}
                    className="gap-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/10 text-info">
                      {c.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{c.label}</p>
                      {c.sublabel && (
                        <p className="text-xs text-muted-foreground">{c.sublabel}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[10px]">Cliente</Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Navigation */}
          <CommandSeparator />
          {Object.entries(groupedNav).map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.sublabel || ""}`}
                  onSelect={() => handleSelect(item.path)}
                  className="gap-3"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm">{item.label}</p>
                  </div>
                  {item.sublabel && (
                    <span className="text-[10px] text-muted-foreground">{item.sublabel}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
