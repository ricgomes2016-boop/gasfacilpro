import { useState } from "react";
import { ClienteLayout } from "@/components/cliente/ClienteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Calculator, 
  Flame, 
  Users, 
  Clock, 
  TrendingUp,
  Calendar,
  Lightbulb,
  RefreshCw
} from "lucide-react";

interface CalculationResult {
  daysPerBottle: number;
  bottlesPerMonth: number;
  monthlyCost: number;
  yearlyCost: number;
  nextPurchase: Date;
}

export default function ClienteConsumo() {
  const [residents, setResidents] = useState<number[]>([2]);
  const [cookingFrequency, setCookingFrequency] = useState("medium");
  const [hasOven, setHasOven] = useState("no");
  const [lastPurchase, setLastPurchase] = useState("");
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Base consumption factors
  const frequencyFactors: Record<string, number> = {
    low: 0.7,      // 1-2 refeições/dia
    medium: 1,     // 3-4 refeições/dia
    high: 1.3,     // 5+ refeições/dia
  };

  const ovenFactor: Record<string, number> = {
    no: 1,
    sometimes: 1.15,
    often: 1.3,
  };

  const calculateConsumption = () => {
    setIsCalculating(true);
    
    setTimeout(() => {
      const numResidents = residents[0];
      const freqFactor = frequencyFactors[cookingFrequency];
      const ovenMultiplier = ovenFactor[hasOven];
      
      // Base: 1 pessoa usa ~1 botijão em 45 dias
      const baseConsumptionDays = 45;
      
      // Ajuste por número de pessoas (não linear - economia de escala)
      const residentsAdjust = Math.pow(numResidents, 0.7);
      
      // Cálculo final
      const daysPerBottle = Math.round(
        baseConsumptionDays / (residentsAdjust * freqFactor * ovenMultiplier)
      );
      
      const bottlesPerMonth = 30 / daysPerBottle;
      const bottlePrice = 110; // Preço médio do P13
      const monthlyCost = bottlesPerMonth * bottlePrice;
      const yearlyCost = monthlyCost * 12;
      
      // Previsão próxima compra
      let nextPurchase = new Date();
      if (lastPurchase) {
        nextPurchase = new Date(lastPurchase);
        nextPurchase.setDate(nextPurchase.getDate() + daysPerBottle);
      } else {
        nextPurchase.setDate(nextPurchase.getDate() + daysPerBottle);
      }
      
      setResult({
        daysPerBottle,
        bottlesPerMonth: Math.round(bottlesPerMonth * 10) / 10,
        monthlyCost: Math.round(monthlyCost),
        yearlyCost: Math.round(yearlyCost),
        nextPurchase
      });
      
      setIsCalculating(false);
    }, 800);
  };

  const resetCalculator = () => {
    setResidents([2]);
    setCookingFrequency("medium");
    setHasOven("no");
    setLastPurchase("");
    setResult(null);
  };

  return (
    <ClienteLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Calculadora de Consumo</h1>

        <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calculator className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Estime seu consumo de gás</p>
                <p className="text-sm text-muted-foreground">
                  Descubra quanto tempo dura seu botijão e quanto você gasta por mês
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Quantas pessoas moram na casa?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Slider
                value={residents}
                onValueChange={setResidents}
                min={1}
                max={10}
                step={1}
                className="flex-1"
              />
              <Badge variant="secondary" className="text-lg px-4">
                {residents[0]}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Frequência de cozimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={cookingFrequency} onValueChange={setCookingFrequency}>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  cookingFrequency === "low" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}>
                  <RadioGroupItem value="low" />
                  <div>
                    <p className="font-medium">Baixa</p>
                    <p className="text-xs text-muted-foreground">1-2 refeições por dia</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  cookingFrequency === "medium" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}>
                  <RadioGroupItem value="medium" />
                  <div>
                    <p className="font-medium">Média</p>
                    <p className="text-xs text-muted-foreground">3-4 refeições por dia</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  cookingFrequency === "high" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}>
                  <RadioGroupItem value="high" />
                  <div>
                    <p className="font-medium">Alta</p>
                    <p className="text-xs text-muted-foreground">5+ refeições por dia</p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Usa forno a gás?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={hasOven} onValueChange={setHasOven}>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  hasOven === "no" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}>
                  <RadioGroupItem value="no" />
                  <div>
                    <p className="font-medium">Não uso forno</p>
                    <p className="text-xs text-muted-foreground">Apenas fogão</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  hasOven === "sometimes" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}>
                  <RadioGroupItem value="sometimes" />
                  <div>
                    <p className="font-medium">Às vezes</p>
                    <p className="text-xs text-muted-foreground">1-2 vezes por semana</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  hasOven === "often" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}>
                  <RadioGroupItem value="often" />
                  <div>
                    <p className="font-medium">Frequentemente</p>
                    <p className="text-xs text-muted-foreground">3+ vezes por semana</p>
                  </div>
                </label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Última compra de gás (opcional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="date"
              value={lastPurchase}
              onChange={(e) => setLastPurchase(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Informe para calcular quando será sua próxima compra
            </p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            className="flex-1 h-12 gap-2"
            onClick={calculateConsumption}
            disabled={isCalculating}
          >
            {isCalculating ? (
              "Calculando..."
            ) : (
              <>
                <Calculator className="h-5 w-5" />
                Calcular
              </>
            )}
          </Button>
          <Button variant="outline" size="icon" onClick={resetCalculator}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="bg-gradient-to-br from-success to-success text-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="h-6 w-6" />
                  <span className="font-semibold">Resultado da Estimativa</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{result.daysPerBottle}</p>
                    <p className="text-sm text-white/80">dias por botijão</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{result.bottlesPerMonth}</p>
                    <p className="text-sm text-white/80">botijões/mês</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">R$ {result.monthlyCost}</p>
                    <p className="text-sm text-white/80">custo mensal</p>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">R$ {result.yearlyCost}</p>
                    <p className="text-sm text-white/80">custo anual</p>
                  </div>
                </div>

                {lastPurchase && (
                  <div className="mt-4 bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-sm text-white/80">Próxima compra estimada</p>
                    <p className="text-xl font-bold">
                      {result.nextPurchase.toLocaleDateString('pt-BR', { 
                        day: '2-digit', 
                        month: 'long' 
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-warning border-warning">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <Lightbulb className="h-5 w-5 text-warning shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-warning mb-2">Dicas para economizar</p>
                    <ul className="space-y-1 text-warning">
                      <li>• Tampe as panelas durante o cozimento</li>
                      <li>• Use a chama adequada ao tamanho da panela</li>
                      <li>• Descongele alimentos antes de cozinhar</li>
                      <li>• Mantenha os queimadores limpos</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ClienteLayout>
  );
}
