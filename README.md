# Prospect On

Web app de **prospecção para venda de sites**. Encontre negócios (locais ou não),
identifique os que **não têm site** (leads quentes), organize num funil visual e
acompanhe cada contato até fechar a venda.

Feito com **Next.js 14 + TypeScript + Tailwind + Supabase**.

---

## Funcionalidades

- 🔐 **Login/cadastro** (Supabase Auth) — cada usuário vê só os próprios leads (RLS).
- 📇 **Base de leads** — nome, nicho, cidade, telefone, WhatsApp, Instagram, e-mail, site.
- 🔥 **Score automático** — negócio sem site = lead quente; site sem HTTPS = morno.
- 📊 **Painel** — KPIs, distribuição no funil, follow-ups atrasados, leads quentes.
- 🗂️ **Funil Kanban** — arraste os cards entre as 6 etapas (Novo → Fechado).
- 💬 **Botão WhatsApp** — abre a conversa com mensagem de abordagem pré-preenchida.
- 📝 **Ficha do lead** — histórico de interações (nota, ligação, WhatsApp, e-mail, reunião).

---

## Como rodar (passo a passo)

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar o banco no Supabase

1. Acesse o painel do seu projeto Supabase.
2. Vá em **SQL Editor → New query**.
3. Cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.

Isso cria as tabelas `leads` e `interactions` com as regras de segurança (RLS).

### 3. Variáveis de ambiente

O arquivo `.env.local` já vem preenchido com a URL e a **anon key**. Confira que existe:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

> ⚠️ **Nunca** coloque a `service_role` key aqui nem no código. Ela é só para uso em
> servidor confiável. Se ela já vazou em algum lugar, **rotacione** no painel do Supabase.

### 4. (Opcional) Facilitar o cadastro

Por padrão o Supabase pede confirmação de e-mail. Para testar sem isso:
**Authentication → Providers → Email → desative "Confirm email"**.

### 5. Rodar

```bash
npm run dev
```

Abra <http://localhost:3000>, crie sua conta e comece a prospectar.

---

## Estrutura

```
src/
├── app/
│   ├── login/            # tela de acesso (split editorial vermelho/branco)
│   ├── (app)/            # área logada (protegida por middleware)
│   │   ├── dashboard/    # painel com KPIs
│   │   ├── leads/        # tabela + busca + filtros
│   │   └── funil/        # kanban arrastável
│   ├── layout.tsx        # fontes + metadata
│   └── globals.css
├── components/           # Shell (sidebar), LeadModal, PageHeader
├── lib/
│   ├── supabase/         # clients (browser + server)
│   ├── useLeads.ts       # hook de dados (CRUD)
│   ├── types.ts          # tipos + heurística de "lead quente"
│   └── format.ts         # BRL, link WhatsApp, iniciais
└── middleware.ts         # protege rotas / redireciona login
```

---

## Próximas ideias (roadmap)

- Importação em massa (colar lista do Google Maps / CSV).
- Templates de mensagem editáveis por nicho.
- Verificador automático de site (HTTPS, mobile, velocidade) para gerar argumento.
- Descoberta de leads via Google Places API.
- Gerador de proposta em PDF.
