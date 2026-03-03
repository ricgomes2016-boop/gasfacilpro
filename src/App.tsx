import { lazy, Suspense } from "react";
import { CallerIdPopup } from "@/components/atendimento/CallerIdPopup";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DeliveryNotificationProvider } from "@/contexts/DeliveryNotificationContext";
import { ClienteProvider } from "@/contexts/ClienteContext";
import { ValeGasProvider } from "@/contexts/ValeGasContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { UnidadeProvider } from "@/contexts/UnidadeContext";
import { EmpresaProvider } from "@/contexts/EmpresaContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/ui/page-loader";

// Eager load: Auth + Dashboard + Landing (critical path)
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import LandingPage from "./pages/LandingPage";

// Lazy load everything else
const Vendas = lazy(() => import("./pages/Vendas"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Vendas
const NovaVenda = lazy(() => import("./pages/vendas/NovaVenda"));
const Pedidos = lazy(() => import("./pages/vendas/Pedidos"));
const EditarPedido = lazy(() => import("./pages/vendas/EditarPedido"));
const PDV = lazy(() => import("./pages/vendas/PDV"));
const RelatorioVendas = lazy(() => import("./pages/vendas/RelatorioVendas"));

// Caixa
const AcertoEntregador = lazy(() => import("./pages/caixa/AcertoEntregador"));
const CaixaDia = lazy(() => import("./pages/caixa/CaixaDia"));
const Despesas = lazy(() => import("./pages/caixa/Despesas"));

// Operacional
const ConselhosIA = lazy(() => import("./pages/operacional/ConselhosIA"));
const CentralIndicadores = lazy(() => import("./pages/operacional/CentralIndicadores"));
const MapaOperacional = lazy(() => import("./pages/operacional/MapaOperacional"));
const CockpitGestor = lazy(() => import("./pages/operacional/CockpitGestor"));
const AlertasInteligentes = lazy(() => import("./pages/operacional/AlertasInteligentes"));
const AnaliseConcorrencia = lazy(() => import("./pages/operacional/AnaliseConcorrencia"));
const DashboardExecutivo = lazy(() => import("./pages/operacional/DashboardExecutivo"));
const DashboardAvancado = lazy(() => import("./pages/operacional/DashboardAvancado"));
const DashboardTrabalhista = lazy(() => import("./pages/operacional/DashboardTrabalhista"));
const DashboardLogistico = lazy(() => import("./pages/operacional/DashboardLogistico"));
const DRE = lazy(() => import("./pages/operacional/DRE"));
const MetasDesafios = lazy(() => import("./pages/operacional/MetasDesafios"));
const MapaEntregadores = lazy(() => import("./pages/operacional/MapaEntregadores"));
const PlanejamentoAnual = lazy(() => import("./pages/operacional/PlanejamentoAnual"));
const PlanejamentoMensal = lazy(() => import("./pages/operacional/PlanejamentoMensal"));
const CanaisVenda = lazy(() => import("./pages/operacional/CanaisVenda"));
const PontoEquilibrio = lazy(() => import("./pages/operacional/PontoEquilibrio"));
const ResultadoOperacional = lazy(() => import("./pages/operacional/ResultadoOperacional"));
const AnaliseResultados = lazy(() => import("./pages/operacional/AnaliseResultados"));
const Planejamento = lazy(() => import("./pages/operacional/Planejamento"));
const CategoriasDespesa = lazy(() => import("./pages/config/CategoriasDespesa"));

// Clientes
const CadastroClientes = lazy(() => import("./pages/clientes/CadastroClientes"));
const ClientePerfilPage = lazy(() => import("./pages/clientes/ClientePerfilPage"));
const Campanhas = lazy(() => import("./pages/clientes/Campanhas"));
const PromocoesCupons = lazy(() => import("./pages/clientes/PromocoesCupons"));
const Fidelidade = lazy(() => import("./pages/clientes/Fidelidade"));
const CRM = lazy(() => import("./pages/clientes/CRM"));
const RankingClientes = lazy(() => import("./pages/clientes/RankingClientes"));
const MarketingIA = lazy(() => import("./pages/clientes/MarketingIA"));

// Estoque
const Estoque = lazy(() => import("./pages/Estoque"));
const Entregas = lazy(() => import("./pages/Entregas"));
const Compras = lazy(() => import("./pages/estoque/Compras"));
const Comodatos = lazy(() => import("./pages/estoque/Comodatos"));
const DashboardEstoque = lazy(() => import("./pages/estoque/DashboardEstoque"));
const HistoricoMovimentacoes = lazy(() => import("./pages/estoque/HistoricoMovimentacoes"));
const MCMM = lazy(() => import("./pages/estoque/MCMM"));
const TransferenciaEstoque = lazy(() => import("./pages/estoque/TransferenciaEstoque"));

// Cadastros
const Entregadores = lazy(() => import("./pages/cadastros/Entregadores"));
const Fornecedores = lazy(() => import("./pages/cadastros/Fornecedores"));
const Veiculos = lazy(() => import("./pages/cadastros/Veiculos"));
const Funcionarios = lazy(() => import("./pages/cadastros/Funcionarios"));
const Produtos = lazy(() => import("./pages/cadastros/Produtos"));

// Financeiro
const DashboardFinanceiro = lazy(() => import("./pages/financeiro/DashboardFinanceiro"));
const AgingReport = lazy(() => import("./pages/financeiro/AgingReport"));
const FluxoCaixaConsolidado = lazy(() => import("./pages/financeiro/FluxoCaixaProjetado"));
const ContasPagar = lazy(() => import("./pages/financeiro/ContasPagar"));
const ContasReceber = lazy(() => import("./pages/financeiro/ContasReceber"));
const AprovarDespesas = lazy(() => import("./pages/financeiro/AprovarDespesas"));
const Conciliacao = lazy(() => import("./pages/financeiro/Conciliacao"));
const Contador = lazy(() => import("./pages/financeiro/Contador"));
const ContadorHome = lazy(() => import("./pages/contador/ContadorHome"));
const ContadorCalendario = lazy(() => import("./pages/contador/ContadorCalendario"));
const ContadorSolicitacoes = lazy(() => import("./pages/contador/ContadorSolicitacoes"));
const ContadorComunicados = lazy(() => import("./pages/contador/ContadorComunicados"));
const TerminaisCartao = lazy(() => import("./pages/financeiro/TerminaisCartao"));
const GestaoCartoes = lazy(() => import("./pages/financeiro/GestaoCartoes"));
const Cobrancas = lazy(() => import("./pages/financeiro/Cobrancas"));
const CalendarioFinanceiro = lazy(() => import("./pages/financeiro/CalendarioFinanceiro"));
const ValeGas = lazy(() => import("./pages/financeiro/ValeGas"));
const Orcamentos = lazy(() => import("./pages/financeiro/Orcamentos"));
const ContasBancarias = lazy(() => import("./pages/financeiro/ContasBancarias"));
const ControleCheques = lazy(() => import("./pages/financeiro/ControleCheques"));
const VendaAntecipada = lazy(() => import("./pages/financeiro/VendaAntecipada"));
const BalancoPatrimonial = lazy(() => import("./pages/financeiro/BalancoPatrimonial"));
const PagamentosCartao = lazy(() => import("./pages/financeiro/PagamentosCartao"));


// Frota
const DashboardFrota = lazy(() => import("./pages/frota/DashboardFrota"));
const Combustivel = lazy(() => import("./pages/frota/Combustivel"));
const Manutencao = lazy(() => import("./pages/frota/Manutencao"));
const RelatoriosFrota = lazy(() => import("./pages/frota/RelatoriosFrota"));
const Gamificacao = lazy(() => import("./pages/frota/Gamificacao"));
const DocumentosFrota = lazy(() => import("./pages/frota/DocumentosFrota"));
const ChecklistSaida = lazy(() => import("./pages/frota/ChecklistSaida"));
const MultasFrota = lazy(() => import("./pages/frota/MultasFrota"));

// RH
const FolhaPagamento = lazy(() => import("./pages/rh/FolhaPagamento"));
const ValeFuncionario = lazy(() => import("./pages/rh/ValeFuncionario"));
const ComissaoEntregador = lazy(() => import("./pages/rh/ComissaoEntregador"));
const Premiacao = lazy(() => import("./pages/rh/Premiacao"));
const Bonus = lazy(() => import("./pages/rh/Bonus"));
const AlertaJornada = lazy(() => import("./pages/rh/AlertaJornada"));
const BancoHoras = lazy(() => import("./pages/rh/BancoHoras"));
const Horarios = lazy(() => import("./pages/rh/Horarios"));
const PrevencaoTrabalhistaIA = lazy(() => import("./pages/rh/PrevencaoTrabalhistaIA"));
const ProdutividadeIA = lazy(() => import("./pages/rh/ProdutividadeIA"));
const Ferias = lazy(() => import("./pages/rh/Ferias"));
const PontoEletronico = lazy(() => import("./pages/rh/PontoEletronico"));
const AtestadosFaltas = lazy(() => import("./pages/rh/AtestadosFaltas"));
const AvaliacaoDesempenho = lazy(() => import("./pages/rh/AvaliacaoDesempenho"));
const OnboardingOffboarding = lazy(() => import("./pages/rh/OnboardingOffboarding"));
const DashboardRH = lazy(() => import("./pages/rh/DashboardRH"));

// Fiscal
const DashboardFiscal = lazy(() => import("./pages/fiscal/DashboardFiscal"));
const EmitirNFe = lazy(() => import("./pages/fiscal/EmitirNFe"));
const EmitirNFCe = lazy(() => import("./pages/fiscal/EmitirNFCe"));
const EmitirMDFe = lazy(() => import("./pages/fiscal/EmitirMDFe"));
const EmitirCTe = lazy(() => import("./pages/fiscal/EmitirCTe"));
const GerarXML = lazy(() => import("./pages/fiscal/GerarXML"));
const RelatoriosNotas = lazy(() => import("./pages/fiscal/RelatoriosNotas"));

// Configurações
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Auditoria = lazy(() => import("./pages/config/Auditoria"));
const Permissoes = lazy(() => import("./pages/config/Permissoes"));
const UnidadesConfig = lazy(() => import("./pages/config/Unidades"));
const Usuarios = lazy(() => import("./pages/config/Usuarios"));
const DocumentosEmpresa = lazy(() => import("./pages/config/DocumentosEmpresa"));
const Notificacoes = lazy(() => import("./pages/config/Notificacoes"));
const Integracoes = lazy(() => import("./pages/config/Integracoes"));
const PersonalizacaoVisual = lazy(() => import("./pages/config/PersonalizacaoVisual"));
const MinhaEmpresa = lazy(() => import("./pages/config/MinhaEmpresa"));
const OnboardingEmpresa = lazy(() => import("./pages/onboarding/OnboardingEmpresa"));
const OnboardingSetup = lazy(() => import("./pages/onboarding/OnboardingSetup"));

// Super Admin
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminEmpresas = lazy(() => import("./pages/admin/AdminEmpresas"));
const AdminUnidades = lazy(() => import("./pages/admin/AdminUnidades"));
const AdminAdmins = lazy(() => import("./pages/admin/AdminAdmins"));

// Assistente IA
const AssistenteIA = lazy(() => import("./pages/AssistenteIA"));

// Atendimento
const CentralAtendimento = lazy(() => import("./pages/atendimento/CentralAtendimento"));
const AppBina = lazy(() => import("./pages/atendimento/AppBina"));

// Devoluções
const Devolucoes = lazy(() => import("./pages/vendas/Devolucoes"));

// Contratos Recorrentes
const ContratosRecorrentes = lazy(() => import("./pages/clientes/ContratosRecorrentes"));

// Relatório Gerencial
const RelatorioGerencial = lazy(() => import("./pages/operacional/RelatorioGerencial"));

// App Entregador
const EntregadorDashboard = lazy(() => import("./pages/entregador/EntregadorDashboard"));
const EntregadorEntregas = lazy(() => import("./pages/entregador/EntregadorEntregas"));
const FinalizarEntrega = lazy(() => import("./pages/entregador/FinalizarEntrega"));
const EntregadorNovaVenda = lazy(() => import("./pages/entregador/EntregadorNovaVenda"));
const EntregadorDespesas = lazy(() => import("./pages/entregador/EntregadorDespesas"));
const EntregadorCombustivel = lazy(() => import("./pages/entregador/EntregadorCombustivel"));
const EntregadorPerfil = lazy(() => import("./pages/entregador/EntregadorPerfil"));
const EntregadorHistorico = lazy(() => import("./pages/entregador/EntregadorHistorico"));
const EntregadorIniciarJornada = lazy(() => import("./pages/entregador/EntregadorIniciarJornada"));
const EntregadorConfiguracoes = lazy(() => import("./pages/entregador/EntregadorConfiguracoes"));
const EntregadorEstoque = lazy(() => import("./pages/entregador/EntregadorEstoque"));
const EntregadorTransferencia = lazy(() => import("./pages/entregador/EntregadorTransferencia"));
const EntregadorConquistas = lazy(() => import("./pages/entregador/EntregadorConquistas"));
const EntregadorProdutividade = lazy(() => import("./pages/entregador/EntregadorProdutividade"));
const EntregadorFinanceiro = lazy(() => import("./pages/entregador/EntregadorFinanceiro"));
const EntregadorVendas = lazy(() => import("./pages/entregador/EntregadorVendas"));
const EntregadorTreinamento = lazy(() => import("./pages/entregador/EntregadorTreinamento"));

// Licitações
const Licitacoes = lazy(() => import("./pages/operacional/Licitacoes"));

// SAP Modules
const WorkflowAprovacoes = lazy(() => import("./pages/operacional/WorkflowAprovacoes"));
const GestaoCredito = lazy(() => import("./pages/clientes/GestaoCredito"));
const LotesRastreabilidade = lazy(() => import("./pages/estoque/LotesRastreabilidade"));
const SlaEntregas = lazy(() => import("./pages/operacional/SlaEntregas"));
const FechamentoMensal = lazy(() => import("./pages/financeiro/FechamentoMensal"));

// Clientes
const ProgramaIndicacao = lazy(() => import("./pages/clientes/ProgramaIndicacao"));

// Gamificação Entregadores (Painel Gestor)
const GamificacaoEntregadores = lazy(() => import("./pages/operacional/GamificacaoEntregadores"));

// Gestão Operacional
const GestaoRotas = lazy(() => import("./pages/operacional/GestaoRotas"));
const GestaoEscalas = lazy(() => import("./pages/operacional/GestaoEscalas"));

// App Parceiro
const ParceiroDashboard = lazy(() => import("./pages/parceiro/ParceiroDashboard"));
const ParceiroVenderVale = lazy(() => import("./pages/parceiro/ParceiroVenderVale"));
const ParceiroVales = lazy(() => import("./pages/parceiro/ParceiroVales"));
const ParceiroQRCode = lazy(() => import("./pages/parceiro/ParceiroQRCode"));

// Página Pública
const ComprarValeGas = lazy(() => import("./pages/publico/ComprarValeGas"));

// App Cliente
const ClienteHome = lazy(() => import("./pages/cliente/ClienteHome"));
const ClienteCadastro = lazy(() => import("./pages/cliente/ClienteCadastro"));
const ClienteCarrinho = lazy(() => import("./pages/cliente/ClienteCarrinho"));
const ClienteCheckout = lazy(() => import("./pages/cliente/ClienteCheckout"));
const ClienteIndicacao = lazy(() => import("./pages/cliente/ClienteIndicacao"));
const ClienteCarteira = lazy(() => import("./pages/cliente/ClienteCarteira"));
const ClienteValeGas = lazy(() => import("./pages/cliente/ClienteValeGas"));
const ClienteHistorico = lazy(() => import("./pages/cliente/ClienteHistorico"));
const ClienteDicas = lazy(() => import("./pages/cliente/ClienteDicas"));
const ClienteConsumo = lazy(() => import("./pages/cliente/ClienteConsumo"));
const ClientePerfil = lazy(() => import("./pages/cliente/ClientePerfil"));
const ClienteRastreamento = lazy(() => import("./pages/cliente/ClienteRastreamento"));
const ClienteEnderecos = lazy(() => import("./pages/cliente/ClienteEnderecos"));
const ClienteNotificacoes = lazy(() => import("./pages/cliente/ClienteNotificacoes"));
const ClienteAssinaturas = lazy(() => import("./pages/cliente/ClienteAssinaturas"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
          <UnidadeProvider>
            <DeliveryNotificationProvider>
              <ClienteProvider>
                <ValeGasProvider>
                  <Toaster />
                  <Sonner />
                  <CallerIdPopup />
                <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Rota raiz redireciona para dashboard */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />

                  {/* Auth - Pública */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/onboarding" element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <OnboardingEmpresa />
                    </ProtectedRoute>
                  } />
                  <Route path="/onboarding/setup" element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <OnboardingSetup />
                    </ProtectedRoute>
                  } />

                  {/* Super Admin */}
                  <Route path="/admin" element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/empresas" element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <AdminEmpresas />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/unidades" element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <AdminUnidades />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin/admins" element={
                    <ProtectedRoute allowedRoles={["super_admin"]}>
                      <AdminAdmins />
                    </ProtectedRoute>
                  } />
                  
                  {/* Dashboard - Protegida */}
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  
                  {/* Vendas - Operacional+ */}
                  <Route path="/vendas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional", "entregador"]}>
                      <Vendas />
                    </ProtectedRoute>
                  } />
                  <Route path="/vendas/nova" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional", "entregador"]}>
                      <NovaVenda />
                    </ProtectedRoute>
                  } />
                  <Route path="/vendas/pedidos" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional", "entregador"]}>
                      <Pedidos />
                    </ProtectedRoute>
                  } />
                  <Route path="/vendas/pedidos/:id/editar" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <EditarPedido />
                    </ProtectedRoute>
                  } />
                  <Route path="/vendas/pdv" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <PDV />
                    </ProtectedRoute>
                  } />
                  <Route path="/vendas/relatorio" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <RelatorioVendas />
                    </ProtectedRoute>
                  } />
                  
                  {/* Caixa - Financeiro+ */}
                  <Route path="/caixa/acerto" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <AcertoEntregador />
                    </ProtectedRoute>
                  } />
                  <Route path="/caixa/dia" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <CaixaDia />
                    </ProtectedRoute>
                  } />
                  <Route path="/caixa/despesas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <Despesas />
                    </ProtectedRoute>
                  } />
                  
                  {/* Operacional - Gestor+ */}
                  <Route path="/operacional/cockpit" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <CockpitGestor />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/indicadores" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <CentralIndicadores />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/centro" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <MapaOperacional />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/alertas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <AlertasInteligentes />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/concorrencia" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <AnaliseConcorrencia />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/ia" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <ConselhosIA />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/executivo" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <DashboardExecutivo />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/avancado" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <DashboardAvancado />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/trabalhista" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <DashboardTrabalhista />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/logistico" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <DashboardLogistico />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/dre" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <DRE />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/metas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <MetasDesafios />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/mapa" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <MapaEntregadores />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/anual" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <PlanejamentoAnual />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/mensal" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <PlanejamentoMensal />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/planejamento" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Planejamento />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/analise-resultados" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <AnaliseResultados />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/canais-venda" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <CanaisVenda />
                    </ProtectedRoute>
                  } />
                  <Route path="/config/canais-venda" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <CanaisVenda />
                    </ProtectedRoute>
                  } />
                  
                  {/* Clientes - Operacional+ */}
                  <Route path="/clientes/cadastro" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <CadastroClientes />
                    </ProtectedRoute>
                  } />
                  <Route path="/clientes/:id" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <ClientePerfilPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/clientes/promocoes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <PromocoesCupons />
                    </ProtectedRoute>
                  } />
                  <Route path="/clientes/marketing" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <MarketingIA />
                    </ProtectedRoute>
                  } />
                  <Route path="/clientes/campanhas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Campanhas />
                    </ProtectedRoute>
                  } />
                  <Route path="/clientes/fidelidade" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Fidelidade />
                    </ProtectedRoute>
                  } />
                  <Route path="/clientes/crm" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <CRM />
                    </ProtectedRoute>
                  } />
                  <Route path="/clientes/ranking" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <RankingClientes />
                    </ProtectedRoute>
                  } />
                  
                  {/* Estoque - Operacional+ */}
                  <Route path="/estoque/dashboard" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <DashboardEstoque />
                    </ProtectedRoute>
                  } />
                  <Route path="/estoque" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <Estoque />
                    </ProtectedRoute>
                  } />
                  <Route path="/estoque/compras" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <Compras />
                    </ProtectedRoute>
                  } />
                  <Route path="/estoque/comodatos" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <Comodatos />
                    </ProtectedRoute>
                  } />
                  <Route path="/estoque/mcmm" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <MCMM />
                    </ProtectedRoute>
                  } />
                  <Route path="/estoque/historico" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <HistoricoMovimentacoes />
                    </ProtectedRoute>
                  } />
                  <Route path="/estoque/transferencia" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <TransferenciaEstoque />
                    </ProtectedRoute>
                  } />
                  
                  {/* Entregas - Monitoramento */}
                  <Route path="/entregas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <Entregas />
                    </ProtectedRoute>
                  } />
                  
                   {/* Cadastros - Gestor+ */}
                  <Route path="/cadastros/entregadores" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Entregadores />
                    </ProtectedRoute>
                  } />
                  <Route path="/cadastros/fornecedores" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Fornecedores />
                    </ProtectedRoute>
                  } />
                  <Route path="/cadastros/veiculos" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Veiculos />
                    </ProtectedRoute>
                  } />
                  <Route path="/cadastros/funcionarios" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Funcionarios />
                    </ProtectedRoute>
                  } />
                  <Route path="/cadastros/produtos" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <Produtos />
                    </ProtectedRoute>
                  } />
                  
                  {/* Financeiro */}
                  <Route path="/financeiro" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <DashboardFinanceiro />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/aging" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <AgingReport />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/fluxo" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <FluxoCaixaConsolidado />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/pagar" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <ContasPagar />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/receber" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <ContasReceber />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/aprovar" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <AprovarDespesas />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/conciliacao" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <Conciliacao />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/contador" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro", "contador"]}>
                      <ContadorHome />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/contador/calendario" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro", "contador"]}>
                      <ContadorCalendario />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/contador/documentos" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro", "contador"]}>
                      <Contador />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/contador/solicitacoes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro", "contador"]}>
                      <ContadorSolicitacoes />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/contador/comunicados" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro", "contador"]}>
                      <ContadorComunicados />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/orcamentos" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro", "operacional"]}>
                      <Orcamentos />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/terminais" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <TerminaisCartao />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/cartoes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <GestaoCartoes />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/pagamentos-cartao" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <PagamentosCartao />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/cobrancas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <Cobrancas />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/boletos" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <Cobrancas />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/calendario" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <CalendarioFinanceiro />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/vale-gas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <ValeGas />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/vale-gas/*" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <ValeGas />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/contas-bancarias" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <ContasBancarias />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/cheques" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <ControleCheques />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/venda-antecipada" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <VendaAntecipada />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/balanco" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <BalancoPatrimonial />
                    </ProtectedRoute>
                  } />
                  <Route path="/financeiro/fechamento" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <FechamentoMensal />
                    </ProtectedRoute>
                  } />
                  
                  {/* SAP Modules */}
                  <Route path="/operacional/aprovacoes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <WorkflowAprovacoes />
                    </ProtectedRoute>
                  } />
                  <Route path="/clientes/credito" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <GestaoCredito />
                    </ProtectedRoute>
                  } />
                  <Route path="/estoque/lotes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <LotesRastreabilidade />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/sla" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <SlaEntregas />
                    </ProtectedRoute>
                  } />
                  
                  {/* Frota */}
                  <Route path="/frota" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <DashboardFrota />
                    </ProtectedRoute>
                  } />
                  <Route path="/frota/combustivel" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <Combustivel />
                    </ProtectedRoute>
                  } />
                  <Route path="/frota/manutencao" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Manutencao />
                    </ProtectedRoute>
                  } />
                  <Route path="/frota/relatorios" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <RelatoriosFrota />
                    </ProtectedRoute>
                  } />
                  <Route path="/frota/gamificacao" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Gamificacao />
                    </ProtectedRoute>
                  } />
                  <Route path="/frota/documentos" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <DocumentosFrota />
                    </ProtectedRoute>
                  } />
                  <Route path="/frota/checklist" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <ChecklistSaida />
                    </ProtectedRoute>
                  } />
                  <Route path="/frota/multas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <MultasFrota />
                    </ProtectedRoute>
                  } />
                  
                  {/* RH */}
                  <Route path="/rh/folha" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <FolhaPagamento />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/vale" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <ValeFuncionario />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/comissao" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <ComissaoEntregador />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/premiacao" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Premiacao />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/bonus" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Bonus />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/jornada" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <AlertaJornada />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/banco-horas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <BancoHoras />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/horarios" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Horarios />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/prevencao-ia" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <PrevencaoTrabalhistaIA />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/produtividade-ia" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <ProdutividadeIA />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/ferias" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Ferias />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/ponto" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <PontoEletronico />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/atestados" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <AtestadosFaltas />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/avaliacao" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <AvaliacaoDesempenho />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/onboarding" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <OnboardingOffboarding />
                    </ProtectedRoute>
                  } />
                  <Route path="/rh/dashboard" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <DashboardRH />
                    </ProtectedRoute>
                  } />
                  
                  {/* Fiscal */}
                  <Route path="/fiscal" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro", "operacional"]}>
                      <DashboardFiscal />
                    </ProtectedRoute>
                  } />
                  <Route path="/fiscal/nfe" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <EmitirNFe />
                    </ProtectedRoute>
                  } />
                  <Route path="/fiscal/nfce" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <EmitirNFCe />
                    </ProtectedRoute>
                  } />
                  <Route path="/fiscal/mdfe" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <EmitirMDFe />
                    </ProtectedRoute>
                  } />
                  <Route path="/fiscal/cte" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <EmitirCTe />
                    </ProtectedRoute>
                  } />
                  <Route path="/fiscal/xml" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <GerarXML />
                    </ProtectedRoute>
                  } />
                  <Route path="/fiscal/relatorios" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <RelatoriosNotas />
                    </ProtectedRoute>
                  } />

                  {/* Configurações - Admin */}
                  <Route path="/config/empresa" element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <MinhaEmpresa />
                    </ProtectedRoute>
                  } />
                  <Route path="/config/auditoria" element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <Auditoria />
                    </ProtectedRoute>
                  } />
                  <Route path="/config/permissoes" element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <Permissoes />
                    </ProtectedRoute>
                  } />
                  <Route path="/config/unidades" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <UnidadesConfig />
                    </ProtectedRoute>
                  } />
                  <Route path="/config/usuarios" element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <Usuarios />
                    </ProtectedRoute>
                  } />
                  <Route path="/configuracoes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Configuracoes />
                    </ProtectedRoute>
                  } />
                  <Route path="/config/documentos" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <DocumentosEmpresa />
                    </ProtectedRoute>
                  } />
                  <Route path="/config/notificacoes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Notificacoes />
                    </ProtectedRoute>
                  } />
                  <Route path="/config/integracoes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <Integracoes />
                    </ProtectedRoute>
                  } />
                  <Route path="/config/personalizacao" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <PersonalizacaoVisual />
                    </ProtectedRoute>
                  } />

                  <Route path="/assistente-ia" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <AssistenteIA />
                    </ProtectedRoute>
                  } />
                  
                  {/* Gestão de Rotas e Escalas */}
                  <Route path="/operacional/rotas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <GestaoRotas />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/escalas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <GestaoEscalas />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/ponto-equilibrio" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <PontoEquilibrio />
                    </ProtectedRoute>
                  } />
                  <Route path="/operacional/resultado" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <ResultadoOperacional />
                    </ProtectedRoute>
                  } />
                  <Route path="/config/categorias-despesa" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <CategoriasDespesa />
                    </ProtectedRoute>
                  } />
                  
                  {/* App Entregador */}
                  <Route path="/entregador" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/jornada" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorIniciarJornada />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/entregas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorEntregas />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/entregas/:id/finalizar" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <FinalizarEntrega />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/nova-venda" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorNovaVenda />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/despesas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorDespesas />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/combustivel" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorCombustivel />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/historico" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorHistorico />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/perfil" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorPerfil />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/configuracoes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorConfiguracoes />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/estoque" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorEstoque />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/transferencia" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorTransferencia />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/conquistas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorConquistas />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/produtividade" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorProdutividade />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/financeiro" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorFinanceiro />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/vendas" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorVendas />
                    </ProtectedRoute>
                  } />
                  <Route path="/entregador/treinamento" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "entregador"]}>
                      <EntregadorTreinamento />
                    </ProtectedRoute>
                  } />
                  
                  {/* Portal Parceiro */}
                  <Route path="/parceiro" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "parceiro"]}>
                      <ParceiroDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/parceiro/vender" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "parceiro"]}>
                      <ParceiroVenderVale />
                    </ProtectedRoute>
                  } />
                  <Route path="/parceiro/vales" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "parceiro"]}>
                      <ParceiroVales />
                    </ProtectedRoute>
                  } />
                  <Route path="/parceiro/qrcode" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "parceiro"]}>
                      <ParceiroQRCode />
                    </ProtectedRoute>
                  } />
                  
                  {/* Página pública - Vale Gás via QR Code */}
                  <Route path="/vale-gas/comprar/:parceiroId" element={<ComprarValeGas />} />
                  
                  {/* App Cliente - Público (sem autenticação) */}
                  <Route path="/cliente" element={<ClienteHome />} />
                  <Route path="/cliente/cadastro" element={<ClienteCadastro />} />
                  <Route path="/cliente/carrinho" element={<ClienteCarrinho />} />
                  <Route path="/cliente/checkout" element={<ClienteCheckout />} />
                  <Route path="/cliente/indicacao" element={<ClienteIndicacao />} />
                  <Route path="/cliente/carteira" element={<ClienteCarteira />} />
                  <Route path="/cliente/vale-gas" element={<ClienteValeGas />} />
                  <Route path="/cliente/historico" element={<ClienteHistorico />} />
                  <Route path="/cliente/dicas" element={<ClienteDicas />} />
                  <Route path="/cliente/consumo" element={<ClienteConsumo />} />
                  <Route path="/cliente/perfil" element={<ClientePerfil />} />
                  <Route path="/cliente/rastreamento/:orderId" element={<ClienteRastreamento />} />
                  <Route path="/cliente/enderecos" element={<ClienteEnderecos />} />
                  <Route path="/cliente/notificacoes" element={<ClienteNotificacoes />} />
                  <Route path="/cliente/assinaturas" element={<ClienteAssinaturas />} />
                  <Route path="/cliente/privacidade" element={<ClienteNotificacoes />} />
                  <Route path="/cliente/ajuda" element={<ClienteNotificacoes />} />
                  <Route path="/cliente/termos" element={<ClienteNotificacoes />} />
                  
                  {/* Atendimento */}
                  <Route path="/atendimento" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <CentralAtendimento />
                    </ProtectedRoute>
                  } />
                  <Route path="/atendimento/bina" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <AppBina />
                    </ProtectedRoute>
                  } />

                  {/* Devoluções */}
                  <Route path="/vendas/devolucoes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <Devolucoes />
                    </ProtectedRoute>
                  } />

                  {/* Contratos Recorrentes */}
                  <Route path="/clientes/contratos" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <ContratosRecorrentes />
                    </ProtectedRoute>
                  } />

                  {/* Programa de Indicação */}
                  <Route path="/clientes/indicacao" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "operacional"]}>
                      <ProgramaIndicacao />
                    </ProtectedRoute>
                  } />

                  {/* Gamificação Entregadores */}
                  <Route path="/operacional/gamificacao-entregadores" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <GamificacaoEntregadores />
                    </ProtectedRoute>
                  } />

                  {/* Licitações */}
                  <Route path="/operacional/licitacoes" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor", "financeiro"]}>
                      <Licitacoes />
                    </ProtectedRoute>
                  } />

                  {/* Relatório Gerencial */}
                  <Route path="/operacional/gerencial" element={
                    <ProtectedRoute allowedRoles={["admin", "gestor"]}>
                      <RelatorioGerencial />
                    </ProtectedRoute>
                  } />
                  
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </Suspense>
                </ErrorBoundary>
              </ValeGasProvider>
            </ClienteProvider>
          </DeliveryNotificationProvider>
        </UnidadeProvider>
          </EmpresaProvider>
      </AuthProvider>
    </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
