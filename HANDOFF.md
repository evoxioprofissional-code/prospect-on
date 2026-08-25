# HANDOFF — ProspectOn

Resumo de "onde paramos" para continuar o projeto em outra máquina/sessão.
**Leia este arquivo + o README + o código antes de continuar.**

> ⚠️ Este arquivo vai pro GitHub (repo público) — **nenhuma chave secreta aqui**.
> Os valores reais ficam no `.env.local` (não versionado) e nas env vars da Vercel.

---

## O que é

Web app de **prospecção para venda de sites**: descobre negócios (locais ou não),
identifica os **sem site** (leads quentes), organiza num funil e ajuda a abordar.

**Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (Auth/Postgres/RLS)
+ dnd-kit. Deploy na **Vercel** em **www.prospecton.com.br**.
Repo: https://github.com/evoxioprofissional-code/prospect-on

## Rodar localmente

```bash
npm install
# criar .env.local (ver seção "Variáveis" abaixo)
npm run dev
```

---

## O que já está pronto

- **Auth** (Supabase) com RLS por usuário/time.
- **Leads**: cadastro, busca, filtros, grid de cards responsivo; borda vermelha nos "sem site".
- **Descoberta automática** de leads:
  - **OpenStreetMap** (Nominatim + Overpass) — grátis, ilimitado.
  - **Google Places (New)** — precisa de `GOOGLE_PLACES_API_KEY`; traz telefone.
- **Funil** Kanban arrastável (dnd-kit), altura fixa, colunas com scroll interno.
- **Painel** com funil visual (SVG), sparkline, donut "sem site", ações do dia.
- **Central de Disparo** (`/disparo`): fila com templates (variáveis
  `{empresa}{nome}{cidade}{nicho}{gancho}`) + botão "Gerar com IA" (Claude) +
  envio 1-a-1 via `wa.me` (assistido), marca "Contatado" e registra interação.
- **Planos** (`/planos`): Trial / Essencial R$97 / Pro R$197 / Agência R$397.
  - Só **buscas Google** contam cota (OSM ilimitado). Cota + IA + assentos
    aplicados no servidor com `SUPABASE_SERVICE_KEY` (fail-open sem ela).
- **Pagamento** (Mercado Pago): cartão = assinatura recorrente (preapproval);
  Pix = avulso libera 30 dias (Checkout Pro). Webhook em
  `/api/webhooks/mercadopago`.
- **Equipe** (`/equipe`): multiusuário do Agência (até 3), convites por e-mail,
  dados compartilhados via `team_id` + `team_members` + função `my_team_ids()`.
- **Configurações** (`/configuracoes`): perfil, senha, **dark mode** (tokens CSS).

---

## Banco de dados (Supabase)

⚠️ **O projeto Supabase `ybxmhffnahyenhqmbzym` é COMPARTILHADO com outro app
(vicioemdark).** Já existia uma tabela `subscriptions` (schema deles). Por isso a
tabela de assinatura do ProspectOn se chama **`prospect_subscriptions`**.
**Ao criar tabelas novas, cheque conflito de nome** (prefira prefixo `prospect_`).

SQLs (em `/supabase`) — rodar no SQL Editor:
- `schema.sql` — leads, interactions (base).
- `subscriptions.sql` — `prospect_subscriptions` (planos/cota).
- `team.sql` — `team_id`, `team_members`, `my_team_ids()`, RLS por time.

