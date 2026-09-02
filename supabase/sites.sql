-- =====================================================================
-- Prospect On — sites de demonstração gerados por IA para o lead
-- Cada linha guarda um index.html completo, servido publicamente em
-- /site/<slug> para o vendedor mandar no WhatsApp e o cliente abrir.
-- OBS: prefixo prospect_ porque o Supabase é compartilhado com outro app.
-- Rode no Supabase (SQL Editor > New query > Run).
-- =====================================================================

create table if not exists public.prospect_sites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  team_id     uuid,
  lead_id     uuid references public.leads (id) on delete set null,
  slug        text not null unique,
  business    text not null,
  niche       text,
  city        text,
  html        text not null,
  published   boolean not null default true,
  views       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists prospect_sites_user_idx on public.prospect_sites (user_id);
create index if not exists prospect_sites_lead_idx on public.prospect_sites (lead_id);

-- reaproveita a função set_updated_at() criada em subscriptions.sql
drop trigger if exists prospect_sites_set_updated_at on public.prospect_sites;
create trigger prospect_sites_set_updated_at
  before update on public.prospect_sites
  for each row execute function public.set_updated_at();

alter table public.prospect_sites enable row level security;

-- O dono gerencia (cria/edita/apaga) os próprios sites.
drop policy if exists "psites_all_own" on public.prospect_sites;
create policy "psites_all_own" on public.prospect_sites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Leitura PÚBLICA de sites publicados: é uma página de demonstração aberta,
-- pensada para ser aberta pelo cliente pelo link. (Só conteúdo de marketing.)
drop policy if exists "psites_public_read" on public.prospect_sites;
create policy "psites_public_read" on public.prospect_sites
  for select
  using (published = true);

-- Conta uma visita na prévia (chamada pelo servidor com a chave secreta).
create or replace function public.increment_site_view(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.prospect_sites set views = views + 1 where slug = p_slug;
$$;
