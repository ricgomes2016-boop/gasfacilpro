import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Building, CreditCard, Bell, Shield, Printer, Users, Loader2, ClipboardList, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface EmpresaConfig {
  id: string;
  nome_empresa: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  mensagem_cupom: string;
}

interface RegrasCadastro {
  telefone_obrigatorio: boolean;
  canal_venda_obrigatorio: boolean;
  email_obrigatorio: boolean;
  endereco_obrigatorio: boolean;
  cpf_obrigatorio: boolean;
}

interface Produto {
  id: string;
  nome: string;
  preco: number;
  categoria: string | null;
  tipo_botijao: string | null;
}

interface UserProfile {
  user_id: string;
  full_name: string;
  email: string;
  roles: string[];
}

export default function Configuracoes() {
  const { toast } = useToast();
  const { signOut } = useAuth();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const [empresaConfig, setEmpresaConfig] = useState<EmpresaConfig>({
    id: "",
    nome_empresa: "",
    cnpj: "",
    telefone: "",
    endereco: "",
    mensagem_cupom: "",
  });
  const [regras, setRegras] = useState<RegrasCadastro>({
    telefone_obrigatorio: true,
    canal_venda_obrigatorio: false,
    email_obrigatorio: false,
    endereco_obrigatorio: false,
    cpf_obrigatorio: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingRegras, setIsSavingRegras] = useState(false);
  const [produtoPrecos, setProdutoPrecos] = useState<Record<string, number>>({});
  const [isSavingPrecos, setIsSavingPrecos] = useState(false);

  // Fetch products (cheio only, grouped by name)
  const { data: produtos = [], isLoading: isLoadingProdutos } = useQuery({
    queryKey: ["produtos-config", unidadeAtual?.id],
    queryFn: async () => {
      let query = supabase
        .from("produtos")
        .select("id, nome, preco, categoria, tipo_botijao")
        .eq("ativo", true)
        .eq("tipo_botijao", "cheio")
        .order("nome");
      if (unidadeAtual?.id) {
        query = query.eq("unidade_id", unidadeAtual.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Produto[];
    },
  });

  // Fetch users with roles
  const { data: usuarios = [], isLoading: isLoadingUsuarios } = useQuery({
    queryKey: ["usuarios-config"],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .order("full_name");
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesError) throw rolesError;

      const rolesMap: Record<string, string[]> = {};
      (roles || []).forEach((r: any) => {
        if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
        rolesMap[r.user_id].push(r.role);
      });

      return (profiles || []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        roles: rolesMap[p.user_id] || [],
      })) as UserProfile[];
    },
  });

  // Initialize product prices when loaded
  useEffect(() => {
    const precos: Record<string, number> = {};
    produtos.forEach((p) => {
      precos[p.id] = p.preco;
    });
    setProdutoPrecos(precos);
  }, [produtos]);

  useEffect(() => {
    fetchEmpresaConfig();
  }, []);

  const fetchEmpresaConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracoes_empresa")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setEmpresaConfig({
          id: data.id,
          nome_empresa: data.nome_empresa || "",
          cnpj: data.cnpj || "",
          telefone: data.telefone || "",
          endereco: data.endereco || "",
          mensagem_cupom: data.mensagem_cupom || "",
        });
        if (data.regras_cadastro) {
          const r = data.regras_cadastro as Record<string, boolean>;
          setRegras((prev) => ({ ...prev, ...r }));
        }
      }
    } catch (error: any) {
      console.error("Erro ao carregar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações da empresa.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEmpresa = async () => {
    setIsSaving(true);
    try {
      if (empresaConfig.id) {
        const { error } = await supabase
          .from("configuracoes_empresa")
          .update({
            nome_empresa: empresaConfig.nome_empresa,
            cnpj: empresaConfig.cnpj,
            telefone: empresaConfig.telefone,
            endereco: empresaConfig.endereco,
            mensagem_cupom: empresaConfig.mensagem_cupom,
          })
          .eq("id", empresaConfig.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("configuracoes_empresa")
          .insert({
            nome_empresa: empresaConfig.nome_empresa,
            cnpj: empresaConfig.cnpj,
            telefone: empresaConfig.telefone,
            endereco: empresaConfig.endereco,
            mensagem_cupom: empresaConfig.mensagem_cupom,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (data) setEmpresaConfig((prev) => ({ ...prev, id: data.id }));
      }
      toast({ title: "Salvo com sucesso!", description: "As configurações da empresa foram atualizadas." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message || "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRegras = async () => {
    setIsSavingRegras(true);
    try {
      if (empresaConfig.id) {
        const { error } = await supabase
          .from("configuracoes_empresa")
          .update({ regras_cadastro: regras } as any)
          .eq("id", empresaConfig.id);
        if (error) throw error;
      } else {
        // Create config record if it doesn't exist yet
        const { data, error } = await supabase
          .from("configuracoes_empresa")
          .insert({ nome_empresa: empresaConfig.nome_empresa || "Minha Empresa", regras_cadastro: regras, empresa_id: empresa?.id } as any)
          .select("id")
          .single();
        if (error) throw error;
        if (data) setEmpresaConfig((prev) => ({ ...prev, id: data.id }));
      }
      queryClient.invalidateQueries({ queryKey: ["regras_cadastro"] });
      toast({ title: "Regras salvas!", description: "As regras de cadastro foram atualizadas." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingRegras(false);
    }
  };

  const handleSavePrecos = async () => {
    setIsSavingPrecos(true);
    try {
      const updates = Object.entries(produtoPrecos).map(([id, preco]) =>
        supabase.from("produtos").update({ preco }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const hasError = results.find((r) => r.error);
      if (hasError?.error) throw hasError.error;
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      toast({ title: "Preços atualizados!", description: "Os preços foram salvos com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar preços", description: error.message, variant: "destructive" });
    } finally {
      setIsSavingPrecos(false);
    }
  };

  const getRoleBadgeVariant = (role: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (role) {
      case "admin": return "destructive";
      case "gestor": return "default";
      case "financeiro": return "secondary";
      default: return "outline";
    }
  };

  const handleChangePassword = async () => {
    const novaSenha = (document.getElementById("novaSenha") as HTMLInputElement)?.value;
    const confirmarSenha = (document.getElementById("confirmarSenha") as HTMLInputElement)?.value;

    if (!novaSenha || novaSenha.length < 6) {
      toast({ title: "Erro", description: "A nova senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast({ title: "Erro", description: "As senhas não conferem.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha alterada!", description: "Sua senha foi atualizada com sucesso." });
      (document.getElementById("novaSenha") as HTMLInputElement).value = "";
      (document.getElementById("confirmarSenha") as HTMLInputElement).value = "";
    }
  };

  return (
    <MainLayout>
      <Header title="Configurações" subtitle="Gerencie as configurações do sistema" />
      <div className="p-3 sm:p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Dados da Empresa */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle>Dados da Empresa</CardTitle>
              </div>
              <CardDescription>Informações básicas da sua revenda (usadas no comprovante)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="nomeEmpresa">Nome da Empresa</Label>
                    <Input id="nomeEmpresa" value={empresaConfig.nome_empresa} onChange={(e) => setEmpresaConfig((prev) => ({ ...prev, nome_empresa: e.target.value }))} placeholder="Ex: GásPro Revenda" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" value={empresaConfig.cnpj} onChange={(e) => setEmpresaConfig((prev) => ({ ...prev, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" value={empresaConfig.telefone} onChange={(e) => setEmpresaConfig((prev) => ({ ...prev, telefone: e.target.value }))} placeholder="(00) 0000-0000" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input id="endereco" value={empresaConfig.endereco} onChange={(e) => setEmpresaConfig((prev) => ({ ...prev, endereco: e.target.value }))} placeholder="Rua, Número - Bairro, Cidade" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mensagemCupomEmpresa">Mensagem do Comprovante</Label>
                    <Input id="mensagemCupomEmpresa" value={empresaConfig.mensagem_cupom} onChange={(e) => setEmpresaConfig((prev) => ({ ...prev, mensagem_cupom: e.target.value }))} placeholder="Obrigado pela preferência!" />
                  </div>
                  <Button onClick={handleSaveEmpresa} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Alterações
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Regras de Cadastro */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <CardTitle>Regras de Cadastro</CardTitle>
              </div>
              <CardDescription>Defina quais campos são obrigatórios nos formulários</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Telefone obrigatório</p>
                      <p className="text-sm text-muted-foreground">Exigir telefone no cadastro de clientes</p>
                    </div>
                    <Switch checked={regras.telefone_obrigatorio} onCheckedChange={(v) => setRegras((prev) => ({ ...prev, telefone_obrigatorio: v }))} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Canal de venda obrigatório</p>
                      <p className="text-sm text-muted-foreground">Exigir canal de venda ao registrar pedido</p>
                    </div>
                    <Switch checked={regras.canal_venda_obrigatorio} onCheckedChange={(v) => setRegras((prev) => ({ ...prev, canal_venda_obrigatorio: v }))} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">CPF/CNPJ obrigatório</p>
                      <p className="text-sm text-muted-foreground">Exigir CPF ou CNPJ no cadastro de clientes</p>
                    </div>
                    <Switch checked={regras.cpf_obrigatorio} onCheckedChange={(v) => setRegras((prev) => ({ ...prev, cpf_obrigatorio: v }))} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">E-mail obrigatório</p>
                      <p className="text-sm text-muted-foreground">Exigir e-mail no cadastro de clientes</p>
                    </div>
                    <Switch checked={regras.email_obrigatorio} onCheckedChange={(v) => setRegras((prev) => ({ ...prev, email_obrigatorio: v }))} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Endereço obrigatório</p>
                      <p className="text-sm text-muted-foreground">Exigir endereço no cadastro de clientes</p>
                    </div>
                    <Switch checked={regras.endereco_obrigatorio} onCheckedChange={(v) => setRegras((prev) => ({ ...prev, endereco_obrigatorio: v }))} />
                  </div>
                  <Button onClick={handleSaveRegras} disabled={isSavingRegras} className="w-full mt-2">
                    {isSavingRegras && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Regras
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Preços - Dados Reais */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <CardTitle>Tabela de Preços</CardTitle>
              </div>
              <CardDescription>Preços dos produtos cadastrados (apenas cheios)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingProdutos ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : produtos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto cadastrado.</p>
              ) : (
                <>
                  {produtos.map((produto) => (
                    <div key={produto.id} className="grid gap-2">
                      <Label htmlFor={`preco-${produto.id}`}>{produto.nome}</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">R$</span>
                        <Input
                          id={`preco-${produto.id}`}
                          type="number"
                          step="0.01"
                          value={produtoPrecos[produto.id] ?? produto.preco}
                          onChange={(e) =>
                            setProdutoPrecos((prev) => ({
                              ...prev,
                              [produto.id]: parseFloat(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <Button onClick={handleSavePrecos} disabled={isSavingPrecos}>
                    {isSavingPrecos ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Atualizar Preços
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Usuários - Dados Reais */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Usuários</CardTitle>
              </div>
              <CardDescription>Usuários cadastrados no sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingUsuarios ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : usuarios.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário encontrado.</p>
              ) : (
                <>
                  {usuarios.map((user) => (
                    <div key={user.user_id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => window.location.href = "/config/usuarios"}>
                    <Users className="mr-2 h-4 w-4" />
                    Gerenciar Usuários
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Segurança</CardTitle>
              </div>
              <CardDescription>Altere sua senha de acesso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="novaSenha">Nova Senha</Label>
                <Input id="novaSenha" type="password" placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                <Input id="confirmarSenha" type="password" placeholder="Repita a nova senha" />
              </div>
              <Button onClick={handleChangePassword}>Alterar Senha</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
