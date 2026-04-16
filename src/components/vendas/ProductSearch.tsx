// PATCHED RESPONSIVE VERSION
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Package, Search, Trash2, Plus, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ... (mantido igual até render)

  return (
    <Card className="w-full min-w-0">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-5 w-5" />
          Produtos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 w-full min-w-0">
        {/* Search Input */}
        <div className="relative w-full min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produto por nome..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              searchProdutos(e.target.value);
            }}
            className="pl-10 w-full min-w-0 truncate"
          />

          {/* Autocomplete Results */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-50 w-full min-w-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
              {searchResults.map((produto) => (
                <button
                  key={produto.id}
                  className="w-full min-w-0 px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0 flex justify-between items-center gap-2"
                  onClick={() => addItem(produto)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{produto.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      Estoque: {produto.estoque ?? "N/A"}
                    </p>
                  </div>
                  <span className="font-semibold text-primary shrink-0 text-sm">
                    R$ {produto.preco.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items Table */}
        {itens.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto w-full min-w-0">
            <Table className="min-w-0 w-full">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12 hidden sm:table-cell">Cód.</TableHead>
                  <TableHead className="px-2 sm:px-4">Produto</TableHead>
                  <TableHead className="w-[110px] sm:w-28 text-center px-1 sm:px-4">Qtd</TableHead>
                  <TableHead className="w-20 sm:w-24 text-right px-1 sm:px-4">Unit.</TableHead>
                  <TableHead className="w-20 sm:w-24 text-right hidden sm:table-cell">Total</TableHead>
                  <TableHead className="w-10 px-1 sm:px-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground hidden sm:table-cell">
                      {item.produto_id.slice(0, 4)}
                    </TableCell>
                    <TableCell className="font-medium px-2 sm:px-4 py-2 sm:py-4">
                      <div className="min-w-0">
                        <p className="text-sm truncate">{item.nome}</p>
                        <p className="text-xs font-semibold text-primary sm:hidden mt-0.5">
                          R$ {item.total.toFixed(2)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-1 sm:px-4 py-2 sm:py-4">
                      <div className="flex items-center justify-center gap-0.5 sm:gap-1 min-w-0">
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          className="w-12 sm:w-16 text-center h-8 text-sm px-1 min-w-0"
                          value={item.quantidade}
                        />
                        <Button variant="outline" size="icon" className="h-8 w-8 shrink-0">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right px-1 sm:px-4 py-2 sm:py-4">
                      <Input
                        type="number"
                        className="w-16 sm:w-24 text-right h-8 text-sm px-1 sm:px-3 min-w-0"
                        value={item.preco_unitario}
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold hidden sm:table-cell">
                      R$ {item.total.toFixed(2)}
                    </TableCell>
                    <TableCell className="px-1 sm:px-4 py-2 sm:py-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhum produto adicionado</p>
            <p className="text-xs">Busque e selecione produtos acima</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
