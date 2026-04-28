# TV Market Intelligence Hub

Local-first internal web app shell for an entertainment-industry intelligence dashboard.

This build includes the local app foundation, core Prisma schema, seeded development data, and dashboard database counts:

- Next.js
- TypeScript
- Tailwind
- shadcn/ui-style local components
- Prisma
- SQLite
- Sidebar navigation
- Development, Current TV, and Weekly Reports feature pages
- Local database setup

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

Create the environment file:

```bash
cp .env.example .env
```

Create the local SQLite database:

```bash
npm run db:push
```

Run Prisma migrations:

```bash
npm run db:migrate
```

Seed the database:

```bash
npm run db:seed
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
npm run db:studio
```

## Database

SQLite is configured through Prisma using:

```env
DATABASE_URL="file:./dev.db"
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

The schema is designed so the app can later migrate to Supabase/Postgres by changing the Prisma datasource provider and database URL.
