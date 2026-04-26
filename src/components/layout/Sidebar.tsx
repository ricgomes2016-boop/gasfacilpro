import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LogOut,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Store,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoImg from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useState, useEffect } from "react";
import { menuItems } from "./menuItems";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardTheme } from "@/hooks/useDashboardTheme";

// Color map for menu category icons using only semantic design-system tokens
const menuIconColors: Record<string, string> = {
  "Dashboard": "text-sidebar-foreground",
  "Assistente IA": "text-sidebar-foreground",
  "Atendimento": "text-sidebar-foreground",
  "Vendas": "text-sidebar-foreground",
  "Caixa": "text-sidebar-foreground",
  "Gestão Operacional": "text-sidebar-foreground",
  "Gestão de Clientes": "text-sidebar-foreground",
  "Gestão de Estoque": "text-sidebar-foreground",
  "Gestão Financeira": "text-sidebar-foreground",
  "Gestão de Frota": "text-sidebar-foreground",
  "Gestão de RH": "text-sidebar-foreground",
  "Gestão Fiscal": "text-sidebar-foreground",
  "Marketing": "text-sidebar-foreground",
  "Configurações": "text-sidebar-foreground/80",
};

const subMenuIconColors: Record<string, string> = {
  // Atendimento
  "Central de Atendimento": "text-sidebar-foreground",
  "Inbox WhatsApp": "text-sidebar-foreground",
  "Config WhatsApp": "text-sidebar-foreground",
  // Vendas
  "PDV": "text-sidebar-foreground/85",
  "Nova Venda": "text-sidebar-foreground/85",
  "Pedidos": "text-sidebar-foreground/85",
  "Devoluções / Trocas": "text-sidebar-foreground/85",
  "Relatório de Vendas": "text-sidebar-foreground/85",
  // Caixa
  "Acerto Diário Entregador": "text-sidebar-foreground/85",
  "Caixa do Dia": "text-sidebar-foreground/85",
  "Despesas (Sangria)": "text-sidebar-foreground/85",
  // Gestão Operacional
  "Central de Inteligência": "text-sidebar-foreground/85",
  "Central de Indicadores": "text-sidebar-foreground/85",
  "Mapa Operacional": "text-sidebar-foreground/85",
  "Alertas Inteligentes": "text-sidebar-foreground/85",
  "Rotas de Entrega": "text-sidebar-foreground/85",
  "Escalas de Entregadores": "text-sidebar-foreground/85",
  "Análise de Resultados": "text-sidebar-foreground/85",
  "Planejamento": "text-sidebar-foreground/85",
  "Metas e Desafios": "text-sidebar-foreground/85",
  "Análise de Concorrência": "text-sidebar-foreground/85",
  "Relatório Gerencial": "text-sidebar-foreground/85",
  "Gamificação Entregadores": "text-sidebar-foreground/85",
  "Licitações Públicas": "text-sidebar-foreground/85",
  "Workflow Aprovações": "text-sidebar-foreground/85",
  "SLA de Entregas": "text-sidebar-foreground/85",
  // Gestão de Clientes
  "Clientes": "text-sidebar-foreground/85",
  "Marketing IA": "text-sidebar-foreground/85",
  "Contratos Recorrentes": "text-sidebar-foreground/85",
  "Promoções e Cupons": "text-sidebar-foreground/85",
  "Campanhas": "text-sidebar-foreground/85",
  "Fidelidade / Indicações": "text-sidebar-foreground/85",
  "CRM Avançado": "text-sidebar-foreground/85",
  "Programa de Indicação": "text-sidebar-foreground/85",
  "Ranking dos Clientes": "text-sidebar-foreground/85",
  "Gestão de Crédito": "text-sidebar-foreground/85",
  "Aplicativo do Cliente": "text-sidebar-foreground/85",
  // Gestão de Estoque
  "Estoque do Dia": "text-sidebar-foreground/85",
  "Produtos": "text-sidebar-foreground/85",
  "Compras": "text-sidebar-foreground/85",
  "Fornecedores": "text-sidebar-foreground/85",
  "Comodatos": "text-sidebar-foreground/85",
  "Transferência entre Filiais": "text-sidebar-foreground/85",
  "MCMM Inteligente": "text-sidebar-foreground/85",
  "Histórico Movimentações": "text-sidebar-foreground/85",
  "Lotes & Rastreabilidade": "text-sidebar-foreground/85",
  // Gestão Financeira
  "Fluxo de Caixa": "text-sidebar-foreground/85",
  "Contas a Pagar": "text-sidebar-foreground/85",
  "Contas a Receber": "text-sidebar-foreground/85",
  "Gestão de Cartões": "text-sidebar-foreground/85",
  "Contas Bancárias": "text-sidebar-foreground/85",
  "Aprovar Despesas": "text-sidebar-foreground/85",
  "Cobranças": "text-sidebar-foreground/85",
  "Controle de Cheques": "text-sidebar-foreground/85",
  "Calendário Financeiro": "text-sidebar-foreground/85",
  "Orçamentos": "text-sidebar-foreground/85",
  "Contador": "text-sidebar-foreground/85",
  "Venda Antecipada": "text-sidebar-foreground/85",
  "Balanço Patrimonial": "text-sidebar-foreground/85",
  "Vale Gás": "text-sidebar-foreground/85",
  "Fechamento Mensal": "text-sidebar-foreground/85",
  "E-mail Transacional": "text-sidebar-foreground/85",
  "Exportação Contábil": "text-sidebar-foreground/85",
  // Gestão de Frota
  "Veículos": "text-sidebar-foreground/85",
  "Controle de Combustível": "text-sidebar-foreground/85",
  "Manutenção": "text-sidebar-foreground/85",
  "Documentos": "text-sidebar-foreground/85",
  "Checklist de Saída": "text-sidebar-foreground/85",
  "Multas": "text-sidebar-foreground/85",
  "Relatórios": "text-sidebar-foreground/85",
  "Gamificação": "text-sidebar-foreground/85",
  // Gestão de RH
  "Dashboard RH": "text-sidebar-foreground/85",
  "Funcionários": "text-sidebar-foreground/85",
  "Folha de Pagamento": "text-sidebar-foreground/85",
  "Ponto Eletrônico": "text-sidebar-foreground/85",
  "Vale Funcionário": "text-sidebar-foreground/85",
  "Comissão do Entregador": "text-sidebar-foreground/85",
  "Premiação": "text-sidebar-foreground/85",
  "Bônus": "text-sidebar-foreground/85",
  "Alerta Jornada": "text-sidebar-foreground/85",
  "Banco de Horas": "text-sidebar-foreground/85",
  "Horários": "text-sidebar-foreground/85",
  "Controle de Férias": "text-sidebar-foreground/85",
  "Atestados e Faltas": "text-sidebar-foreground/85",
  "Avaliação de Desempenho": "text-sidebar-foreground/85",
  "Onboarding / Offboarding": "text-sidebar-foreground/85",
  "Prevenção Trabalhista - IA": "text-sidebar-foreground/85",
  "Produtividade - IA": "text-sidebar-foreground/85",
  // Gestão Fiscal
  "NF-e": "text-sidebar-foreground/85",
  "NFC-e": "text-sidebar-foreground/85",
  "MDF-e": "text-sidebar-foreground/85",
  "CT-e": "text-sidebar-foreground/85",
  "Central de XML": "text-sidebar-foreground/85",
  "Painel Fiscal": "text-sidebar-foreground/85",
  // Configurações
  "Geral / Regras": "text-sidebar-foreground/85",
  "Usuários": "text-sidebar-foreground/85",
  "Permissões": "text-sidebar-foreground/85",
  "Auditoria": "text-sidebar-foreground/85",
  "Unidades / Lojas": "text-sidebar-foreground/85",
  "Canais de Venda": "text-sidebar-foreground/85",
  "Categorias de Despesas": "text-sidebar-foreground/85",
  "Documentos da Empresa": "text-sidebar-foreground/85",
  "Notificações e Alertas": "text-sidebar-foreground/85",
  "Personalização Visual": "text-sidebar-foreground/85",
  "Integrações / Hub": "text-sidebar-foreground/85",
  "WhatsApp Gateway": "text-sidebar-foreground/85",
  // Marketing
  "Criar Conteúdo IA": "text-sidebar-foreground/85",
  "Biblioteca": "text-sidebar-foreground/85",
  "Agendamentos": "text-sidebar-foreground/85",
  "Redes Sociais": "text-sidebar-foreground/85",
  "Atendimento IA": "text-sidebar-foreground/85",
};

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { collapsed, toggle } = useSidebarContext();
  const { signOut, profile } = useAuth();
  const { unidades, unidadeAtual, setUnidadeAtual } = useUnidade();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  // Auto-open active submenu
  useEffect(() => {
    menuItems.forEach((item) => {
      if (item.submenu?.some((sub) => location.pathname === sub.path)) {
        setOpenMenus((prev) =>
          prev.includes(item.label) ? prev : [...prev, item.label]
        );
      }
    });
  }, [location.pathname]);

  const toggleSubmenu = (label: string) => {
    setOpenMenus((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const isSubmenuOpen = (label: string) => openMenus.includes(label);
  const isActive = (path?: string) => path && location.pathname === path;
  const isSubmenuActive = (submenu?: { label: string; path?: string }[]) =>
    submenu?.some((item) => item.path && location.pathname === item.path);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const userName = profile?.full_name || "Administrador";
  const userInitial = userName.charAt(0).toUpperCase();

  const { themeClass } = useDashboardTheme();

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        animate={{ width: collapsed ? 64 : 260 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className={cn(
          themeClass,
          "fixed left-0 top-0 z-40 hidden xl:flex h-screen flex-col border-r border-sidebar-border/15 bg-gradient-to-b from-primary to-secondary shadow-2xl"
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border/20 px-3">
          <Link to="/dashboard" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 2 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <img src={logoImg} alt="Gás Fácil" className="h-9 w-9 flex-shrink-0 rounded-xl object-contain shadow-md" />
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col"
                >
                  <span className="text-[17px] font-extrabold text-sidebar-foreground">
                    Gás Fácil
                  </span>
                  <span className="text-[9px] font-bold text-sidebar-foreground/75 uppercase tracking-[0.2em]">
                    ERP Pro
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
                className="h-8 w-8 flex-shrink-0 rounded-full text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/20"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </motion.div>
        </div>

        {/* Store Selector */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b border-sidebar-border/20 p-3"
            >
              <Select
                value={unidadeAtual?.id || ""}
                onValueChange={(val) => {
                  const u = unidades.find((u) => u.id === val);
                  if (u) setUnidadeAtual(u);
                }}
              >
                <SelectTrigger className="bg-sidebar-accent/15 border-sidebar-border/25 text-sidebar-foreground text-xs font-semibold h-9 rounded-2xl shadow-sm">
                  <Store className="mr-2 h-3.5 w-3.5 text-sidebar-foreground" />
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                  {unidades.length === 0 && (
                    <SelectItem value="__none" disabled>Nenhuma unidade</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed Store Icon */}
        {collapsed && (
          <div className="border-b border-sidebar-border p-3 flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent cursor-pointer hover:bg-sidebar-accent/80 transition-colors">
                  <Store className="h-4 w-4 text-primary" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{unidadeAtual?.nome || "Selecionar loja"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          <div className="space-y-0.5">
            {menuItems.map((item, idx) => {
              const hasSubmenu = !!item.submenu;
              const isOpen = isSubmenuOpen(item.label);
              const isItemActive = isActive(item.path);
              const isChildActive = isSubmenuActive(item.submenu);

              // Collapsed mode
              if (collapsed) {
                return (
                  <Tooltip key={item.label}>
                    <TooltipTrigger asChild>
                      {item.path ? (
                        <Link
                          to={item.path}
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl mx-auto transition-all duration-200",
                            isItemActive
                              ? "bg-sidebar-accent/95 text-primary shadow-lg shadow-foreground/15 ring-1 ring-sidebar-border/25"
                              : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/18 hover:ring-1 hover:ring-sidebar-border/20"
                          )}
                        >
                          <item.icon className={cn("h-[18px] w-[18px]", isItemActive ? "" : menuIconColors[item.label] || "")} />
                        </Link>
                      ) : (
                        <button
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl mx-auto transition-all duration-200",
                            isChildActive
                              ? "bg-sidebar-accent/95 text-primary ring-1 ring-sidebar-border/25"
                              : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/18 hover:ring-1 hover:ring-sidebar-border/20"
                          )}
                        >
                          <item.icon className={cn("h-[18px] w-[18px]", isChildActive ? "" : menuIconColors[item.label] || "")} />
                        </button>
                      )}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="flex flex-col gap-1">
                      <p className="font-semibold text-xs">{item.label}</p>
                      {hasSubmenu && (
                        <div className="flex flex-col gap-0.5 mt-1 border-t border-border pt-1">
                          {item.submenu?.map((subItem) => {
                            const SubIcon = subItem.icon;
                            return (
                              <Link
                                key={subItem.path}
                                to={subItem.path}
                                className={cn(
                                  "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-accent transition-colors",
                                  isActive(subItem.path) && "bg-accent font-medium text-primary"
                                )}
                              >
                                <SubIcon className={cn("h-3 w-3 flex-shrink-0", isActive(subItem.path) ? "" : subMenuIconColors[subItem.label] || menuIconColors[item.label] || "")} />
                                <span>{subItem.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              // Expanded mode
              return (
                <motion.div
                  key={item.label}
                  initial={false}
                  layout
                >
                  {item.path ? (
                    // Special treatment for Assistente IA
                    item.label === "Assistente IA" ? (
                      <Link
                        to={item.path}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200 relative overflow-hidden",
                          isItemActive
                            ? "bg-sidebar-accent/95 text-primary shadow-lg shadow-foreground/15 ring-1 ring-sidebar-border/25"
                            : "bg-sidebar-accent/15 text-sidebar-foreground border border-sidebar-border/20 hover:bg-sidebar-accent/25"
                        )}
                      >
                        <motion.div
                          animate={{ rotate: [0, 15, -10, 0] }}
                          transition={{ duration: 3, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
                        >
                          <item.icon className="h-[18px] w-[18px] flex-shrink-0 stroke-[2.25]" />
                        </motion.div>
                        <span className="truncate">{item.label}</span>
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider opacity-70 bg-primary/15 px-1.5 py-0.5 rounded-full">IA</span>
                      </Link>
                    ) : (
                    <Link
                      to={item.path}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200 relative",
                        isItemActive
                          ? "bg-sidebar-accent/95 text-primary shadow-lg shadow-foreground/15 ring-1 ring-sidebar-border/25"
                            : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/18 hover:ring-1 hover:ring-sidebar-border/20"
                      )}
                    >
                      <item.icon className={cn(
                        "h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200 stroke-[2.25]",
                        isItemActive ? "" : menuIconColors[item.label] || "",
                        !isItemActive && "group-hover:scale-110"
                      )} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                    )
                  ) : (
                    <button
                      onClick={() => toggleSubmenu(item.label)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200",
                        isChildActive
                          ? "bg-sidebar-accent/95 text-primary ring-1 ring-sidebar-border/25"
                          : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/18 hover:ring-1 hover:ring-sidebar-border/20"
                      )}
                    >
                      <item.icon className={cn(
                        "h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200 stroke-[2.25]",
                        isChildActive ? "" : menuIconColors[item.label] || "",
                        !isChildActive && "group-hover:scale-110"
                      )} />
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {hasSubmenu && (
                        <motion.div
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        </motion.div>
                      )}
                    </button>
                  )}

                  {/* Submenu */}
                  <AnimatePresence initial={false}>
                    {hasSubmenu && isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="ml-5 mt-0.5 space-y-0.5 border-l-2 border-sidebar-border/25 pl-3 py-1 max-h-[400px] overflow-y-auto scrollbar-thin">
                          {item.submenu?.map((subItem, subIdx) => {
                            const SubIcon = subItem.icon;
                            const subActive = isActive(subItem.path);
                            return (
                              <motion.div
                                key={subItem.path}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: subIdx * 0.02, duration: 0.15 }}
                              >
                                {subItem.externalUrl ? (
                                  <a
                                    href={subItem.externalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                      className="group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12px] font-bold transition-all duration-200 text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/18"
                                  >
                                    <SubIcon className={cn(
                                      "h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 stroke-[2]",
                                      subMenuIconColors[subItem.label] || menuIconColors[item.label] || "",
                                      "group-hover:scale-110"
                                    )} />
                                    <span className="truncate">{subItem.label}</span>
                                  </a>
                                ) : (
                                  <Link
                                    to={subItem.path!}
                                    className={cn(
                                      "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold tracking-[-0.005em] transition-all duration-200",
                                      subActive
                                        ? "bg-sidebar-accent/95 text-primary shadow-sm ring-1 ring-sidebar-border/25"
                                        : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/18 hover:ring-1 hover:ring-sidebar-border/20"
                                    )}
                                  >
                                    <SubIcon className={cn(
                                      "h-3.5 w-3.5 flex-shrink-0 transition-all duration-200 stroke-[2]",
                                      subActive ? "" : subMenuIconColors[subItem.label] || menuIconColors[item.label] || "",
                                      !subActive && "group-hover:scale-110"
                                    )} />
                                    <span className="truncate">{subItem.label}</span>
                                  </Link>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </nav>

        {/* User + Logout */}
        <div className="flex-shrink-0 border-t border-sidebar-border p-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 cursor-pointer">
                    <span className="text-xs font-bold text-primary">{userInitial}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs text-muted-foreground">Logado como</p>
                  <p className="font-medium">{userName}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleSignOut}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground transition-colors hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-sidebar-border/20 bg-sidebar-accent/15 p-3 shadow-lg shadow-foreground/10"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex-shrink-0">
                  <span className="text-xs font-bold text-primary">{userInitial}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-extrabold text-sidebar-foreground truncate">{userName}</p>
                  <p className="text-[10px] font-bold text-sidebar-foreground truncate uppercase tracking-wider">Administrador</p>
                </div>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSignOut}
                    className="h-8 w-8 rounded-lg text-sidebar-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
