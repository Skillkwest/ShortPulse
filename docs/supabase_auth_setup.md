# Supabase Auth & Client Setup (Prototype Phase)

> Temporary keys for prototyping. Rotate to new keys before production. Do not commit secrets outside this prototype branch.

## Project
- Supabase URL: `https://jwmcytzyhcvacjwqtynn.supabase.co`
- Publishable (anon) key: `sb_publishable_pN80HYeCugE5tWiCqUWL7g_UA03BeFI`
- Service role (secret) key: `sb_secret_16CMux0x6WI58OsTD1YUww_SRU_Zrzs` (use server-side only)

## Environment Variables
Create `frontend/.env.local` (not committed):
```
NEXT_PUBLIC_SUPABASE_URL=https://jwmcytzyhcvacjwqtynn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_pN80HYeCugE5tWiCqUWL7g_UA03BeFI
```

For any server-side usage (API routes / backend), create a private env file (not committed), e.g. `backend/.env`:
```
SUPABASE_SERVICE_ROLE_KEY=sb_secret_16CMux0x6WI58OsTD1YUww_SRU_Zrzs
```

## Client Initialization
Use the shared helper at `frontend/lib/supabaseClient.ts` (anon) for browser-safe calls. For server routes, use the service role key (never expose it to the client).

## Testing Connectivity Locally
1. Install deps: `npm install @supabase/supabase-js phosphor-react`
2. Ensure `.env.local` exists (values above).
3. Run the dev server: `npm run dev`
4. Example insert (adjust table/columns to match your schema):
```ts
import { supabaseClient } from "../lib/supabaseClient";

async function addCreator() {
  if (!supabaseClient) throw new Error("Supabase env missing");
  const { data, error } = await supabaseClient
    .from("creators")
    .insert([{ handle: "patternlabs", platform: "instagram", followers: 120000 }])
    .select();
  console.log({ data, error });
}
addCreator();
```

## Notes
- Keys are prototype-only; rotate before prod.
- Keep service key server-only.
- Use Supabase dashboard to inspect tables and run quick queries if needed.
