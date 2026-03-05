import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPlanByProductId, getPlanKey, PlanConfig } from "@/config/stripePlans";

export interface Empresa {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  logo_url: string | null;
  plano: string;
  plano_max_unidades: number;
  plano_max_usuarios: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionInfo {
  subscribed: boolean;
  productId: string | null;
  planKey: string | null;
  plan: PlanConfig | null;
  subscriptionEnd: string | null;
  unitQuantity: number;
}

interface EmpresaContextType {
  empresa: Empresa | null;
  loading: boolean;
  needsOnboarding: boolean;
  subscription: SubscriptionInfo;
  subscriptionLoading: boolean;
  refetch: () => Promise<void>;
  checkSubscription: () => Promise<void>;
}

const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

const defaultSubscription: SubscriptionInfo = {
  subscribed: false,
  productId: null,
  planKey: null,
  plan: null,
  subscriptionEnd: null,
  unitQuantity: 0,
};

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(defaultSubscription);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const { user, roles, loading: authLoading } = useAuth();

  const isStaff = roles.some(r => ["admin", "gestor", "financeiro", "operacional"].includes(r));

  const checkSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(defaultSubscription);
      return;
    }

    setSubscriptionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) {
        console.error("Error checking subscription:", error);
        return;
      }

      if (data) {
        const productId = data.product_id || null;
        const plan = productId ? getPlanByProductId(productId) : null;
        const planKey = productId ? getPlanKey(productId) : null;
        const unitQuantity = data.unit_quantity || 0;

        setSubscription({
          subscribed: data.subscribed,
          productId,
          planKey,
          plan,
          subscriptionEnd: data.subscription_end || null,
          unitQuantity,
        });

        // Sync plan to empresa if changed
        if (empresa && planKey && plan) {
          const maxUnidades = unitQuantity;
          const maxUsuarios = plan.usersPerUnit * unitQuantity;
          if (planKey !== empresa.plano || maxUsuarios !== empresa.plano_max_usuarios || maxUnidades !== empresa.plano_max_unidades) {
            await supabase
              .from("empresas")
              .update({
                plano: planKey,
                plano_max_usuarios: maxUsuarios,
                plano_max_unidades: maxUnidades,
              })
              .eq("id", empresa.id);
          }
        }
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    } finally {
      setSubscriptionLoading(false);
    }
  }, [user, empresa]);

  const fetchEmpresa = async () => {
    if (!user) {
      setEmpresa(null);
      setNeedsOnboarding(false);
      setLoading(false);
      return;
    }

    try {
      // Fetch empresa by user's profile empresa_id (v2)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        if (isStaff && roles.includes("admin")) {
          setNeedsOnboarding(true);
        }
        setLoading(false);
        return;
      }

      if (!profile?.empresa_id) {
        // No empresa linked to profile
        if (isStaff && roles.includes("admin")) {
          setNeedsOnboarding(true);
        }
        setLoading(false);
        return;
      }

      // Now fetch the specific empresa by id
      const { data, error } = await supabase
        .from("empresas")
        .select("*")
        .eq("id", profile.empresa_id)
        .single();

      if (error) {
        console.error("Error fetching empresa:", error);
        if (isStaff && roles.includes("admin")) {
          setNeedsOnboarding(true);
        }
        setLoading(false);
        return;
      }

      if (data) {
        setEmpresa(data as Empresa);
        setNeedsOnboarding(false);
      } else if (isStaff && roles.includes("admin")) {
        setNeedsOnboarding(true);
      }
    } catch (error) {
      console.error("Error fetching empresa:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchEmpresa();
    }
  }, [user, roles, authLoading]);

  // Check subscription when user and empresa are ready
  useEffect(() => {
    if (user && !authLoading && isStaff) {
      checkSubscription();
    }
  }, [user, authLoading, roles]);

  // Auto-refresh subscription every 60 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, checkSubscription]);

  return (
    <EmpresaContext.Provider
      value={{
        empresa,
        loading,
        needsOnboarding,
        subscription,
        subscriptionLoading,
        refetch: fetchEmpresa,
        checkSubscription,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}

export function useEmpresa() {
  const context = useContext(EmpresaContext);
  if (!context) {
    throw new Error("useEmpresa must be used within EmpresaProvider");
  }
  return context;
}
