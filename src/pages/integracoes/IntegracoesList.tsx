import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search } from "lucide-react";
import { IntegracaoCard } from "./IntegracaoCard";
import type { Integracao } from "./types";

interface IntegracoesListProps {
  integracoes: Integracao[];
  configuredIds: string[];
  onConfigure: (integracao: Integracao) => void;
  isLoading?: boolean;
}

export function IntegracoesList({
  integracoes,
  configuredIds,
  onConfigure,
  isLoading = false,
}: IntegracoesListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Agrupar por categoria
  const categorias = useMemo(() => {
    const cats = new Set(integracoes.map((i) => i.categoria));
    return Array.from(cats);
  }, [integracoes]);

  // Filtrar integrações
  const filteredIntegracoes = useMemo(() => {
    return integracoes.filter((integracao) => {
      const matchesSearch =
        integracao.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        integracao.descricao.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        !selectedCategory || integracao.categoria === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [integracoes, searchTerm, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Barra de Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar integrações..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Abas de Categorias */}
      <Tabs
        value={selectedCategory || "todos"}
        onValueChange={(value) =>
          setSelectedCategory(value === "todos" ? null : value)
        }
      >
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          <TabsTrigger value="todos">Todos</TabsTrigger>
          {categorias.map((categoria) => (
            <TabsTrigger key={categoria} value={categoria} className="capitalize">
              {categoria.replace("_", " ")}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Conteúdo das Abas */}
        <TabsContent value={selectedCategory || "todos"} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIntegracoes.length > 0 ? (
              filteredIntegracoes.map((integracao) => (
                <IntegracaoCard
                  key={integracao.id}
                  integracao={integracao}
                  onConfigure={onConfigure}
                  isConfigured={configuredIds.includes(integracao.id)}
                  isLoading={isLoading}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">
                  Nenhuma integração encontrada
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
