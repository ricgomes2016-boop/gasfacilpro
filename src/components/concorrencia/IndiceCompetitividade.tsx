import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Minus, Shield } from "lucide-react";

interface Props {
  analise: {
    produto: string;
    nossoPrecoPortaria: number;
    nossoPrecoTelefone: number;
    mediaPortaria: number;
    mediaTelefone: number;
    menorPreco: number;
    maiorPreco: number;
    concorrentes: number;
    scorePortaria: number;
    scoreTelefone: number;
  }[];
}

function getScoreColor(score: number) {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

function getScoreBg(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

export function IndiceCompetitividade({ analise }: Props) {
  const scoreGeral = analise.length > 0
    ? Math.round(analise.reduce((s, a) => s + (a.scorePortaria + a.scoreTelefone) / 2, 0) / analise.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Score geral */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-black ${getScoreColor(scoreGeral)}`}>
              {scoreGeral}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-semibold text-base">Índice de Competitividade</span>
              </div>
              <Progress value={scoreGeral} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {scoreGeral >= 70 ? "Posição competitiva forte" : scoreGeral >= 40 ? "Posição mediana — avalie ajustes" : "Preços acima da média — risco de perda de clientes"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Por produto */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {analise.map(a => (
          <Card key={a.produto}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{a.produto}</h3>
                <Badge variant="outline" className="text-[10px]">{a.concorrentes} registros</Badge>
              </div>

              {/* Portaria */}
              {a.nossoPrecoPortaria > 0 && a.mediaPortaria > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Portaria</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">R$ {a.nossoPrecoPortaria.toFixed(2)}</span>
                      <span className="text-muted-foreground">vs</span>
                      <span>R$ {a.mediaPortaria.toFixed(2)}</span>
                      <PosicaoBadge nosso={a.nossoPrecoPortaria} media={a.mediaPortaria} />
                    </div>
                  </div>
                  <Progress value={a.scorePortaria} className="h-1.5" />
                </div>
              )}

              {/* Telefone */}
              {a.nossoPrecoTelefone > 0 && a.mediaTelefone > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Telefone</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">R$ {a.nossoPrecoTelefone.toFixed(2)}</span>
                      <span className="text-muted-foreground">vs</span>
                      <span>R$ {a.mediaTelefone.toFixed(2)}</span>
                      <PosicaoBadge nosso={a.nossoPrecoTelefone} media={a.mediaTelefone} />
                    </div>
                  </div>
                  <Progress value={a.scoreTelefone} className="h-1.5" />
                </div>
              )}

              {/* Faixa de preço */}
              <div className="text-xs text-muted-foreground flex justify-between border-t pt-2">
                <span>Faixa mercado</span>
                <span>R$ {a.menorPreco.toFixed(2)} — R$ {a.maiorPreco.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PosicaoBadge({ nosso, media }: { nosso: number; media: number }) {
  const diff = ((nosso - media) / media) * 100;
  if (Math.abs(diff) < 2) {
    return <Badge variant="secondary" className="text-[9px] h-4 px-1"><Minus className="h-2.5 w-2.5" /></Badge>;
  }
  if (diff < 0) {
    return <Badge className="text-[9px] h-4 px-1 bg-green-600"><TrendingDown className="h-2.5 w-2.5" /></Badge>;
  }
  return <Badge variant="destructive" className="text-[9px] h-4 px-1"><TrendingUp className="h-2.5 w-2.5" /></Badge>;
}
