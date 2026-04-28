# TV Market Intelligence Hub

Local-first internal web app shell for an entertainment-industry intelligence dashboard, configured to use Prisma with Supabase Postgres.

This build includes the local app foundation, core Prisma schema, seeded development data, and dashboard database counts:

- Next.js
- TypeScript
- Tailwind
- shadcn/ui-style local components
- Prisma
- Supabase Postgres
- Sidebar navigation
- Development, Current TV, and Weekly Reports feature pages
- Local database setup with hosted Postgres

## Pages

- Dashboard
- Development Tracker
- Current TV Tracker
- Buyers
- Companies & Talent
- Article Review Queue
- Weekly Reports
- Sources / Ingestion Settings

## Setup

Install dependencies:

```bash
npm install
```

Create the local environment file:

```bash
cp .env.example .env.local
```

In Supabase, open:

`Connect` -> `ORM / Third Party Library` -> `Prisma`

Copy the Prisma connection strings and paste them into `.env.local`:

```env
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Replace `[YOUR-PASSWORD]` in the copied Supabase URLs.

Push the Prisma schema to Supabase Postgres:

```bash
npx prisma db push
```

Seed the database if you want sample market data:

```bash
npx prisma db seed
```

Run the app locally:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Open Prisma Studio:

```bash
npx prisma studio
```

## Database

Prisma is configured for Supabase Postgres using:

```env
DATABASE_URL=
DIRECT_URL=
```

The schema includes the core future-facing tables:

- Project
- CurrentShow
- Buyer
- Company
- Person
- Article
- Relationship
- WeeklyReport

Seed data includes:

- 15 development projects
- 10 current shows
- 8 buyers
- 10 companies
- 10 people
- 20+ relationship records

## Supabase Prisma Setup

1. Copy Prisma connection strings from Supabase `Connect` -> `ORM / Third Party Library` -> `Prisma`.
2. Paste them into `.env.local`.
3. Replace `[YOUR-PASSWORD]`.
4. Run `npx prisma db push`.
5. Run `npx prisma db seed` if seed data is desired.
