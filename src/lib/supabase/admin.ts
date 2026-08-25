import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// Cliente administrativo — usa a chave SECRETA e ignora o RLS.
// SÓ pode ser importado em código de servidor (rotas /api, server actions).
// Nunca exponha SUPABASE_SERVICE_KEY no cliente.
function clean(v: string | undefined) {
  return (v ?? "").replace(/[^\x20-\x7E]/g, "").trim();
}

const SERVICE_KEY = clean(process.env.SUPABASE_SERVICE_KEY);

export function hasAdmin(): boolean {
  return !!SERVICE_KEY;
}

export function createAdminClient() {
  if (!SERVICE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_KEY ausente — configure a chave secreta do Supabase no ambiente."
    );
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
