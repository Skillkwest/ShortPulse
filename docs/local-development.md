# Local Development

ShortPulse runs as a client-only Next.js app.

## Prerequisites
- Node.js 20+ recommended
- A Supabase project with:
  - Auth enabled
  - Required tables/policies (see below)

## Environment variables
1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Never commit `.env.local`.

## Run the app
From the repo root:
```bash
cd frontend
npm install
npm run dev
```

## Bootstrap Supabase (optional)
- Minimal scripts: `sql/create_saved_creators_table.sql` and `sql/storage_policies.sql`
- Combined schema: `docs/supabase_full_schema.sql`

## Quality checks
```bash
cd frontend
npm run lint
npm run build
```
