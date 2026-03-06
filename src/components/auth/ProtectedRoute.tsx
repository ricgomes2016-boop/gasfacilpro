import { ReactNode } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { detectSubdomainApp, getSubdomainDefaultRoute } from "@/lib/subdomain";
import { Loader2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
  requireAuth?: boolean;
}

// Admin/staff roles that can access the main system
const STAFF_ROLES: AppRole[] = ["admin", "gestor", "financeiro", "operacional"];

export function ProtectedRoute({ 
  children, 
  allowedRoles, 
  requireAuth = true 
}: ProtectedRouteProps) {
  const { user, roles, loading } = useAuth();
  const { needsOnboarding, loading: empresaLoading } = useEmpresa();
  const location = useLocation();

  if (loading || empresaLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // If auth is required and user is not logged in
  if (requireAuth && !user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  // Redirect to onboarding if admin has no empresa (skip for super_admin and painel subdomain)
  const subdomainApp = detectSubdomainApp();
  if (user && needsOnboarding && roles.includes("admin") && !roles.includes("super_admin") && location.pathname !== "/onboarding") {
    // On painel or erp subdomain with super_admin context, skip onboarding
    if (subdomainApp === "painel") {
      // Don't redirect — super admin panel
    } else {
      return <Navigate to="/onboarding" replace />;
    }
  }

  // Redirect non-staff users to their proper app
  // Only check on routes without specific allowedRoles (i.e., the root admin area)
  if (user && !allowedRoles) {
    // Redirect super_admin to their panel only on painel subdomain or dev
    if (roles.includes("super_admin") && (!subdomainApp || subdomainApp === "painel")) {
      return <Navigate to="/admin" replace />;
    }
    const isStaff = STAFF_ROLES.some(r => roles.includes(r));
    if (!isStaff) {
      // Redirect to their specific app
      if (roles.includes("cliente")) return <Navigate to="/cliente" replace />;
      if (roles.includes("entregador")) return <Navigate to="/entregador" replace />;
      if (roles.includes("parceiro")) return <Navigate to="/parceiro" replace />;
      if (roles.includes("contador")) return <Navigate to="/financeiro/contador" replace />;
      // If roles not yet loaded, wait
      if (roles.length === 0) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        );
      }
    }
  }

  // If specific roles are required
  if (allowedRoles && allowedRoles.length > 0) {
    // Wait for roles to load before denying access — prevents redirect loops
    if (user && roles.length === 0) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    const hasAccess = allowedRoles.some((role) => roles.includes(role));
    
    if (!hasAccess) {
      // Redirect to their proper app instead of showing "access denied" in admin
      if (roles.includes("cliente")) return <Navigate to="/cliente" replace />;
      if (roles.includes("entregador")) return <Navigate to="/entregador" replace />;
      if (roles.includes("parceiro")) return <Navigate to="/parceiro" replace />;
      if (roles.includes("contador")) return <Navigate to="/financeiro/contador" replace />;

      // On restricted subdomains, redirect to auth instead of showing access denied with broken links
      if (subdomainApp && subdomainApp !== "landing") {
        return <Navigate to="/auth" replace />;
      }

      return (
        <MainLayout>
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-foreground">Acesso Negado</h1>
              <p className="text-muted-foreground">
                Você não tem permissão para acessar esta página.
              </p>
              <p className="text-sm text-muted-foreground">
                Roles necessárias: {allowedRoles.join(", ")}
              </p>
              <Button asChild variant="outline">
                <Link to="/dashboard">Voltar ao Dashboard</Link>
              </Button>
            </div>
          </div>
        </MainLayout>
      );
    }
  }

  return <>{children}</>;
}
