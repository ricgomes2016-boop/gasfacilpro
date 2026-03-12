import { User, LogOut, Settings, UserCircle, Moon, Sun } from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { NotificationCenter } from "./NotificationCenter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useUnidade } from "@/contexts/UnidadeContext";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "./MobileNav";
import { UnidadeSelector } from "./UnidadeSelector";
import { useTheme } from "@/hooks/useTheme";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user, profile, roles, signOut } = useAuth();
  const { unidadeAtual } = useUnidade();
  const { empresa } = useEmpresa();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "gestor":
        return "default";
      case "financeiro":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 md:h-16 items-center justify-between border-b border-border bg-background/95 px-3 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        {/* Mobile menu */}
        <MobileNav />
        
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold text-foreground truncate">{title}</h1>
          <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">
            {empresa && <span className="font-medium">{empresa.nome}</span>}
            {subtitle && <span>{empresa ? " — " : ""}{subtitle}</span>}
            {unidadeAtual && <span className="ml-2 text-primary font-medium">• {unidadeAtual.nome}</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Unidade Selector */}
        <UnidadeSelector />

        {/* Command Palette (⌘K) */}
        <CommandPalette />

        {/* Notifications */}
        <NotificationCenter />

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          title={resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
                <User className="h-4 w-4 text-primary-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-2">
                <p className="text-sm font-medium leading-none">
                  {profile?.full_name || user?.email}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {roles.map((role) => (
                    <Badge key={role} variant={getRoleBadgeVariant(role)} className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/meu-perfil")}>
              <UserCircle className="mr-2 h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/config/auditoria")}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
