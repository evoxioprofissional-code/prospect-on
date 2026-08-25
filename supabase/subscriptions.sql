-- =====================================================================
-- Prospect On — assinaturas e medição de uso
-- OBS: usamos o nome prospect_subscriptions para NÃO conflitar com uma
-- tabela "subscriptions" de outro projeto no mesmo Supabase.
-- Rode este SQL no Supabase (SQL Editor > New query > Run)
-- =====================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.prospect_subscriptions (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  plan                     text not null default 'trial'
                           check (plan in ('trial','essencial','pro','agencia')),
  status                   text not null default 'active'
                           check (status in ('active','past_due','canceled')),
  searches_used            int not null default 0,
  period_start             date not null default current_date,
  current_period_end       date,
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists prospect_subscriptions_set_updated_at on public.prospect_subscriptions;
create trigger prospect_subscriptions_set_updated_at
  before update on public.prospect_subscriptions
  for each row execute function public.set_updated_at();

alter table public.prospect_subscriptions enable row level security;

drop policy if exists "psubs_select_own" on public.prospect_subscriptions;
create policy "psubs_select_own" on public.prospect_subscriptions
  for select using (auth.uid() = user_id);
