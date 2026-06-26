import { VendedorLayout } from "@/components/vendedor/VendedorLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Mail, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function VendedorPerfil() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <VendedorLayout title="Meu Perfil">
      <div className="p-4 space-y-4">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <div className="h-20 w-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-10 w-10 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{profile?.full_name || "Vendedor"}</p>
              <p className="text-sm text-muted-foreground">Vendedor</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{user?.email || "—"}</span>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile.phone}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          variant="destructive"
          className="w-full h-12"
          onClick={async () => {
            await signOut();
            navigate("/auth");
          }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </VendedorLayout>
  );
}
