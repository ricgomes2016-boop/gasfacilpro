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
import { WhatsAppNotificationProvider } from "@/contexts/WhatsAppNotificationContext";
import { WhatsAppFloatingChat } from "@/components/atendimento/WhatsAppFloatingChat";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/ui/page-loader";
import { renderRoutes } from "@/routes/helpers";
import { SubdomainGuard } from "@/components/routing/SubdomainGuard";
import { detectSubdomainApp, getSubdomainDefaultRoute } from "@/lib/subdomain";
import { ThemeSync } from "@/components/layout/ThemeSync";

import { adminRoutes } from "@/routes/adminRoutes";
import { vendasRoutes } from "@/routes/vendasRoutes";
import { caixaRoutes } from "@/routes/caixaRoutes";
import { operacionalRoutes } from "@/routes/operacionalRoutes";
import { clientesRoutes } from "@/routes/clientesRoutes";
import { estoqueRoutes } from "@/routes/estoqueRoutes";
import { financeiroRoutes } from "@/routes/financeiroRoutes";
import { cadastrosRoutes } from "@/routes/cadastrosRoutes";
import { frotaRoutes } from "@/routes/frotaRoutes";
import { rhRoutes } from "@/routes/rhRoutes";
import { fiscalRoutes } from "@/routes/fiscalRoutes";
import { configRoutes } from "@/routes/configRoutes";
import { entregadorRoutes } from "@/routes/entregadorRoutes";
import { vendedorRoutes } from "@/routes/vendedorRoutes";
import { clienteAppRoutes } from "@/routes/clienteAppRoutes";
import { parceiroRoutes } from "@/routes/parceiroRoutes";
import { transportadoraRoutes } from "@/routes/transportadoraRoutes";
import { atendimentoRoutes } from "@/routes/atendimentoRoutes";
import { integracoesRoutes } from "@/routes/integracoesRoutes";
import { marketingRoutes } from "@/routes/marketingRoutes";

import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import { ContadorProvider } from "@/contexts/ContadorContext";
import { PeriodoProvider } from "@/contexts/PeriodoContext";

const CentralGasCP = lazy(() => import("./pages/publico/CentralGasCP"));
const ForteGas = lazy(() => import("./pages/publico/ForteGas"));
const JapaGas = lazy(() => import("./pages/publico/JapaGas"));
const DiagnosticoFontes = lazy(() => import("./pages/DiagnosticoFontes"));
const LandingPage = lazy(() => import("./pages/LandingPage"));

const ContadorDashboard = lazy(() => import("./pages/contador/ContadorDashboard"));
const ContadorXML = lazy(() => import("./pages/contador/ContadorXML"));
const ContadorDespesas = lazy(() => import("./pages/contador/ContadorDespesas"));
const ContadorFinanceiro = lazy(() => import("./pages/contador/ContadorFinanceiro"));
const ContadorEmpresas = lazy(() => import("./pages/contador/ContadorEmpresas"));
const ContadorPlanoContas = lazy(() => import("./pages/contador/ContadorPlanoContas"));

const queryClient = new QueryClient();

function RootRedirect() {
  const app = detectSubdomainApp();
  if (app === "landing") {
    return <LandingPage />;
  }
  if (app === null) {
    return <Navigate to="/dashboard" replace />;
  }
  const defaultRoute = getSubdomainDefaultRoute(app);
  return <Navigate to={defaultRoute} replace />;
}

import { useNovoPedidoNotifier } from "@/hooks/useNovoPedidoNotifier";
import { useNativePush } from "@/hooks/useNativePush";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { useLocation } from "react-router-dom";

const PUBLIC_NOTIFIER_PREFIXES = [
  "/fortegas",
  "/centralgascp",
  "/japagas",
  "/comprar-vale-gas",
  "/cliente",
  "/instalar",
  "/auth",
  "/qrcode",
  "/reset-password",
];

function GlobalNotifiersInner() {
  useNovoPedidoNotifier();
  useNativePush();
  usePushSubscription();
  return null;
}

