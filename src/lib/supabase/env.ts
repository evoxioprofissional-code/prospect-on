// A URL e a anon key do Supabase são sempre ASCII puro.
// Ao colar na Vercel, às vezes entram caracteres invisíveis (zero-width,
// aspas "inteligentes", quebras de linha) que fazem o fetch quebrar com
// "string contém um ponto de código que não é ISO-8859-1".
// Removemos qualquer coisa fora do ASCII imprimível — seguro para JWT/URL.
function clean(value: string | undefined): string {
  return (value ?? "").replace(/[^\x20-\x7E]/g, "").trim();
}

export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
