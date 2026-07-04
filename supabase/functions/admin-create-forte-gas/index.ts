import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMPRESA_FORTE_GAS = "c94c210b-8dbd-4d91-914e-2db146b8cf94";
const UNIDADE_FORTE_GAS = "3a3dbca4-f9c5-4564-8f58-7ed5f6b7ed05";
const EMAIL = "admin@fortegas.com";
const PASSWORD = "123456";
const FULL_NAME = "Admin Forte Gás";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Find or create the auth user
    let userId: string | null = null;
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === EMAIL);

    if (existing) {
      userId = existing.id;
      // Reset password + confirm email in case it wasn't
      await admin.auth.admin.updateUserById(userId, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: FULL_NAME },
      });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: FULL_NAME },
      });
      if (createErr) throw createErr;
      userId = created.user!.id;
    }

    // 2) Upsert profile pointing to Forte Gás empresa
    const { error: profErr } = await admin
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          full_name: FULL_NAME,
          email: EMAIL,
          empresa_id: EMPRESA_FORTE_GAS,
        },
        { onConflict: "user_id" },
      );
    if (profErr) throw profErr;

    // 3) Ensure roles gestor + admin
    for (const role of ["gestor", "admin"] as const) {
      const { error: rErr } = await admin
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (rErr) throw rErr;
    }

    // 4) Ensure user_unidades link to Forte Gás unit
    const { error: uuErr } = await admin
      .from("user_unidades")
      .upsert(
        { user_id: userId, unidade_id: UNIDADE_FORTE_GAS },
        { onConflict: "user_id,unidade_id" },
      );
    if (uuErr) throw uuErr;

    // 5) Remove Forte Gás unit from admin@gasfacil.com
    const oldAdmin = list.users.find((u) => (u.email ?? "").toLowerCase() === "admin@gasfacil.com");
    let removedFromOld = false;
    if (oldAdmin) {
      const { error: delErr, count } = await admin
        .from("user_unidades")
        .delete({ count: "exact" })
        .eq("user_id", oldAdmin.id)
        .eq("unidade_id", UNIDADE_FORTE_GAS);
      if (delErr) throw delErr;
      removedFromOld = (count ?? 0) > 0;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        email: EMAIL,
        empresa_id: EMPRESA_FORTE_GAS,
        unidade_id: UNIDADE_FORTE_GAS,
        removed_from_gasfacil: removedFromOld,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
