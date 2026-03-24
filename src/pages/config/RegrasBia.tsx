import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Clock, Package, HandCoins, MessageSquare, Save, Loader2, Droplets, Flame, Container, Truck } from "lucide-react";

interface PrecoProduto {
  preco: number;
  preco_desconto: number;
}

interface RegrasBiaConfig {
  bia_ativa: boolean;
  horario_abertura: string;
  horario_fechamento: string;
  horario_domingo_fechamento: string;
  domingo_ativo: boolean;
  agua_entrega_domingo: boolean;
  categorias_permitidas: string[];
  mensagem_fora_horario: string;
  desconto_etapa1: number;
  desconto_etapa2: number;
  preco_minimo_p13: number | null;
  preco_minimo_p20: number | null;
  gas_do_povo_entrega: boolean;
  gas_do_povo_taxa: number;
  tabela_precos: {
    gas_p13: PrecoProduto;
    gas_p20: PrecoProduto;
    gas_p45: PrecoProduto;
    agua_20l: PrecoProduto;
  };
}

const defaultConfig: RegrasBiaConfig = {
  bia_ativa: true,
  horario_abertura: "08:00",
  horario_fechamento: "18:00",
  horario_domingo_fechamento: "14:00",
  domingo_ativo: true,
  agua_entrega_domingo: true,
  categorias_permitidas: ["gas", "agua", "vasilhame"],
  mensagem_fora_horario: "Estamos fechados agora, mas posso agendar seu pedido!",
  desconto_etapa1: 3,
  desconto_etapa2: 5,
  preco_minimo_p13: null,
  preco_minimo_p20: null,
  gas_do_povo_entrega: false,
  gas_do_povo_taxa: 15,
  tabela_precos: {
    gas_p13: { preco: 125, preco_desconto: 120 },
    gas_p20: { preco: 210, preco_desconto: 200 },
    gas_p45: { preco: 450, preco_desconto: 430 },
    agua_20l: { preco: 15, preco_desconto: 13 },
  },
};

const categorias = [
  { key: "gas", label: "Gás (P13, P20, P45)", icon: Flame, color: "text-orange-500" },
  { key: "agua", label: "Água Mineral", icon: Droplets, color: "text-blue-500" },
  { key: "vasilhame", label: "Vasilhames", icon: Container, color: "text-muted-foreground" },
];