function GlobalNotifiers() {
  const { pathname } = useLocation();
  const isPublic = PUBLIC_NOTIFIER_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isPublic) return null;
  return <GlobalNotifiersInner />;
}


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <EmpresaProvider>
            <UnidadeProvider>
              <ThemeSync />
              <DeliveryNotificationProvider>
                <ClienteProvider>
                  <ValeGasProvider>
                    <WhatsAppNotificationProvider>
                    <Toaster />
                    <Sonner />
                    <CallerIdPopup />
                    <WhatsAppFloatingChat />
                    <GlobalNotifiers />
                    <ErrorBoundary>
                      <Suspense fallback={<PageLoader />}>
                        <SubdomainGuard>
                          <Routes>
                            <Route path="/" element={<RootRedirect />} />
                            <Route path="/auth" element={<Auth />} />
                            <Route path="/reset-password" element={<ResetPassword />} />
                            <Route path="/centralgascp" element={<CentralGasCP />} />
                            <Route path="/fortegas" element={<ForteGas />} />
                            <Route path="/japagas" element={<JapaGas />} />
                            <Route path="/diagnostico-fontes" element={<DiagnosticoFontes />} />

                            <Route path="/dashboard" element={
                              <ProtectedRoute>
                                <Dashboard />
                              </ProtectedRoute>
                            } />

                            {renderRoutes(adminRoutes)}
                            {renderRoutes(vendasRoutes)}
                            {renderRoutes(caixaRoutes)}
                            {renderRoutes(operacionalRoutes)}
                            {renderRoutes(clientesRoutes)}
                            {renderRoutes(estoqueRoutes)}
                            {renderRoutes(financeiroRoutes)}
                            {renderRoutes(cadastrosRoutes)}
                            {renderRoutes(frotaRoutes)}
                            {renderRoutes(rhRoutes)}
                            {renderRoutes(fiscalRoutes)}
                            {renderRoutes(configRoutes)}
                            {renderRoutes(entregadorRoutes)}
                            {renderRoutes(vendedorRoutes)}
                            {renderRoutes(clienteAppRoutes)}
                            {renderRoutes(parceiroRoutes)}
                            {renderRoutes(transportadoraRoutes)}
                            {renderRoutes(atendimentoRoutes)}
                            {renderRoutes(integracoesRoutes)}
                            {renderRoutes(marketingRoutes)}

                            {/* Portal do Contador (subdomínio contabil.*) */}
                            <Route path="/contador" element={
                              <ProtectedRoute allowedRoles={["contador","admin","super_admin","gestor","financeiro"]}>
                                <ContadorProvider><PeriodoProvider><ContadorDashboard /></PeriodoProvider></ContadorProvider>
                              </ProtectedRoute>
                            } />
                            <Route path="/contador/empresas" element={
                              <ProtectedRoute allowedRoles={["contador","admin","super_admin","gestor","financeiro"]}>
                                <ContadorProvider><PeriodoProvider><ContadorEmpresas /></PeriodoProvider></ContadorProvider>
                              </ProtectedRoute>
                            } />
                            <Route path="/contador/xml" element={
                              <ProtectedRoute allowedRoles={["contador","admin","super_admin","gestor","financeiro"]}>
                                <ContadorProvider><PeriodoProvider><ContadorXML /></PeriodoProvider></ContadorProvider>
                              </ProtectedRoute>
                            } />
                            <Route path="/contador/despesas" element={
                              <ProtectedRoute allowedRoles={["contador","admin","super_admin","gestor","financeiro"]}>
                                <ContadorProvider><PeriodoProvider><ContadorDespesas /></PeriodoProvider></ContadorProvider>
                              </ProtectedRoute>
                            } />
                            <Route path="/contador/financeiro" element={
                              <ProtectedRoute allowedRoles={["contador","admin","super_admin","gestor","financeiro"]}>
                                <ContadorProvider><PeriodoProvider><ContadorFinanceiro /></PeriodoProvider></ContadorProvider>
                              </ProtectedRoute>
                            } />
                            <Route path="/contador/plano-contas" element={
                              <ProtectedRoute allowedRoles={["contador","admin","super_admin","gestor","financeiro"]}>
                                <ContadorProvider><PeriodoProvider><ContadorPlanoContas /></PeriodoProvider></ContadorProvider>
                              </ProtectedRoute>
                            } />

                            <Route path="*" element={<Navigate to="/dashboard" />} />
                          </Routes>
                        </SubdomainGuard>
                      </Suspense>
                    </ErrorBoundary>
                    </WhatsAppNotificationProvider>
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
