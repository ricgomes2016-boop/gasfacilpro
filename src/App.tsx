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
import { renderRoutes } from "@/routes/helpers";
import { SubdomainGuard } from "@/components/routing/SubdomainGuard";
import { detectSubdomainApp, getSubdomainDefaultRoute } from "@/lib/subdomain";

// Route configurations
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
import { clienteAppRoutes } from "@/routes/clienteAppRoutes";
import { parceiroRoutes } from "@/routes/parceiroRoutes";
import { atendimentoRoutes } from "@/routes/atendimentoRoutes";
import { integracoesRoutes } from "@/routes/integracoesRoutes";

// Eager load: Auth + Dashboard (critical path)
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";

// Lazy load one-off pages
const LandingPage = lazy(() => import("./pages/LandingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OnboardingEmpresa = lazy(() => import("./pages/onboarding/OnboardingEmpresa"));
const OnboardingSetup = lazy(() => import("./pages/onboarding/OnboardingSetup"));
const ComprarValeGas = lazy(() => import("./pages/publico/ComprarValeGas"));
const Instalar = lazy(() => import("./pages/Instalar"));
const Suporte = lazy(() => import("./pages/Suporte"));

const queryClient = new QueryClient();

/**
 * Subdomain-aware root redirect.
 * Landing page for root domain, app-specific default for subdomains.
 */
function RootRedirect() {
  const app = detectSubdomainApp();
  if (app === "landing" || app === null) {
    // Dev or root domain — show landing or redirect to dashboard
    if (app === "landing") return <LandingPage />;
    return <Navigate to="/dashboard" replace />;
  }
  const defaultRoute = getSubdomainDefaultRoute(app);
  return <Navigate to={defaultRoute} replace />;
}

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
                        <SubdomainGuard>
                        <Routes>
                          {/* Root redirect — subdomain-aware */}
                          <Route path="/" element={<RootRedirect />} />

                          {/* Public routes */}
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/instalar" element={<Instalar />} />
                          <Route path="/suporte" element={<Suporte />} />
                          <Route path="/vale-gas/comprar/:parceiroId" element={<ComprarValeGas />} />

                          {/* Onboarding */}
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

                          {/* Dashboard */}
                          <Route path="/dashboard" element={
                            <ProtectedRoute>
                              <Dashboard />
                            </ProtectedRoute>
                          } />

                          {/* Domain routes */}
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
                          {renderRoutes(clienteAppRoutes)}
                          {renderRoutes(parceiroRoutes)}
                          {renderRoutes(atendimentoRoutes)}
                          {renderRoutes(integracoesRoutes)}

                          {/* Legacy redirects */}
                          <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
                          <Route path="/cliente/dashboard" element={<Navigate to="/cliente" replace />} />
                          <Route path="/entregador/dashboard" element={<Navigate to="/entregador" replace />} />
                          <Route path="/parceiro/dashboard" element={<Navigate to="/parceiro" replace />} />
                          <Route path="/operacional/cockpit" element={<Navigate to="/operacional/ia" replace />} />

                          {/* 404 */}
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                        </SubdomainGuard>
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
