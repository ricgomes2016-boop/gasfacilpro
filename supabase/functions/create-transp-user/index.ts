import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Create user
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email: "ric@transfacil.com",
    password: "893645",
    email_confirm: true,
    user_metadata: { full_name: "Ric TransFácil" },
  });

  if (userError) {
    return new Response(JSON.stringify({ error: userError.message }), { status: 400 });
  }

  const userId = userData.user.id;

  // Assign transportadora role
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: userId, role: "transportadora" });

  // Update profile
  await supabaseAdmin
    .from("profiles")
    .update({ full_name: "Ric TransFácil" })
    .eq("user_id", userId);

  return new Response(JSON.stringify({ 
    success: true, 
    user_id: userId,
    roleError: roleError?.message 
  }));
});
