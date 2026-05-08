import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import type { IntegracaoCardProps } from "./types";

export function IntegracaoCard({
  integracao,
  onConfigure,
  isConfigured,
  isLoading = false,
}: IntegracaoCardProps) {
  const Icon = integracao.icon;

  const statusConfig = {
    conectado: { label: "Conectado", color: "bg-green-100 text-green-800" },
    disponivel: { label: "Disponível", color: "bg-blue-100 text-blue-800" },
    em_breve: { label: "Em breve", color: "bg-gray-100 text-gray-800" },
  };

  const status = statusConfig[integracao.status];

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Icon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg">{integracao.nome}</CardTitle>
              <CardDescription>{integracao.descricao}</CardDescription>
            </div>
          </div>
          <Badge className={status.color}>{status.label}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Benefícios */}
          {integracao.beneficios && integracao.beneficios.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Benefícios:</h4>
              <ul className="text-sm space-y-1">
                {integracao.beneficios.map((beneficio, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    {beneficio}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status de Configuração */}
          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
            {isConfigured ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">Configurado</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-orange-700">Não configurado</span>
              </>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => onConfigure(integracao)}
              disabled={integracao.status === "em_breve" || isLoading}
              className="flex-1"
            >
              {isConfigured ? "Editar" : "Configurar"}
            </Button>

            {integracao.helpUrl && (
              <Button
                variant="outline"
                size="icon"
                asChild
              >
                <a href={integracao.helpUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
