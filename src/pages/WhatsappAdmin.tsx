import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Settings, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface WhatsappConfig {
  id: number;
  businessAccountId: string;
  phoneNumberId: string;
  phoneNumber: string;
  displayName: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export default function WhatsappAdmin() {
  const [configs, setConfigs] = useState<WhatsappConfig[]>([
    {
      id: 1,
      businessAccountId: "123456789",
      phoneNumberId: "987654321",
      phoneNumber: "+55 11 98765-4321",
      displayName: "GásFácil",
      isActive: true,
      isVerified: true,
      createdAt: "2026-05-01",
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [formData, setFormData] = useState({
    businessAccountId: "",
    phoneNumberId: "",
    phoneNumber: "",
    displayName: "",
    accessToken: "",
    verifyToken: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.businessAccountId ||
      !formData.phoneNumberId ||
      !formData.phoneNumber ||
      !formData.accessToken
    ) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const newConfig: WhatsappConfig = {
      id: configs.length + 1,
      businessAccountId: formData.businessAccountId,
      phoneNumberId: formData.phoneNumberId,
      phoneNumber: formData.phoneNumber,
      displayName: formData.displayName || "GásFácil",
      isActive: true,
      isVerified: false,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setConfigs([...configs, newConfig]);
    setFormData({
      businessAccountId: "",
      phoneNumberId: "",
      phoneNumber: "",
      displayName: "",
      accessToken: "",
      verifyToken: "",
    });
    setShowForm(false);
    toast.success("Configuração adicionada com sucesso!");
  };

  const handleVerify = (id: number) => {
    setConfigs(
      configs.map((config) =>
        config.id === id ? { ...config, isVerified: true } : config
      )
    );
    toast.success("Configuração verificada!");
  };

  const handleToggleActive = (id: number) => {
    setConfigs(
      configs.map((config) =>
        config.id === id ? { ...config, isActive: !config.isActive } : config
      )
    );
  };

  const handleDelete = (id: number) => {
    setConfigs(configs.filter((config) => config.id !== id));
    toast.success("Configuração removida!");
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">WhatsApp Business</h1>
        <p className="text-gray-600">
          Gerencie suas configurações de integração com WhatsApp Business API
        </p>
      </div>

      {/* Configurações Existentes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Configurações Ativas</h2>
          <Button onClick={() => setShowForm(!showForm)}>
            <Settings className="w-4 h-4 mr-2" />
            {showForm ? "Cancelar" : "Adicionar Configuração"}
          </Button>
        </div>

        {configs.map((config) => (
          <Card key={config.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {config.displayName}
                    {config.isVerified ? (
                      <Badge variant="default" className="bg-success">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verificado
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Não Verificado
                      </Badge>
                    )}
                    {config.isActive ? (
                      <Badge variant="default">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Criado em {config.createdAt}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-xs text-gray-500">Número de Telefone</Label>
                  <p className="font-mono text-sm">{config.phoneNumber}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Business Account ID</Label>
                  <p className="font-mono text-sm">{config.businessAccountId}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Phone Number ID</Label>
                  <p className="font-mono text-sm">{config.phoneNumberId}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {!config.isVerified && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleVerify(config.id)}
                  >
                    Verificar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(config.id)}
                >
                  {config.isActive ? "Desativar" : "Ativar"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(config.id)}
                >
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Formulário de Adição */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Nova Configuração</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="displayName">Nome da Configuração</Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    placeholder="Ex: GásFácil"
                    value={formData.displayName}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <Label htmlFor="phoneNumber">Número de Telefone *</Label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    placeholder="+55 11 98765-4321"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="businessAccountId">Business Account ID *</Label>
                  <Input
                    id="businessAccountId"
                    name="businessAccountId"
                    placeholder="123456789"
                    value={formData.businessAccountId}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
                  <Input
                    id="phoneNumberId"
                    name="phoneNumberId"
                    placeholder="987654321"
                    value={formData.phoneNumberId}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="accessToken">Access Token *</Label>
                <div className="flex gap-2">
                  <Input
                    id="accessToken"
                    name="accessToken"
                    type={showSecrets ? "text" : "password"}
                    placeholder="Seu token de acesso Meta"
                    value={formData.accessToken}
                    onChange={handleInputChange}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSecrets(!showSecrets)}
                  >
                    {showSecrets ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="verifyToken">Verify Token (Webhook)</Label>
                <Input
                  id="verifyToken"
                  name="verifyToken"
                  type={showSecrets ? "text" : "password"}
                  placeholder="Token para validar webhooks"
                  value={formData.verifyToken}
                  onChange={handleInputChange}
                />
              </div>

              <div className="bg-info border border-info rounded-lg p-4">
                <p className="text-sm text-info">
                  <strong>Dica:</strong> Você pode encontrar essas informações no{" "}
                  <a
                    href="https://developers.facebook.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-semibold"
                  >
                    Meta App Dashboard
                  </a>
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit">Salvar Configuração</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Como Configurar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              Acesse{" "}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="text-info underline"
              >
                Meta App Dashboard
              </a>
            </li>
            <li>Crie um novo app com caso de uso "WhatsApp Business"</li>
            <li>Conecte uma conta WhatsApp Business</li>
            <li>Gere um Access Token permanente</li>
            <li>Copie as informações e preencha o formulário acima</li>
            <li>Clique em "Verificar" para validar a configuração</li>
          </ol>

          <div className="bg-warning border border-warning rounded-lg p-4 mt-4">
            <p className="text-sm text-warning">
              <strong>⚠️ Importante:</strong> Mantenha seus tokens seguros. Nunca
              compartilhe suas credenciais com terceiros.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
