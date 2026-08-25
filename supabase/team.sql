-- =====================================================================
-- Prospect On — Equipes (multiusuário do plano Agência)
-- Migração ADITIVA: preserva o que já existe. Rode no SQL Editor.
-- =====================================================================

-- 1) Coluna team_id nas tabelas de dados (dono = próprio user_id)
alter table public.leads        add column if not exists team_id uuid;
alter table public.interactions add column if not exists team_id uuid;
update public.leads        set team_id = user_id where team_id is null;
update public.interactions set team_id = user_id where team_id is null;
create index if not exists leads_team_idx        on public.leads (team_id);
create index if not exists interactions_team_idx on public.interactions (team_id);

-- 2) Membros de equipe (team_id = id do DONO)
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references auth.users (id) on delete cascade,
  member_id  uuid references auth.users (id) on delete cascade, -- null até aceitar
  email      text not null,
  role       text not null default 'member' check (role in ('owner','member')),
  status     text not null default 'invited' check (status in ('invited','active')),
  created_at timestamptz not null default now(),
  unique (team_id, email)
);
create index if not exists team_members_member_idx on public.team_members (member_id);
create index if not exists team_members_team_idx   on public.team_members (team_id);

alter table public.team_members enable row level security;
drop policy if exists "tm_select" on public.team_members;
create policy "tm_select" on public.team_members
  for select using (auth.uid() = member_id or auth.uid() = team_id);
-- Escrita (convidar/remover/aceitar) só pelo servidor com a chave secreta.

-- 3) Função que devolve os times ativos do usuário (SECURITY DEFINER
--    para não recursar no RLS de team_members)
create or replace function public.my_team_ids()
returns setof uuid language sql security definer stable as $$
  select team_id from public.team_members
  where member_id = auth.uid() and status = 'active';
$$;
grant execute on function public.my_team_ids() to authenticated;

-- 4) RLS de leads e interactions estendida para o time
--    (dono vê pelo team_id = auth.uid(); membros pelo my_team_ids())
drop policy if exists "leads_select_own" on public.leads;
drop policy if exists "leads_insert_own" on public.leads;
drop policy if exists "leads_update_own" on public.leads;
drop policy if exists "leads_delete_own" on public.leads;
drop policy if exists "leads_select_team" on public.leads;
drop policy if exists "leads_insert_team" on public.leads;
drop policy if exists "leads_update_team" on public.leads;
drop policy if exists "leads_delete_team" on public.leads;

create policy "leads_select_team" on public.leads for select using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
create policy "leads_insert_team" on public.leads for insert with check (
  auth.uid() = user_id
  and (team_id = auth.uid() or team_id in (select public.my_team_ids()))
);
create policy "leads_update_team" on public.leads for update using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
) with check (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
create policy "leads_delete_team" on public.leads for delete using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);

drop policy if exists "interactions_select_own" on public.interactions;
drop policy if exists "interactions_insert_own" on public.interactions;
drop policy if exists "interactions_delete_own" on public.interactions;
drop policy if exists "interactions_select_team" on public.interactions;
drop policy if exists "interactions_insert_team" on public.interactions;
drop policy if exists "interactions_delete_team" on public.interactions;

create policy "interactions_select_team" on public.interactions for select using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
create policy "interactions_insert_team" on public.interactions for insert with check (
  auth.uid() = user_id
  and (team_id = auth.uid() or team_id in (select public.my_team_ids()))
);
create policy "interactions_delete_team" on public.interactions for delete using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
