# Finance Control

Sistema de controle financeiro em Next.js 14 pronto para deploy na Vercel com Neon Postgres e NextAuth.

## Stack

- Next.js 14
- NextAuth (Credentials)
- Neon Postgres
- Tailwind CSS
- Vercel

## Variáveis de ambiente

Crie `.env.local` a partir de `.env.local.example`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
AUTH_SECRET=gere-um-segredo-longo
NEXTAUTH_URL=http://localhost:3000
```

## Banco no Neon

1. Crie um projeto no Neon.
2. Copie a connection string para `DATABASE_URL`.
3. Rode o SQL de [neon/schema.sql](/D:/OneDrive%20-%20TOTAL%20ASSISTENCIA%20MEDICA%20HOSPITALAR%20LTDA/Documentos/New%20project/finance-control/neon/schema.sql) no editor SQL do Neon.

## Rodando localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Deploy na Vercel

1. Suba o projeto para GitHub.
2. Importe o repositório na Vercel.
3. Configure as variáveis:
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `NEXTAUTH_URL`
4. Faça o deploy.

Para produção, defina `NEXTAUTH_URL` com a URL final da Vercel.
