import { Link, useLocation } from "react-router-dom";
import { Home, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { menuItems } from "./menuItems";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { BuildVersionBadge } from "@/components/shared/BuildVersionBadge";
import { Badge } from "@/components/ui/badge";

interface CleanPageBannerProps {
  title: string;
  subtitle?: string;
}

export function CleanPageBanner({ title, subtitle }: CleanPageBannerProps) {
  const location = useLocation();
  const { empresa } = useEmpresa();
  const { unidadeAtual } = useUnidade();

  const crumbs = useMemo(() => {
    const path = location.pathname;
    for (const item of menuItems) {
      if (item.path === path) return [item.label];
      const sub = item.submenu?.find((s) => s.path === path);
      if (sub) return [item.label, sub.label];
    }
    return [title];
  }, [location.pathname, title]);

  return (
    <div className="clean-page-banner px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">
          {title}
        </h1>
        <BuildVersionBadge className="shrink-0" />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        {empresa?.nome && <span className="font-semibold text-foreground/80">{empresa.nome}</span>}
        {empresa?.nome && subtitle && <span className="opacity-50">|</span>}
        {subtitle && <span>{subtitle}</span>}
        {unidadeAtual?.nome && (
          <Badge variant="secondary" className="ml-1 rounded-full bg-primary/10 text-[10px] font-semibold text-primary ring-1 ring-primary/15">
            {unidadeAtual.nome}
          </Badge>
        )}
      </div>
      <nav className="mt-2 flex flex-wrap items-center gap-1 text-[12px] font-semibold text-muted-foreground">
        <Link to="/dashboard" className="flex items-center gap-1 hover:text-foreground">
          <Home className="h-3.5 w-3.5" />
          Início
        </Link>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span className={i === crumbs.length - 1 ? "text-foreground" : ""}>{c}</span>
          </span>
        ))}
      </nav>
    </div>
  );
}
