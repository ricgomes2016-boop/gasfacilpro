import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check allowed management roles
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["admin", "super_admin", "gestor"]);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores e gestores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = roleData.some((r: any) => r.role === "super_admin");
    const isGestor = roleData.some((r: any) => r.role === "gestor");

    const jsonError = (message: string, status = 403) =>
      new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const getUserEmpresaId = async (userId: string): Promise<string | null> => {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", userId)
        .maybeSingle();

      return data?.empresa_id ?? null;
    };

    const validateRoleAssignment = (role?: string): Response | null => {
      if (!role) return null;
      if (!isSuperAdmin && (role === "super_admin" || role === "admin")) {
        return jsonError("Permissao insuficiente para atribuir este papel");
      }
      if (isGestor && !isSuperAdmin && (role === "admin" || role === "super_admin")) {
        return jsonError("Gestor nao pode atribuir usuarios administradores");
      }
      return null;
    };

    const validateUnidadesForEmpresa = async (
      unidadeIds: unknown,
      empresaId: string | null,
    ): Promise<Response | null> => {
      if (unidadeIds === undefined) return null;
      if (!Array.isArray(unidadeIds)) {
        return jsonError("Lista de unidades invalida", 400);
      }
      if (unidadeIds.length === 0) return null;
      if (!empresaId) {
        return jsonError("Empresa obrigatoria para vincular unidades", 400);
      }

      const uniqueIds: string[] = [
        ...new Set(unidadeIds.filter((uid): uid is string => typeof uid === "string" && uid.trim().length > 0)),
      ];
      if (uniqueIds.length !== unidadeIds.length) {
        return jsonError("Lista de unidades contem valores invalidos", 400);
      }

      const { data, error } = await supabaseAdmin
        .from("unidades")
        .select("id")
        .eq("empresa_id", empresaId)
        .in("id", uniqueIds);

      if (error) throw error;
      if ((data?.length || 0) !== uniqueIds.length) {
        return jsonError("Uma ou mais unidades nao pertencem a empresa informada");
      }

      return null;
    };

    const { action, ...params } = await req.json();

    // LIST users
    if (action === "list") {
      // Determine caller's empresa_id
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("empresa_id")
        .eq("user_id", caller.id)
        .single();

      if (!isSuperAdmin && !callerProfile?.empresa_id) {
        return jsonError("Usuario administrador sem empresa vinculada", 403);
      }

      let profilesQuery = supabaseAdmin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      // Super admins see all users; regular admins see only their empresa
      if (!isSuperAdmin && callerProfile?.empresa_id) {
        profilesQuery = profilesQuery.eq("empresa_id", callerProfile.empresa_id);
      }

      const { data: profiles, error } = await profilesQuery;
      if (error) throw error;

      const userIds = profiles?.map((p: any) => p.user_id) || [];

      const [{ data: roles }, { data: userUnidades }] = await Promise.all([
        supabaseAdmin.from("user_roles").select("*").in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]),
        supabaseAdmin.from("user_unidades").select("*").in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      ]);

      const usersWithRoles = profiles?.map((p: any) => ({
        ...p,
        roles: roles?.filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role) || [],
        unidade_ids: userUnidades?.filter((uu: any) => uu.user_id === p.user_id).map((uu: any) => uu.unidade_id) || [],
      }));

      return new Response(JSON.stringify({ users: usersWithRoles }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE user
    if (action === "create") {
      const { email, password, full_name, phone, role, unidade_ids, empresa_id: targetEmpresaId } = params;

      const roleDenied = validateRoleAssignment(role);
      if (roleDenied) return roleDenied;

      if (!email || !password || !full_name || !role) {
        return new Response(JSON.stringify({ error: "Campos obrigatórios: email, password, full_name, role" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Gestor cannot create admin/super_admin users
      if (isGestor && !isSuperAdmin && (role === "admin" || role === "super_admin")) {
        return new Response(JSON.stringify({ error: "Gestor não pode criar usuários administradores" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Determine empresa_id: super_admin can specify, regular admin uses their own
      let empresaId = null;
      if (isSuperAdmin && targetEmpresaId) {
        empresaId = targetEmpresaId;
      } else {
        empresaId = await getUserEmpresaId(caller.id);
      }

      if (!isSuperAdmin && !empresaId) {
        return jsonError("Usuario administrador sem empresa vinculada", 403);
      }

      const unidadesDenied = await validateUnidadesForEmpresa(unidade_ids, empresaId);
      if (unidadesDenied) return unidadesDenied;

      // Check plan user limit
      if (empresaId) {
        const { data: empresa } = await supabaseAdmin
          .from("empresas")
          .select("plano_max_usuarios, plano")
          .eq("id", empresaId)
          .single();

        if (empresa) {
          const { count } = await supabaseAdmin
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("empresa_id", empresaId);

          if ((count || 0) >= empresa.plano_max_usuarios) {
            return new Response(JSON.stringify({
              error: `Limite de ${empresa.plano_max_usuarios} usuários atingido no plano ${empresa.plano}. Faça upgrade para adicionar mais.`
            }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      let newUser: any = null;
      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createError) {
        // If user already exists, find and reuse them
        if (createError.message?.includes("already been registered")) {
          // listUsers() can fail due to Supabase bug with NULL email_change
          // Instead, look up the user via profiles table
          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("user_id, empresa_id")
            .eq("email", email)
            .maybeSingle();
          if (existingProfile) {
            if (existingProfile.empresa_id && empresaId && existingProfile.empresa_id !== empresaId) {
              return jsonError("Usuario ja pertence a outra empresa", 409);
            }
            if (!isSuperAdmin && existingProfile.empresa_id !== empresaId) {
              return jsonError("Usuario existente nao pertence a sua empresa", 403);
            }
            newUser = { user: { id: existingProfile.user_id } };
          } else {
            throw new Error("Usuário com este email já existe mas não foi encontrado no sistema.");
          }
        } else {
          throw createError;
        }
      } else {
        newUser = createdUser;
      }

      if (newUser.user) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const profileUpdate: Record<string, any> = {};
        if (phone) profileUpdate.phone = phone;
        if (empresaId) profileUpdate.empresa_id = empresaId;

        if (Object.keys(profileUpdate).length > 0) {
          await supabaseAdmin
            .from("profiles")
            .update(profileUpdate)
            .eq("user_id", newUser.user.id);
        }

        // Delete any auto-created role and insert the correct one
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", newUser.user.id);

        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUser.user.id, role });

        // Assign unidades if provided
        if (unidade_ids && Array.isArray(unidade_ids) && unidade_ids.length > 0) {
          const unidadeRows = unidade_ids.map((uid: string) => ({
            user_id: newUser.user!.id,
            unidade_id: uid,
          }));
          await supabaseAdmin.from("user_unidades").insert(unidadeRows);
        }
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: ensure target user belongs to the same empresa as caller (unless super_admin)
    const assertSameEmpresa = async (targetUserId: string): Promise<Response | null> => {
      if (isSuperAdmin) return null;
      const checkedCallerEmpresaId = await getUserEmpresaId(caller.id);
      const checkedTargetEmpresaId = await getUserEmpresaId(targetUserId);
      if (!checkedCallerEmpresaId || !checkedTargetEmpresaId || checkedCallerEmpresaId !== checkedTargetEmpresaId) {
        return jsonError("Acesso negado: usuario nao pertence a sua empresa");
      }
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles").select("empresa_id").eq("user_id", caller.id).maybeSingle();
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles").select("empresa_id").eq("user_id", targetUserId).maybeSingle();
      if (!callerProfile?.empresa_id || !targetProfile?.empresa_id || callerProfile.empresa_id !== targetProfile.empresa_id) {
        return new Response(JSON.stringify({ error: "Acesso negado: usuário não pertence à sua empresa" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return null;
    };

    // UPDATE user (profile + role + unidades)
    if (action === "update") {
      const { user_id, full_name, phone, role, unidade_ids } = params;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const denied = await assertSameEmpresa(user_id);
      if (denied) return denied;

      // Update profile fields
      const profileUpdate: Record<string, string> = {};
      if (full_name !== undefined) profileUpdate.full_name = full_name;
      if (phone !== undefined) profileUpdate.phone = phone;

      if (Object.keys(profileUpdate).length > 0) {
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update(profileUpdate)
          .eq("user_id", user_id);
        if (profileError) throw profileError;
      }

      if (full_name !== undefined) {
        await supabaseAdmin.auth.admin.updateUserById(user_id, {
          user_metadata: { full_name },
        });
      }

      if (role) {
        const roleDenied = validateRoleAssignment(role);
        if (roleDenied) return roleDenied;

        // Prevent non-super-admin from elevating to admin/super_admin
        if (!isSuperAdmin && (role === "super_admin" || (isGestor && role === "admin"))) {
          return new Response(JSON.stringify({ error: "Permissão insuficiente para atribuir este papel" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .update({ role })
          .eq("user_id", user_id);
        if (roleError) throw roleError;
      }

      // Update unidades assignment
      if (unidade_ids !== undefined) {
        const targetEmpresaId = await getUserEmpresaId(user_id);
        const unidadesDenied = await validateUnidadesForEmpresa(unidade_ids, targetEmpresaId);
        if (unidadesDenied) return unidadesDenied;

        // Delete existing assignments
        await supabaseAdmin
          .from("user_unidades")
          .delete()
          .eq("user_id", user_id);

        // Insert new assignments
        if (unidade_ids.length > 0) {
          const unidadeRows = unidade_ids.map((uid: string) => ({
            user_id,
            unidade_id: uid,
          }));
          await supabaseAdmin.from("user_unidades").insert(unidadeRows);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // UPDATE role (kept for backward compatibility)
    if (action === "update_role") {
      const { user_id, role } = params;

      const roleDenied = validateRoleAssignment(role);
      if (roleDenied) return roleDenied;

      if (!user_id || !role) {
        return new Response(JSON.stringify({ error: "user_id e role são obrigatórios" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const denied = await assertSameEmpresa(user_id);
      if (denied) return denied;

      if (!isSuperAdmin && (role === "super_admin" || (isGestor && role === "admin"))) {
        return new Response(JSON.stringify({ error: "Permissão insuficiente para atribuir este papel" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ role })
        .eq("user_id", user_id);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE user
    if (action === "delete") {
      const { user_id } = params;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode excluir sua própria conta" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const denied = await assertSameEmpresa(user_id);
      if (denied) return denied;

      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Manage users error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Erro ao gerenciar usuário. Tente novamente." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
