-- =====================================================================
-- Prospect On — libera o plano "starter" na coluna plan
-- (o CHECK original só aceitava trial/essencial/pro/agencia).
-- Rode no Supabase: SQL Editor > New query > Run.
-- =====================================================================

alter table public.prospect_subscriptions
  drop constraint if exists prospect_subscriptions_plan_check;

alter table public.prospect_subscriptions
  add constraint prospect_subscriptions_plan_check
  check (plan in ('trial', 'starter', 'essencial', 'pro', 'agencia'));
