-- =====================================================================
-- Prospect On — Disparo automático (campanhas + fila + sessão WhatsApp)
-- Migração ADITIVA. Rode no Supabase: SQL Editor > New query > Run.
-- Prefixo prospect_ para não conflitar com o app vicioemdark (mesmo banco).
-- =====================================================================

create extension if not exists "pgcrypto";

-- Reaproveita o gatilho de updated_at (idempotente).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Campanha: um "lote" de disparos com regras de delay próprias.
-- Os contadores (total/sent/failed) são denormalizados: o worker os
-- atualiza a cada envio para o app mostrar progresso sem agregação.
-- ---------------------------------------------------------------------
create table if not exists public.prospect_campaigns (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  team_id           uuid not null,
  name              text not null,
  empresa           text,
  message_template  text,                       -- guardado só para referência
  status            text not null default 'running'
                    check (status in ('running','paused','done','canceled')),

  -- Regras de segurança contra ban (configuráveis por campanha)
  min_delay_sec     int not null default 40,
  max_delay_sec     int not null default 120,
  daily_cap         int not null default 50,    -- 0 = sem limite diário
  window_start_hour int not null default 9,     -- janela de envio (hora local)
  window_end_hour   int not null default 18,
  batch_size        int not null default 20,    -- 0 = sem pausa em lote
  batch_pause_min   int not null default 15,

  -- Controle diário (o worker reseta quando a data vira)
  sent_today        int not null default 0,
  sent_today_date   date,

  -- Progresso (denormalizado)
  total             int not null default 0,
  sent              int not null default 0,
  failed            int not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists prospect_campaigns_team_idx   on public.prospect_campaigns (team_id);
create index if not exists prospect_campaigns_status_idx on public.prospect_campaigns (status);

drop trigger if exists prospect_campaigns_set_updated_at on public.prospect_campaigns;
create trigger prospect_campaigns_set_updated_at
  before update on public.prospect_campaigns
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Fila de mensagens. A mensagem já vem RESOLVIDA (texto final) para o
-- worker ficar "burro": só pega phone + body e envia.
-- ---------------------------------------------------------------------
create table if not exists public.prospect_campaign_messages (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.prospect_campaigns (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  team_id     uuid not null,
  lead_id     uuid references public.leads (id) on delete set null,
  name        text,                             -- snapshot do nome do lead
  phone       text not null,                    -- snapshot do whatsapp
  body        text not null,                    -- mensagem final (já resolvida)
  status      text not null default 'pending'
              check (status in ('pending','sent','failed','canceled')),
  error       text,
  sent_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists pcm_campaign_idx on public.prospect_campaign_messages (campaign_id);
create index if not exists pcm_queue_idx    on public.prospect_campaign_messages (campaign_id, status, created_at);

-- ---------------------------------------------------------------------
-- Sessão do WhatsApp (uma por dono/time). Espelha o estado da instância
-- no Evolution API para o app exibir e escanear o QR. A conexão real do
-- WhatsApp vive DENTRO do Evolution (na VPS), não aqui.
-- ---------------------------------------------------------------------
create table if not exists public.prospect_wa_sessions (
  owner_id      uuid primary key references auth.users (id) on delete cascade,
  instance_name text,                              -- nome da instância no Evolution
  status        text not null default 'desconectado'
                check (status in ('desconectado','conectando','conectado')),
  qr            text,                              -- data:image/png;base64,... (efêmero)
  pairing_code  text,                              -- código alternativo ao QR (opcional)
  phone         text,                              -- número conectado
  last_seen     timestamptz,                       -- heartbeat do worker
  updated_at    timestamptz not null default now()
);

drop trigger if exists prospect_wa_sessions_set_updated_at on public.prospect_wa_sessions;
create trigger prospect_wa_sessions_set_updated_at
  before update on public.prospect_wa_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security (dono + membros do time, como em leads).
-- Escrita da fila/sessão é feita pelo worker com a chave SECRETA (ignora RLS).
-- ---------------------------------------------------------------------
alter table public.prospect_campaigns         enable row level security;
alter table public.prospect_campaign_messages enable row level security;
alter table public.prospect_wa_sessions       enable row level security;

-- Campanhas: dono do time e membros ativos leem/escrevem.
drop policy if exists "pcamp_select" on public.prospect_campaigns;
drop policy if exists "pcamp_insert" on public.prospect_campaigns;
drop policy if exists "pcamp_update" on public.prospect_campaigns;
drop policy if exists "pcamp_delete" on public.prospect_campaigns;

create policy "pcamp_select" on public.prospect_campaigns for select using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
create policy "pcamp_insert" on public.prospect_campaigns for insert with check (
  auth.uid() = user_id
  and (team_id = auth.uid() or team_id in (select public.my_team_ids()))
);
create policy "pcamp_update" on public.prospect_campaigns for update using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
) with check (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
create policy "pcamp_delete" on public.prospect_campaigns for delete using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);

-- Mensagens da fila: mesma regra de time.
drop policy if exists "pcm_select" on public.prospect_campaign_messages;
drop policy if exists "pcm_insert" on public.prospect_campaign_messages;
drop policy if exists "pcm_update" on public.prospect_campaign_messages;
drop policy if exists "pcm_delete" on public.prospect_campaign_messages;

create policy "pcm_select" on public.prospect_campaign_messages for select using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
create policy "pcm_insert" on public.prospect_campaign_messages for insert with check (
  auth.uid() = user_id
  and (team_id = auth.uid() or team_id in (select public.my_team_ids()))
);
create policy "pcm_update" on public.prospect_campaign_messages for update using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
) with check (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);
create policy "pcm_delete" on public.prospect_campaign_messages for delete using (
  auth.uid() = user_id or team_id = auth.uid()
  or team_id in (select public.my_team_ids())
);

-- Sessão WhatsApp: dono e membros só LEEM (o worker escreve com a chave secreta).
drop policy if exists "pwa_select" on public.prospect_wa_sessions;
create policy "pwa_select" on public.prospect_wa_sessions for select using (
  auth.uid() = owner_id or owner_id in (select public.my_team_ids())
);
