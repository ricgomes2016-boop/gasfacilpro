import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Flame, 
  User, 
  Mail, 
  Phone, 
  Lock, 
  MapPin,
  ArrowRight,
  ArrowLeft,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCliente } from "@/contexts/ClienteContext";

export default function ClienteCadastro() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUp } = useAuth();
  const { empresaInfo, empresaSlug } = useCliente();
  
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Get empresa slug from URL, context, or localStorage
  const slug = searchParams.get("empresa") || empresaSlug || localStorage.getItem("cliente_empresa_slug") || undefined;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    password: "",
    confirmPassword: "",
    address: {
      zipCode: "",
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: ""
    }
  });

  const updateFormData = (field: string, value: string) => {
    if (field.startsWith("address.")) {
      const addressField = field.replace("address.", "");
      setFormData(prev => ({
        ...prev,
        address: { ...prev.address, [addressField]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const validateStep1 = () => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast.error("Preencha todos os campos obrigatórios");
      return false;
    }
    if (!formData.email.includes("@")) {
      toast.error("E-mail inválido");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.password || !formData.confirmPassword) {
      toast.error("Preencha a senha");
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("As senhas não coincidem");
      return false;
    }
    if (formData.password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.address.zipCode || !formData.address.street || 
        !formData.address.number || !formData.address.neighborhood) {
      toast.error("Preencha o endereço completo");
      return false;
    }
    if (!acceptTerms) {
      toast.error("Aceite os termos de uso para continuar");
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;

    setIsSubmitting(true);
    
    const { error } = await signUp(formData.email, formData.password, formData.name, slug);
    
    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("Este email já está cadastrado. Faça login.");
      } else {
        toast.error(error.message);
      }
      setIsSubmitting(false);
      return;
    }

    toast.success("Cadastro realizado! Verifique seu email para confirmar a conta.");
    navigate("/auth" + (slug ? `?empresa=${slug}` : ""));
    setIsSubmitting(false);
  };

  const searchCep = async (cep: string) => {
    if (cep.length !== 8) return;
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address,
            street: data.logradouro || "",
            neighborhood: data.bairro || "",
            city: data.localidade || "",
            state: data.uf || ""
          }
        }));
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
  };

  const empresaNome = empresaInfo?.nome || "GásExpress";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground p-4">
        <div className="flex items-center gap-2">
          {empresaInfo?.logo_url ? (
            <img src={empresaInfo.logo_url} alt={empresaNome} className="h-6 w-6 object-contain rounded" />
          ) : (
            <Flame className="h-6 w-6" />
          )}
          <span className="font-bold text-lg">{empresaNome}</span>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {step === 1 && "Dados Pessoais"}
              {step === 2 && "Criar Senha"}
              {step === 3 && "Endereço"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Personal Data */}
            {step === 1 && (
              <>
                <div>
                  <Label className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Nome completo *
                  </Label>
                  <Input
                    placeholder="Seu nome"
                    value={formData.name}
                    onChange={(e) => updateFormData("name", e.target.value)}
                  />
                </div>
                
                <div>
                  <Label className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    E-mail *
                  </Label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                  />
                </div>
                
                <div>
                  <Label className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    Telefone (WhatsApp) *
                  </Label>
                  <Input
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={(e) => updateFormData("phone", e.target.value)}
                  />
                </div>
                
                <div>
                  <Label>CPF</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => updateFormData("cpf", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Código de indicação (opcional)</Label>
                  <Input
                    placeholder="Ex: CLIENTE123"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Ganhe R$10 se usar um código válido!
                  </p>
                </div>
              </>
            )}

            {/* Step 2: Password */}
            {step === 2 && (
              <>
                <div>
                  <Label className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Senha *
                  </Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => updateFormData("password", e.target.value)}
                  />
                </div>
                
                <div>
                  <Label className="flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    Confirmar senha *
                  </Label>
                  <Input
                    type="password"
                    placeholder="Repita a senha"
                    value={formData.confirmPassword}
                    onChange={(e) => updateFormData("confirmPassword", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Step 3: Address */}
            {step === 3 && (
              <>
                <div>
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    CEP *
                  </Label>
                  <Input
                    placeholder="00000-000"
                    value={formData.address.zipCode}
                    onChange={(e) => {
                      const cep = e.target.value.replace(/\D/g, "");
                      updateFormData("address.zipCode", cep);
                      if (cep.length === 8) searchCep(cep);
                    }}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label>Rua *</Label>
                    <Input
                      placeholder="Nome da rua"
                      value={formData.address.street}
                      onChange={(e) => updateFormData("address.street", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Número *</Label>
                    <Input
                      placeholder="Nº"
                      value={formData.address.number}
                      onChange={(e) => updateFormData("address.number", e.target.value)}
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Complemento</Label>
                  <Input
                    placeholder="Apto, bloco..."
                    value={formData.address.complement}
                    onChange={(e) => updateFormData("address.complement", e.target.value)}
                  />
                </div>
                
                <div>
                  <Label>Bairro *</Label>
                  <Input
                    placeholder="Bairro"
                    value={formData.address.neighborhood}
                    onChange={(e) => updateFormData("address.neighborhood", e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label>Cidade</Label>
                    <Input
                      placeholder="Cidade"
                      value={formData.address.city}
                      onChange={(e) => updateFormData("address.city", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>UF</Label>
                    <Input
                      placeholder="SP"
                      maxLength={2}
                      value={formData.address.state}
                      onChange={(e) => updateFormData("address.state", e.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="flex items-start space-x-2 pt-2">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                  />
                  <label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
                    Li e aceito os <a href="#" className="text-primary underline">termos de uso</a> e 
                    <a href="#" className="text-primary underline"> política de privacidade</a>
                  </label>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <Button variant="outline" onClick={prevStep} className="flex-1 gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              )}
              
              {step < 3 ? (
                <Button onClick={nextStep} className="flex-1 gap-1">
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit} 
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Cadastrando...
                    </>
                  ) : "Finalizar Cadastro"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Login Link */}
        <p className="text-center mt-6 text-sm text-muted-foreground">
          Já tem conta?{" "}
          <a 
            href={`/auth${slug ? `?empresa=${slug}` : ""}`} 
            className="text-primary font-medium"
          >
            Fazer login
          </a>
        </p>
      </main>
    </div>
  );
}
