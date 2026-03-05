import { lazy, ComponentType } from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppRole } from "@/contexts/AuthContext";

export interface RouteConfig {
  path: string;
  component: React.LazyExoticComponent<ComponentType<any>> | ComponentType<any>;
  roles?: AppRole[];
  public?: boolean;
}

export function renderRoutes(routes: RouteConfig[]) {
  return routes.map(({ path, component: Component, roles, public: isPublic }) => {
    if (isPublic) {
      return <Route key={path} path={path} element={<Component />} />;
    }

    if (roles && roles.length > 0) {
      return (
        <Route
          key={path}
          path={path}
          element={
            <ProtectedRoute allowedRoles={roles}>
              <Component />
            </ProtectedRoute>
          }
        />
      );
    }

    return (
      <Route
        key={path}
        path={path}
        element={
          <ProtectedRoute>
            <Component />
          </ProtectedRoute>
        }
      />
    );
  });
}
