# Local Development

ShortPulse runs as a client-only Next.js app.

## Prerequisites
- Node.js 20+ recommended
- A Supabase project with:
  - Auth enabled
  - Required tables/policies (see below)

## Environment variables
1. Copy `ShortPulse/.env.example` to `ShortPulse/frontend/.env.local`
2. Set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Never commit `.env.local`.

## Run the app
From the workspace root:
```bash
cd ShortPulse/frontend
npm install
npm run dev
```

## Bootstrap Supabase (optional)
- Minimal scripts: `ShortPulse/sql/create_saved_creators_table.sql` and `ShortPulse/sql/storage_policies.sql`
- Combined schema: `ShortPulse/docs/supabase_full_schema.sql`

## Quality checks
```bash
cd ShortPulse/frontend
npm run lint
npm run build
```

