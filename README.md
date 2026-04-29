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
ADMIN_PASSWORD=
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

## Vercel Deployment

Required environment variables in Vercel:

```env
DATABASE_URL=
DIRECT_URL=
ADMIN_PASSWORD=
NEXT_PUBLIC_APP_URL=
```

Setup steps:

1. In Supabase, open `Connect` -> `ORM / Third Party Library` -> `Prisma`.
2. Copy the pooled Prisma connection string into `DATABASE_URL`.
3. Copy the direct Prisma connection string into `DIRECT_URL`.
4. Replace `[YOUR-PASSWORD]` in both values.
5. Add a shared `ADMIN_PASSWORD` for protected ingestion and admin controls.
6. Set `NEXT_PUBLIC_APP_URL` to your Vercel production URL.
7. Redeploy the project from the Vercel dashboard after saving environment variables.

### Redeploy

- In Vercel, open the project and use `Deployments` -> `Redeploy`.
- For local verification before redeploying:

```bash
npm run build
```

### Check Logs

- Vercel: project -> `Logs`
- Supabase: project -> `Logs`
- In-app: open `/admin/status` to confirm the latest RSS, backfill, and body extraction runs

### Confirm Supabase Tables Are Connected

1. Run:

```bash
npx prisma db push
```

2. Optional seed:

```bash
npx prisma db seed
```

3. Open Prisma Studio:

```bash
npx prisma studio
```

4. In the hosted app, visit `/admin/status` and verify:
   - Database shows `Connected`
   - counts are non-zero after seeding
   - review queue and ingestion panels load without mock fallback messaging

## Shared Admin Password

The current hosted-access protection is a shared admin password, not full user auth yet.

Protected today:

- `/admin/status`
- RSS ingestion controls
- backfill queue controls
- article body fetch controls
- review queue write actions
- record-creation and linking actions from the review queue

Use `/admin/login` to unlock an admin session in the browser.

## Production QA Checklist

- Build passes
- Database connects
- Seed data is visible
- Review queue works
- Report generation works
- RSS ingestion creates `Article` records
- Body extraction works when robots rules allow it
- Backfill queue creates jobs
- No mock data appears in production unless explicitly enabled
