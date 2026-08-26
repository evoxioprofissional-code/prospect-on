// Controle de acesso ao painel /gerenciar. SERVER-ONLY (não use NEXT_PUBLIC).
// Defina ADMIN_EMAILS no ambiente, separados por vírgula.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  if (!email || ADMIN_EMAILS.length === 0) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
