-- =====================================================================
-- Prospect On — assinaturas e medição de uso
-- Rode este SQL no Supabase (SQL Editor > New query > Run)
-- =====================================================================

create table if not exists public.subscriptions (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  plan                     text not null default 'trial'
                           check (plan in ('trial','essencial','pro','agencia')),
  status                   text not null default 'active'
                           check (status in ('active','past_due','canceled')),
  searches_used            int not null default 0,
  period_start             date not null default current_date,
  current_period_end       date,
  provider                 text,   -- 'abacatepay'
  provider_customer_id     text,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

drop policy if exists "subs_select_own" on public.subscriptions;
drop policy if exists "subs_insert_own" on public.subscriptions;
drop policy if exists "subs_update_own" on public.subscriptions;

-- O usuário SÓ LÊ a própria assinatura. Nenhuma escrita pelo cliente.
-- Contagem de uso e mudança de plano são feitas no servidor com a
-- chave secreta (service_role), que ignora o RLS. Assim o usuário não
-- consegue se auto-promover de plano nem zerar o contador de buscas.
create policy "subs_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
