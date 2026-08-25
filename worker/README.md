# Worker de Disparo — ProspectOn (Evolution API)

Processo Node que fica **ligado 24/7** (serviço no Railway) e processa a fila
criada pelo app em `/campanhas`. É **multi-conta**: atende todas as contas do
ProspectOn ao mesmo tempo. Cada time/dono tem a **própria instância** no
Evolution (`prospect_<team_id>`) com o próprio número de WhatsApp.

Ele **não** segura a conexão do WhatsApp — quem faz isso é o **Evolution API**.
O worker, para cada conta com campanha ativa:

1. Confere no Evolution se a instância daquela conta está conectada.
2. Lê a próxima mensagem `pending` da fila no Supabase.
3. Manda para o Evolution (`POST /message/sendText/{instance}`).
4. Espera um tempo **aleatório** (regras da campanha) e repete.

Cada conta roda no seu próprio ritmo, em paralelo.

> ⚠️ **Risco de ban.** É WhatsApp não oficial (o Evolution usa Baileys por
> baixo). Cada cliente deve usar um número dedicado, começar devagar e manter
> os intervalos altos.

## Variáveis

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | sim | Chave secreta (ignora RLS) |
| `EVOLUTION_API_URL` | sim | URL do Evolution (ex.: `https://evolution-xxx.up.railway.app`) |
| `EVOLUTION_API_KEY` | sim | apikey global do Evolution |
| `WORKER_OWNER_ID` | não | Restringe a UM time (para testar). Vazio = todas as contas |
| `POLL_MS` | não | Espera quando um número está desconectado (padrão 15000) |
| `SCAN_MS` | não | Varredura por novas contas/campanhas (padrão 10000) |

## Deploy no Railway

1. No **mesmo projeto** do Evolution: **+ New → GitHub Repo → `prospect-on`**.
2. Em **Settings → Root Directory**: `worker`.
3. **Start Command**: `npm start` (padrão).
4. Em **Variables**, cole as 4 variáveis obrigatórias.
5. Deploy. Nos **Logs** deve aparecer `ProspectOn worker iniciando (multi-conta)`.

Não precisa de volume nem disco — a sessão do WhatsApp vive no Evolution.

## Rodar local (teste)

```bash
cd worker
npm install
cp .env.example .env   # preencha
npm start
```

Requer **Node 20+** (usa `fetch` nativo).
