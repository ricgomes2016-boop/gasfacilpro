import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, Loader2, Building2, MapPin, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingEmpresa() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refetch } = useEmpresa();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Empresa fields
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [emailEmpresa, setEmailEmpresa] = useState("");
  const [telefoneEmpresa, setTelefoneEmpresa] = useState("");

  // Unidade fields
  const [nomeUnidade, setNomeUnidade] = useState("");
  const [enderecoUnidade, setEnderecoUnidade] = useState("");
  const [cidadeUnidade, setCidadeUnidade] = useState("");
  const [estadoUnidade, setEstadoUnidade] = useState("");

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // 1. Create empresa
      const slug = generateSlug(nomeEmpresa) + "-" + Date.now().toString(36);
      const { data: empresa, error: empresaError } = await supabase
        .from("empresas")
        .insert({
          nome: nomeEmpresa,
          slug,
          cnpj: cnpj || null,
          email: emailEmpresa || null,
          telefone: telefoneEmpresa || null,
          plano: "starter",
          plano_max_unidades: 1,
          plano_max_usuarios: 5,
        })
        .select()
        .single();

      if (empresaError) throw empresaError;

      // 2. Update profile with empresa_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ empresa_id: empresa.id })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // 3. Atualiza a unidade matriz que foi criada automaticamente pelo trigger
      if (nomeUnidade) {
        const { error: unidadeError } = await supabase
          .from("unidades")
          .update({
            nome: nomeUnidade,
            endereco: enderecoUnidade || null,
            cidade: cidadeUnidade || null,
            estado: estadoUnidade || null,
          })
          .eq("empresa_id", empresa.id)
          .eq("tipo", "matriz");

        if (unidadeError) throw unidadeError;
      }

      toast.success("Empresa criada com sucesso! Vamos configurar o básico.");
      await refetch();
      navigate("/onboarding/setup");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast.error("Erro ao criar empresa: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <Flame className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Configure sua Empresa</CardTitle>
          <CardDescription>
            {step === 1
              ? "Preencha os dados básicos da sua distribuidora"
              : "Configure sua primeira unidade (filial/matriz)"}
          </CardDescription>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2">
            <div className={`h-2 w-12 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-2 w-12 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          </div>
        </CardHeader>

        <CardContent>
          {step === 1 ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome-empresa">
                  <Building2 className="inline h-4 w-4 mr-1" />
                  Nome da Empresa *
                </Label>
                <Input
                  id="nome-empresa"
                  placeholder="Ex: Central Gás Distribuidora"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email-empresa">Email</Label>
                  <Input
                    id="email-empresa"
                    type="email"
                    placeholder="contato@empresa.com"
                    value={emailEmpresa}
                    onChange={(e) => setEmailEmpresa(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone-empresa">Telefone</Label>
                  <Input
                    id="telefone-empresa"
                    placeholder="(00) 00000-0000"
                    value={telefoneEmpresa}
                    onChange={(e) => setTelefoneEmpresa(e.target.value)}
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => setStep(2)}
                disabled={!nomeEmpresa.trim()}
              >
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome-unidade">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Nome da Unidade (Matriz) *
                </Label>
                <Input
                  id="nome-unidade"
                  placeholder="Ex: Matriz Centro"
                  value={nomeUnidade}
                  onChange={(e) => setNomeUnidade(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco-unidade">Endereço</Label>
                <Input
                  id="endereco-unidade"
                  placeholder="Rua, número"
                  value={enderecoUnidade}
                  onChange={(e) => setEnderecoUnidade(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cidade-unidade">Cidade</Label>
                  <Input
                    id="cidade-unidade"
                    placeholder="Cidade"
                    value={cidadeUnidade}
                    onChange={(e) => setCidadeUnidade(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado-unidade">Estado</Label>
                  <Input
                    id="estado-unidade"
                    placeholder="UF"
                    maxLength={2}
                    value={estadoUnidade}
                    onChange={(e) => setEstadoUnidade(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmit}
                  disabled={isLoading || !nomeUnidade.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    "Criar Empresa"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
