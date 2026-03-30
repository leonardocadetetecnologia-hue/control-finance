# Finance Control — Leo Cadete

Sistema de controle financeiro pessoal com Next.js 14, Supabase e Vercel.

## Stack

- **Next.js 14** — App Router + TypeScript
- **Supabase** — PostgreSQL + Auth + Row Level Security
- **Tailwind CSS** — estilização
- **Vercel** — deploy automático

## Funcionalidades

- ✅ Autenticação com email/senha
- ✅ Dashboard com gráfico de fluxo e categorias
- ✅ Transações: avulso, parcelado (Nx) e mensal fixo
- ✅ Parcelas com ✓ Pagar e ↷ Adiar para próximo mês
- ✅ Calendário com eventos de pagamento/recebimento
- ✅ Integração Google Calendar (deeplink)
- ✅ Minha Renda com fontes configuráveis
- ✅ Categorias com CRUD (emoji + cor + tipo)
- ✅ Histórico com exportação CSV / JSON / Excel
- ✅ Metas financeiras com barra de progresso
- ✅ Tema dark/light com toggle
- ✅ Ocultar valores com botão olho
- ✅ RLS — cada usuário vê apenas seus dados

---

## Setup Local

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com seus dados do Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

### 3. Configurar o banco de dados no Supabase

No painel do Supabase, vá em **SQL Editor** e execute os arquivos nesta ordem:

```
supabase/migrations/001_tables.sql
supabase/migrations/002_rls.sql
supabase/migrations/003_functions.sql
```

### 4. Rodar localmente

```bash
npm run dev
```

Acesse: http://localhost:3000

---

## Deploy no Vercel

### Opção A — Via GitHub (recomendado)

1. Faça push do projeto para um repositório GitHub:
```bash
git init
git add .
git commit -m "feat: Finance Control Leo Cadete"
git remote add origin https://github.com/seu-usuario/finance-control-leo.git
git push -u origin main
```

2. Acesse [vercel.com](https://vercel.com) → **New Project** → importe o repositório

3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Clique em **Deploy** — em ~2 minutos estará no ar

### Opção B — Via CLI

```bash
npm i -g vercel
vercel
# Siga os prompts e adicione as env vars
```

---

## Estrutura de Pastas

```
finance-control/
├── app/
│   ├── (auth)/login/          ← página de login
│   ├── (dashboard)/           ← páginas protegidas
│   │   ├── page.tsx           ← dashboard
│   │   ├── transactions/
│   │   ├── calendar/
│   │   ├── income/
│   │   ├── categories/
│   │   ├── history/
│   │   ├── goals/
│   │   └── cards/
│   └── layout.tsx
├── components/
│   ├── layout/DashboardShell.tsx   ← sidebar + topbar + metrics
│   ├── transactions/
│   ├── calendar/
│   ├── categories/
│   ├── history/
│   ├── dashboard/
│   ├── income/
│   └── goals/
├── lib/
│   ├── supabase/              ← client + server
│   ├── types/                 ← TypeScript types
│   └── utils/                 ← format, gcal, export
└── supabase/migrations/       ← SQL para rodar no Supabase
```

---

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do seu projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública anon do Supabase |

Encontre esses valores em: **Supabase → Settings → API**