export default function RegrasBia() {
  const { empresa } = useEmpresa();
  const { toast } = useToast();
  const [config, setConfig] = useState<RegrasBiaConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!empresa?.id) return;
    loadConfig();
  }, [empresa?.id]);

  const loadConfig = async () => {
    if (!empresa?.id) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("configuracoes_empresa")
        .select("regras_bia")
        .eq("empresa_id", empresa.id)
        .maybeSingle();

      if (data?.regras_bia) {
        const rb = data.regras_bia as any;
        // Merge with default to ensure new fields (like tabela_precos) exist
        const merged = { ...defaultConfig, ...rb };
        // Ensure nesting is preserved
        if (rb.tabela_precos) {
          merged.tabela_precos = { ...defaultConfig.tabela_precos, ...rb.tabela_precos };
        }
        setConfig(merged);
      }
    } catch (e) {
      console.error("Erro ao carregar config:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!empresa?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("configuracoes_empresa")
        .update({ regras_bia: config as any })
        .eq("empresa_id", empresa.id);

      if (error) throw error;
      toast({ title: "Configurações salvas!", description: "As regras da Bia foram atualizadas." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleCategoria = (cat: string) => {
    setConfig(prev => ({
      ...prev,
      categorias_permitidas: prev.categorias_permitidas.includes(cat)
        ? prev.categorias_permitidas.filter(c => c !== cat)
        : [...prev.categorias_permitidas, cat],
    }));
  };

  return (
    <MainLayout>
      <Header title="Regras da Bia" subtitle="Configure o comportamento da assistente de atendimento" />

      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        {/* Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">Status da Bia</CardTitle>
                  <CardDescription>Ative ou desative a assistente para esta empresa</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={config.bia_ativa ? "default" : "secondary"}>
                  {config.bia_ativa ? "Ativa" : "Inativa"}
                </Badge>
                <Switch
                  checked={config.bia_ativa}
                  onCheckedChange={(v) => setConfig(prev => ({ ...prev, bia_ativa: v }))}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Horários */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Horários de Atendimento</CardTitle>
                <CardDescription>Define quando a Bia aceita pedidos normalmente</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Abertura</Label>
                <Input
                  type="time"
                  value={config.horario_abertura}
                  onChange={(e) => setConfig(prev => ({ ...prev, horario_abertura: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fechamento</Label>
                <Input
                  type="time"
                  value={config.horario_fechamento}
                  onChange={(e) => setConfig(prev => ({ ...prev, horario_fechamento: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Atendimento aos Domingos</p>
                  <p className="text-xs text-muted-foreground">Habilita funcionamento em horário reduzido</p>
                </div>
                <Switch
                  checked={config.domingo_ativo}
                  onCheckedChange={(v) => setConfig(prev => ({ ...prev, domingo_ativo: v }))}
                />
              </div>

              {config.domingo_ativo && (
                <div className="pl-4 border-l-2 border-primary/20 space-y-4">
                  <div className="space-y-2">
                    <Label>Fechamento no Domingo</Label>
                    <Input
                      type="time"
                      value={config.horario_domingo_fechamento}
                      onChange={(e) => setConfig(prev => ({ ...prev, horario_domingo_fechamento: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Entrega de Água no Domingo</p>
                      <p className="text-xs text-muted-foreground">Se desativado, água só na portaria</p>
                    </div>
                    <Switch
                      checked={config.agua_entrega_domingo}
                      onCheckedChange={(v) => setConfig(prev => ({ ...prev, agua_entrega_domingo: v }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Produtos Permitidos */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Produtos Permitidos</CardTitle>
                <CardDescription>Categorias que a Bia pode vender pelo WhatsApp</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {categorias.map((cat) => {
              const Icon = cat.icon;
              const checked = config.categorias_permitidas.includes(cat.key);
              return (
                <div key={cat.key} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${cat.color}`} />
                    <span className="font-medium text-sm">{cat.label}</span>
                  </div>
                  <Switch checked={checked} onCheckedChange={() => toggleCategoria(cat.key)} />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Gás do Povo */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Truck className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Gás do Povo</CardTitle>
                <CardDescription>Configure se o Gás do Povo pode ser entregue com taxa ou apenas retirada na portaria</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div>
                <p className="font-medium text-sm">Somente retirada na portaria</p>
                <p className="text-xs text-muted-foreground">Padrão: cliente retira na loja sem taxa</p>
              </div>
              <Badge variant={!config.gas_do_povo_entrega ? "default" : "secondary"}>
                {!config.gas_do_povo_entrega ? "Ativo" : "Inativo"}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Permitir entrega com taxa</p>
                <p className="text-xs text-muted-foreground">Se habilitado, a Bia oferece entrega com taxa adicional</p>
              </div>
              <Switch
                checked={config.gas_do_povo_entrega}
                onCheckedChange={(v) => setConfig(prev => ({ ...prev, gas_do_povo_entrega: v }))}
              />
            </div>

            {config.gas_do_povo_entrega && (
              <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                <Label>Valor da Taxa de Entrega (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={config.gas_do_povo_taxa}
                  onChange={(e) => setConfig(prev => ({ ...prev, gas_do_povo_taxa: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">A Bia informará: retirada na portaria sem taxa, ou entrega com R$ {config.gas_do_povo_taxa.toFixed(2)} de taxa</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela de Preços */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <HandCoins className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Tabela de Preços (WhatsApp)</CardTitle>
                <CardDescription>Preços que a Bia usará nas conversas e pedidos</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: "gas_p13", label: "Gás P13" },
                { key: "gas_p20", label: "Gás P20" },
                { key: "gas_p45", label: "Gás P45" },
                { key: "agua_20l", label: "Água 20L" },
              ].map((item) => (
                <div key={item.key} className="space-y-4 p-4 border rounded-lg bg-accent/5">
                  <p className="font-semibold text-sm border-b pb-2">{item.label}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Preço Normal (R$)</Label>
                      <Input
                        type="number"
                        step={0.5}
                        value={config.tabela_precos[item.key as keyof typeof config.tabela_precos].preco}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          tabela_precos: {
                            ...prev.tabela_precos,
                            [item.key]: { ...prev.tabela_precos[item.key as keyof typeof config.tabela_precos], preco: Number(e.target.value) }
                          }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Com Desconto (R$)</Label>
                      <Input
                        type="number"
                        step={0.5}
                        value={config.tabela_precos[item.key as keyof typeof config.tabela_precos].preco_desconto}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          tabela_precos: {
                            ...prev.tabela_precos,
                            [item.key]: { ...prev.tabela_precos[item.key as keyof typeof config.tabela_precos], preco_desconto: Number(e.target.value) }
                          }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Desconto Máximo Manual (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={config.desconto_etapa1}
                  onChange={(e) => setConfig(prev => ({ ...prev, desconto_etapa1: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">Valor subtraído se o cliente pedir desconto (etapa 1)</p>
              </div>
              <div className="space-y-2">
                <Label>Desconto Final (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={config.desconto_etapa2}
                  onChange={(e) => setConfig(prev => ({ ...prev, desconto_etapa2: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">Valor subtraído na negociação final (etapa 2)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mensagem Fora do Horário */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">Mensagem Fora do Horário</CardTitle>
                <CardDescription>Texto que a Bia usa quando a empresa está fechada</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={config.mensagem_fora_horario}
              onChange={(e) => setConfig(prev => ({ ...prev, mensagem_fora_horario: e.target.value }))}
              rows={3}
              placeholder="Ex: Estamos fechados agora, mas posso agendar seu pedido!"
            />
          </CardContent>
        </Card>

        {/* Salvar */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={saving || loading} size="lg">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
