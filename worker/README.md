# Worker de Disparo — ProspectOn (Evolution API)

Processo Node que fica **ligado 24/7** (serviço no Railway) e processa a fila
criada pelo app em `/campanhas`. Ele **não** segura a conexão do WhatsApp —
quem faz isso é o **Evolution API**. O worker só:

1. Confere no Evolution se a instância `prospect_<WORKER_OWNER_ID>` está conectada.
2. Lê a próxima mensagem `pending` da fila no Supabase.
3. Manda para o Evolution (`POST /message/sendText/{instance}`).
4. Espera um tempo **aleatório** (regras da campanha) e repete.

> ⚠️ **Risco de ban.** É WhatsApp não oficial (o Evolution usa Baileys por
> baixo). Use um número dedicado, comece devagar e mantenha os intervalos altos.

## Variáveis

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Chave secreta (ignora RLS) |
| `EVOLUTION_API_URL` | URL do seu Evolution (ex.: `https://evolution-xxx.up.railway.app`) |
| `EVOLUTION_API_KEY` | apikey global do Evolution |
| `WORKER_OWNER_ID` | User UID do dono da conta (Supabase → Authentication → Users) |
| `POLL_MS` | Intervalo de checagem da fila ociosa (padrão 15000) |

## Deploy no Railway

1. **New → Deploy from GitHub** → este repositório.
2. Em **Settings → Root Directory**: `worker`.
3. **Start Command**: `npm start` (padrão).
4. Em **Variables**, cole as 5 variáveis obrigatórias acima.
5. Deploy. Nos **Logs** deve aparecer `ProspectOn worker iniciando`.

Não precisa de volume nem de disco — a sessão do WhatsApp vive no Evolution.

## Rodar local (teste)

```bash
cd worker
npm install
cp .env.example .env   # preencha
npm start
```

Requer **Node 20+** (usa `fetch` nativo).
