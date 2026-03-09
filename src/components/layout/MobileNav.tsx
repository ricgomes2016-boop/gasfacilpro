import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LogOut,
  Menu,
  ChevronDown,
  X,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { menuItems } from "./menuItems";
import { motion, AnimatePresence } from "framer-motion";
import logoImg from "@/assets/logo.png";

const menuIconColors: Record<string, string> = {
  "Dashboard": "text-blue-500",
  "Assistente IA": "text-violet-500",
  "Atendimento": "text-green-500",
  "Vendas": "text-emerald-500",
  "Caixa": "text-amber-500",
  "Gestão Operacional": "text-cyan-500",
  "Gestão de Clientes": "text-pink-500",
  "Gestão de Estoque": "text-orange-500",
  "Gestão Financeira": "text-yellow-500",
  "Gestão de Frota": "text-indigo-500",
  "Gestão de RH": "text-rose-500",
  "Gestão Fiscal": "text-teal-500",
  "Configurações": "text-slate-400",
};

const subMenuIconColors: Record<string, string> = {
  "Central de Atendimento": "text-green-500",
  "PDV": "text-emerald-600", "Nova Venda": "text-emerald-400", "Pedidos": "text-emerald-500",
  "Devoluções / Trocas": "text-red-400", "Relatório de Vendas": "text-emerald-300",
  "Acerto Diário Entregador": "text-amber-500", "Caixa do Dia": "text-amber-400", "Despesas (Sangria)": "text-amber-600",
  "Central de Inteligência": "text-violet-500", "Central de Indicadores": "text-cyan-400",
  "Mapa Operacional": "text-cyan-500", "Alertas Inteligentes": "text-red-400",
  "Rotas de Entrega": "text-cyan-600", "Escalas de Entregadores": "text-cyan-300",
  "Análise de Resultados": "text-cyan-500", "Planejamento": "text-blue-400",
  "Metas e Desafios": "text-orange-400", "Análise de Concorrência": "text-purple-400",
  "Relatório Gerencial": "text-cyan-400", "Gamificação Entregadores": "text-yellow-500",
  "Licitações Públicas": "text-slate-400", "Workflow Aprovações": "text-green-400", "SLA de Entregas": "text-blue-500",
  "Clientes": "text-pink-500", "Marketing IA": "text-violet-500", "Contratos Recorrentes": "text-pink-400",
  "Promoções e Cupons": "text-yellow-500", "Campanhas": "text-pink-600",
  "Fidelidade / Indicações": "text-red-400", "CRM Avançado": "text-pink-300",
  "Programa de Indicação": "text-rose-400", "Ranking dos Clientes": "text-amber-500",
  "Gestão de Crédito": "text-red-500", "Aplicativo do Cliente": "text-blue-400",
  "Estoque do Dia": "text-orange-500", "Produtos": "text-orange-400", "Compras": "text-orange-600",
  "Fornecedores": "text-orange-300", "Comodatos": "text-amber-400",
  "Transferência entre Filiais": "text-orange-500", "MCMM Inteligente": "text-green-500",
  "Histórico Movimentações": "text-orange-400", "Lotes & Rastreabilidade": "text-orange-600",
  "Fluxo de Caixa": "text-yellow-500", "Contas a Pagar": "text-red-400", "Contas a Receber": "text-green-400",
  "Gestão de Cartões": "text-yellow-400", "Contas Bancárias": "text-blue-400",
  "Aprovar Despesas": "text-green-500", "Cobranças": "text-yellow-600",
  "Controle de Cheques": "text-yellow-300", "Calendário Financeiro": "text-blue-300",
  "Orçamentos": "text-yellow-500", "Contador": "text-slate-400",
  "Venda Antecipada": "text-green-500", "Balanço Patrimonial": "text-yellow-400",
  "Vale Gás": "text-amber-400", "Fechamento Mensal": "text-yellow-600",
  "E-mail Transacional": "text-blue-400", "Exportação Contábil": "text-green-400",
  "Veículos": "text-indigo-500", "Controle de Combustível": "text-red-400",
  "Manutenção": "text-indigo-400", "Documentos": "text-indigo-300",
  "Checklist de Saída": "text-green-400", "Multas": "text-red-500",
  "Relatórios": "text-indigo-400", "Gamificação": "text-yellow-500",
  "Dashboard RH": "text-rose-400", "Funcionários": "text-rose-500",
  "Folha de Pagamento": "text-green-400", "Ponto Eletrônico": "text-rose-400",
  "Vale Funcionário": "text-amber-400", "Comissão do Entregador": "text-green-500",
  "Premiação": "text-yellow-400", "Bônus": "text-amber-500",
  "Alerta Jornada": "text-red-400", "Banco de Horas": "text-blue-400",
  "Horários": "text-rose-300", "Controle de Férias": "text-cyan-400",
  "Atestados e Faltas": "text-red-400", "Avaliação de Desempenho": "text-yellow-500",
  "Onboarding / Offboarding": "text-green-400", "Prevenção Trabalhista - IA": "text-red-500",
  "Produtividade - IA": "text-violet-500",
  "NF-e": "text-teal-500", "NFC-e": "text-teal-400", "MDF-e": "text-teal-600",
  "CT-e": "text-teal-300", "Central de XML": "text-teal-400", "Painel Fiscal": "text-teal-500",
  "Geral / Regras": "text-slate-400", "Usuários": "text-blue-400", "Permissões": "text-red-400",
  "Auditoria": "text-green-400", "Unidades / Lojas": "text-purple-400",
  "Canais de Venda": "text-pink-400", "Categorias de Despesas": "text-amber-400",
  "Documentos da Empresa": "text-slate-400", "Notificações e Alertas": "text-yellow-400",
  "Personalização Visual": "text-violet-400", "Integrações / Hub": "text-cyan-400",
  "Dashboard": "text-blue-500",
};

