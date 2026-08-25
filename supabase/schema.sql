-- =====================================================================
-- Prospect On — schema do banco
-- Rode este SQL no Supabase: Dashboard > SQL Editor > New query > Run
-- =====================================================================

-- Extensão para gerar UUIDs
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tabela: leads
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  niche         text,
  city          text,
  phone         text,
  whatsapp      text,
  instagram     text,
  email         text,
  website       text,
  has_website   boolean not null default false,
  status        text not null default 'novo'
                check (status in ('novo','contatado','proposta','negociando','fechado','perdido')),
  value         numeric(12,2) default 0,
  notes         text,
  next_followup date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists leads_user_id_idx on public.leads (user_id);
create index if not exists leads_status_idx  on public.leads (status);

-- ---------------------------------------------------------------------
-- Tabela: interactions (histórico de contato com o lead)
-- ---------------------------------------------------------------------
create table if not exists public.interactions (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.leads (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null default 'nota'
             check (type in ('nota','ligacao','whatsapp','email','reuniao')),
  content    text,
  created_at timestamptz not null default now()
);

create index if not exists interactions_lead_id_idx on public.interactions (lead_id);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security: cada usuário só enxerga os próprios dados
-- ---------------------------------------------------------------------
alter table public.leads        enable row level security;
alter table public.interactions enable row level security;

drop policy if exists "leads_select_own" on public.leads;
drop policy if exists "leads_insert_own" on public.leads;
drop policy if exists "leads_update_own" on public.leads;
drop policy if exists "leads_delete_own" on public.leads;

create policy "leads_select_own" on public.leads
  for select using (auth.uid() = user_id);
create policy "leads_insert_own" on public.leads
  for insert with check (auth.uid() = user_id);
create policy "leads_update_own" on public.leads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "leads_delete_own" on public.leads
  for delete using (auth.uid() = user_id);

drop policy if exists "interactions_select_own" on public.interactions;
drop policy if exists "interactions_insert_own" on public.interactions;
drop policy if exists "interactions_delete_own" on public.interactions;

create policy "interactions_select_own" on public.interactions
  for select using (auth.uid() = user_id);
create policy "interactions_insert_own" on public.interactions
  for insert with check (auth.uid() = user_id);
create policy "interactions_delete_own" on public.interactions
  for delete using (auth.uid() = user_id);
