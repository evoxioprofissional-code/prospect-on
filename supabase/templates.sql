-- =====================================================================
-- Prospect On — Modelos de mensagem editáveis (por time)
-- Migração ADITIVA. Rode no Supabase: SQL Editor > New query > Run.
-- =====================================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.prospect_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  team_id    uuid not null,
  name       text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospect_templates_team_idx on public.prospect_templates (team_id);

drop trigger if exists prospect_templates_set_updated_at on public.prospect_templates;
create trigger prospect_templates_set_updated_at
  before update on public.prospect_templates
  for each row execute function public.set_updated_at();

alter table public.prospect_templates enable row level security;

drop policy if exists "ptpl_select" on public.prospect_templates;
drop policy if exists "ptpl_insert" on public.prospect_templates;
drop policy if exists "ptpl_update" on public.prospect_templates;
drop policy if exists "ptpl_delete" on public.prospect_templates;

create policy "ptpl_select" on public.prospect_templates for select using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
create policy "ptpl_insert" on public.prospect_templates for insert with check (
  auth.uid() = user_id
  and (team_id = auth.uid() or team_id in (select public.my_team_ids()))
);
create policy "ptpl_update" on public.prospect_templates for update using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
) with check (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
create policy "ptpl_delete" on public.prospect_templates for delete using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