## Variáveis de ambiente (nomes; valores no .env.local / Vercel)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY      # chave publishable (sb_publishable_...)
NEXT_PUBLIC_SITE_URL               # https://www.prospecton.com.br
GOOGLE_PLACES_API_KEY              # server-only
SUPABASE_SERVICE_KEY               # server-only (sb_secret_...) — cota/equipe/webhook
MERCADOPAGO_ACCESS_TOKEN           # server-only
ANTHROPIC_API_KEY                  # opcional (IA no disparo)
```

> Supabase deste projeto usa **novo formato de chave** (`sb_publishable_` /
> `sb_secret_`); as chaves JWT legadas (`eyJ...`) estão desativadas.

---

## Pendências

1. Confirmar `SUPABASE_SERVICE_KEY` nas env vars da Vercel + Redeploy (senão a
   cota não conta e o plano aparece como Trial).
2. Conta do dono `mauriciobcoura@gmail.com` já setada como **Agência vitalícia**
   direto no banco (`prospect_subscriptions`, provider `manual_vitalicio`,
   `current_period_end` 2099).
3. ~~Construir o DISPARO AUTOMÁTICO~~ ✅ **FEITO** (ver seção abaixo). Para
   ligar em produção faltam 2 passos manuais:
   - Rodar `supabase/campaigns.sql` no SQL Editor.
   - Subir a pasta `worker/` numa VPS/Railway/Render 24/7 (ver `worker/README.md`),
     com `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` e `WORKER_OWNER_ID`. Escanear o QR
     uma vez (aparece em *Campanhas → WhatsApp* no app).

---

## Disparo automático (API não oficial, robusto, com delays) — CONSTRUÍDO

**Status:** implementado. Arquivos:
- SQL: `supabase/campaigns.sql` (`prospect_campaigns`, `prospect_campaign_messages`,
  `prospect_wa_sessions`, com RLS por time).
- App: página `/campanhas` (`src/app/(app)/campanhas/page.tsx`) + API
  `src/app/api/campaigns/route.ts` (GET lista+conexão, POST cria+enfileira,
  PATCH pausar/retomar/encerrar, DELETE). Item "Campanhas" no menu (`Shell.tsx`).
  Tipos em `src/lib/campaigns.ts`.
- Worker: pasta `worker/` (Node + Baileys) — QR-login, polling da fila, jitter/
  caps/janela/pausa-em-lote, reconexão, espelha status+QR em `prospect_wa_sessions`.

**Como funciona:** o app cria a campanha resolvendo a mensagem por lead (fica pronta
na fila); o worker (um número por time, `team_id = WORKER_OWNER_ID`) lê as campanhas
`running`, respeita janela/limite diário, envia com intervalo aleatório e marca
`sent`/`failed`. Credenciais do WhatsApp só no `AUTH_DIR` do worker (nunca no banco).

### Plano original (para referência)

**Decisões já tomadas:**
- Biblioteca: **Baileys** (`@whiskeysockets/baileys`) — WebSocket, sem Chrome.
- API **não oficial** (ciente do risco de ban do número — por isso os delays).
- Worker roda em **VPS / Railway / Render (24/7)** — NÃO na Vercel (serverless
  não mantém conexão persistente).

**Arquitetura (desacoplada pela fila no Supabase):**
- **App (Vercel):** cria "campanha" — leads selecionados + mensagem + regras de
  delay → grava fila no Supabase.
- **Worker (sempre ligado):** Baileys conecta o WhatsApp (QR uma vez), lê a fila
  (com `SUPABASE_SERVICE_KEY`), dispara respeitando os delays, marca enviado/erro.

**Regras de delay (configuráveis por campanha):**
- Delay **aleatório** entre mensagens (ex.: 40–120s).
- **Limite diário** (ex.: 50/dia).
- **Janela de horário** (ex.: 9h–18h).
- **Pausa em lote** (ex.: a cada 20 envios, pausa X min).
- Parada automática em desconexão/erro/ban.

**A construir:**
- SQL: tabelas `prospect_campaigns` e `prospect_campaign_messages`
  (status pending/sent/failed, scheduled_at, delays, cap, janela).
- App: tela `/campanhas` (criar campanha a partir de leads filtrados + settings
  de delay; ver progresso).
- Worker: pasta `/worker` (Node + Baileys) com QR-login, polling da fila, envio
  com jitter/caps/janela, updates de status. README de deploy (Railway/VPS).
- Segurança: sessão do Baileys persistida (auth state) no disco/volume do worker.

**Retomar dizendo:** "continue o disparo automático do ProspectOn conforme o
HANDOFF.md" — começar pelo SQL + tela de campanha, depois o worker Baileys.
