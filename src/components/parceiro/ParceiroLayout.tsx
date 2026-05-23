import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  ShoppingCart,
  List,
  LogOut,
  Menu,
  Flame,
  QrCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { SystemFooter } from "@/components/layout/SystemFooter";

interface ParceiroLayoutProps {
  children: ReactNode;
  title?: string;
}

const menuItems = [
  { path: "/parceiro", icon: Home, label: "Início" },
  { path: "/parceiro/vender", icon: ShoppingCart, label: "Vender Vale" },
  { path: "/parceiro/vales", icon: List, label: "Meus Vales" },
  { path: "/parceiro/qrcode", icon: QrCode, label: "Meu QR Code" },
];

export function ParceiroLayout({ children, title }: ParceiroLayoutProps) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0 border-none">
                <div className="bg-card h-full flex flex-col">
                  <div className="flex items-center gap-3 p-6 border-b">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Flame className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-bold text-foreground text-lg">Portal Parceiro</h2>
                      <p className="text-sm text-muted-foreground">{profile?.full_name}</p>
                    </div>
                  </div>
                  <nav className="p-4 space-y-2 flex-1">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-lg transition-all",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-muted"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="p-4 border-t">
                    <Button variant="ghost" className="w-full justify-start gap-3 text-destructive" onClick={signOut}>
                      <LogOut className="h-5 w-5" />
                      Sair
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <Flame className="h-6 w-6" />
              <span className="font-bold text-lg">{title || "Portal Parceiro"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
        <div className="flex justify-around items-center py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[60px]",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "scale-110")} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
