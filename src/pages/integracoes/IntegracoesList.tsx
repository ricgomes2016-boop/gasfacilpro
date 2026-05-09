import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Building2, Plug, Settings } from "lucide-react";
import { categoriasLabel, statusConfig } from "./data";
import type { Integracao } from "./types";

interface IntegracoesListProps {
  integracoes: Integracao[];
  whatsappConfigsCount: number;
  getConfigsCountForIntegracao: (id: string) => number;
  onConfigure: (integracao: Integracao) => void;
}

export function IntegracoesList({
  integracoes,
  whatsappConfigsCount,
  getConfigsCountForIntegracao,
  onConfigure,
}: IntegracoesListProps) {
  const filteredCategorias = [...new Set(integracoes.map((i) => i.categoria))];

  return (
    <>
      {filteredCategorias.map((cat) => {
        const items = integracoes.filter((i) => i.categoria === cat);
        if (items.length === 0) return null;
        const catConfig = categoriasLabel[cat];
        const CatIcon = catConfig?.icon || Plug;

        return (
          <Card key={cat}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CatIcon className="h-4 w-4 text-muted-foreground" />
                {catConfig?.label || cat}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {items.map((integracao, idx) => {
                const Icon = integracao.icon;
                const status = statusConfig[integracao.status];
                const unitConfigsCount = integracao.isWhatsapp
                  ? whatsappConfigsCount
                  : getConfigsCountForIntegracao(integracao.id);

                return (
                  <div key={integracao.id}>
                    {idx > 0 && <Separator className="my-4" />}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2.5 rounded-lg bg-muted shrink-0">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{integracao.nome}</p>
                            <Badge variant={status.variant} className="gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                              {status.label}
                            </Badge>
                            {unitConfigsCount > 0 && (
                              <Badge variant="outline" className="gap-1 text-[10px]">
                                <Building2 className="h-3 w-3" />
                                {unitConfigsCount} unidade{unitConfigsCount > 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                            {integracao.descricao}
                          </p>
                          {integracao.beneficios && integracao.beneficios.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {integracao.beneficios.slice(0, 3).map((b, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] font-normal">
                                  {b}
                                </Badge>
                              ))}
                              {integracao.beneficios.length > 3 && (
                                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                                  +{integracao.beneficios.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="pl-11 sm:pl-0 flex items-center gap-2">
                        {integracao.status === "em_breve" ? (
                          <Badge variant="outline" className="text-muted-foreground">Em breve</Badge>
                        ) : (
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => onConfigure(integracao)}>
                            <Settings className="h-3.5 w-3.5" />
                            Configurar
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
