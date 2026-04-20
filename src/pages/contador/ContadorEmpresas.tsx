import { ContadorPortalLayout } from "@/components/contador/ContadorPortalLayout";
import { useContador } from "@/contexts/ContadorContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle2, ChevronRight } from "lucide-react";

export default function ContadorEmpresas() {
  const { empresas, empresaAtiva, setEmpresaAtiva, loading } = useContador();

  return (
    <ContadorPortalLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(0,0%,95%)]">Empresas Vinculadas</h1>
          <p className="text-sm text-[hsl(220,10%,60%)]">Selecione qual empresa cliente você quer gerenciar agora</p>
        </div>

        {loading ? (
          <p className="text-sm text-[hsl(220,10%,55%)]">Carregando…</p>
        ) : empresas.length === 0 ? (
          <Card className="bg-[hsl(220,22%,11%)] border-[hsl(220,15%,20%)]">
            <CardContent className="p-8 text-center">
              <Building2 className="h-12 w-12 mx-auto mb-3 text-[hsl(220,10%,30%)]" />
              <p className="text-sm text-[hsl(220,10%,55%)]">Nenhuma empresa vinculada à sua conta.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {empresas.map((e) => {
              const isActive = empresaAtiva?.empresa_id === e.empresa_id;
              return (
                <Card key={e.empresa_id}
                  className={`bg-[hsl(220,22%,11%)] border ${isActive ? "border-[hsl(165,60%,40%)]" : "border-[hsl(220,15%,20%)]"} hover:border-[hsl(165,60%,40%)]/60 transition-colors`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-lg bg-[hsl(165,60%,40%)]/15 flex items-center justify-center shrink-0">
                        {e.empresa_logo_url
                          ? <img src={e.empresa_logo_url} alt={e.empresa_nome} className="h-full w-full object-cover rounded-lg" />
                          : <Building2 className="h-6 w-6 text-[hsl(165,60%,55%)]" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[hsl(0,0%,95%)] truncate">{e.empresa_nome}</h3>
                          {isActive && <CheckCircle2 className="h-4 w-4 text-[hsl(165,60%,55%)] shrink-0" />}
                        </div>
                        <p className="text-xs text-[hsl(220,10%,55%)] mt-1">{e.total_unidades} loja(s) ativa(s)</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {e.permissoes.xml && <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(220,18%,15%)] text-[hsl(220,10%,70%)]">XML</span>}
                          {e.permissoes.despesas && <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(220,18%,15%)] text-[hsl(220,10%,70%)]">Despesas</span>}
                          {e.permissoes.financeiro && <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(220,18%,15%)] text-[hsl(220,10%,70%)]">Financeiro</span>}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => setEmpresaAtiva(e)}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className={`w-full mt-4 ${isActive ? "bg-[hsl(165,60%,40%)] hover:bg-[hsl(165,60%,45%)] text-white" : "border-[hsl(220,15%,22%)] text-[hsl(0,0%,90%)] hover:bg-[hsl(220,18%,15%)]"}`}
                    >
                      {isActive ? "Empresa ativa" : "Acessar"} <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </ContadorPortalLayout>
  );
}
