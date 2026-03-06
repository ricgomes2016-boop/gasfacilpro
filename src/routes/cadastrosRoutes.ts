import { lazy } from "react";
import { RouteConfig } from "./helpers";

const Fornecedores = lazy(() => import("@/pages/cadastros/Fornecedores"));
const Veiculos = lazy(() => import("@/pages/cadastros/Veiculos"));
const Funcionarios = lazy(() => import("@/pages/cadastros/Funcionarios"));
const Produtos = lazy(() => import("@/pages/cadastros/Produtos"));

export const cadastrosRoutes: RouteConfig[] = [
  { path: "/cadastros/entregadores", component: Funcionarios, roles: ["admin", "gestor"] },
  { path: "/cadastros/fornecedores", component: Fornecedores, roles: ["admin", "gestor"] },
  { path: "/cadastros/veiculos", component: Veiculos, roles: ["admin", "gestor"] },
  { path: "/cadastros/funcionarios", component: Funcionarios, roles: ["admin", "gestor"] },
  { path: "/cadastros/produtos", component: Produtos, roles: ["admin", "gestor", "operacional"] },
];