export function MobileNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  // Auto-open active submenu
  useEffect(() => {
    if (open) {
      menuItems.forEach((item) => {
        if (item.submenu?.some((sub) => location.pathname === sub.path)) {
          setOpenMenus((prev) =>
            prev.includes(item.label) ? prev : [...prev, item.label]
          );
        }
      });
    }
  }, [open, location.pathname]);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
    setOpen(false);
  };

  const isActive = (path: string) => location.pathname === path;
  const userName = profile?.full_name || "Administrador";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 rounded-xl">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 border-r border-sidebar-border/50 bg-sidebar/95 backdrop-blur-xl">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border/50">
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <img src={logoImg} alt="Gás Fácil" className="h-10 w-10 rounded-xl shadow-md" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="font-bold text-sidebar-foreground text-[17px] tracking-[-0.03em]">Gás Fácil</h2>
                <p className="text-[9px] font-semibold text-primary/60 uppercase tracking-[0.2em]">ERP Pro</p>
              </motion.div>
            </div>
          </div>

          {/* Menu */}
          <nav className="flex-1 overflow-y-auto p-2 pb-4 scrollbar-thin">
            <div className="space-y-0.5">
              {menuItems.map((item, idx) => {
                const Icon = item.icon;
                const hasSubmenu = !!item.submenu;
                const isSubmenuOpen = openMenus.includes(item.label);
                const hasActiveChild = item.submenu?.some((sub) => isActive(sub.path));

                if (hasSubmenu) {
                  return (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02, duration: 0.2 }}
                    >
                      <button
                        onClick={() => toggleMenu(item.label)}
                        className={cn(
                          "group flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200",
                          hasActiveChild
                            ? "bg-primary/8 text-primary"
                            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={cn(
                            "h-[18px] w-[18px] transition-transform duration-200 stroke-[2.25]",
                            !hasActiveChild && "group-hover:scale-110",
                            !hasActiveChild && (menuIconColors[item.label] || "")
                          )} />
                          <span>{item.label}</span>
                        </div>
                        <motion.div
                          animate={{ rotate: isSubmenuOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        </motion.div>
                      </button>

                      <AnimatePresence initial={false}>
                        {isSubmenuOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="ml-5 space-y-0.5 border-l-2 border-sidebar-border/40 pl-3 py-1">
                              {item.submenu?.map((sub, subIdx) => {
                                const SubIcon = sub.icon;
                                const subActive = isActive(sub.path);
                                return (
                                  <motion.div
                                    key={sub.path}
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: subIdx * 0.02, duration: 0.15 }}
                                  >
                                    <Link
                                      to={sub.path}
                                      onClick={() => setOpen(false)}
                                      className={cn(
                                        "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold tracking-[-0.005em] transition-all duration-200",
                                        subActive
                                          ? "bg-primary text-primary-foreground shadow-sm"
                                          : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                                      )}
                                    >
                                      <SubIcon className={cn(
                                        "h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 stroke-[2]",
                                        !subActive && "group-hover:scale-110 group-hover:text-primary"
                                      )} />
                                      <span>{sub.label}</span>
                                    </Link>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={item.path}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02, duration: 0.2 }}
                  >
                    <Link
                      to={item.path!}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200",
                        isActive(item.path!)
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                      )}
                    >
                      <Icon className={cn(
                        "h-[18px] w-[18px] transition-transform duration-200 stroke-[2.25]",
                        !isActive(item.path!) && "group-hover:scale-110"
                      )} />
                      <span>{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </nav>

          {/* User Footer */}
          <div className="flex-shrink-0 border-t border-sidebar-border/50 p-3">
            <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/40 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex-shrink-0">
                <span className="text-xs font-bold text-primary">{userInitial}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold tracking-[-0.02em] text-sidebar-foreground truncate">{userName}</p>
                <p className="text-[10px] font-medium text-sidebar-foreground/45 uppercase tracking-wider">Administrador</p>
              </div>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  className="h-8 w-8 rounded-lg text-sidebar-foreground/40 hover:text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
