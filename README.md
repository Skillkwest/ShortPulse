# ShortPulse v1

Performance-first short-form analytics stack. Ingest via Apify every 6 hours, store immutable raw events in Supabase/Postgres, derive percentiles for the last 7 days, and explore via a simplified dashboard (Performance Analytics, Creator Studio placeholder, Media Library placeholder) with a dark-mode scatter plot.

## Tech
- Backend: FastAPI, SQLAlchemy, Alembic, APScheduler, PostgreSQL (Supabase)
- Frontend: Next.js + Recharts
- Ingestion: Apify actor API

## Setup
1) Duplicate `.env.example` to `.env` and fill in:
   - `DATABASE_URL`: Supabase Postgres connection string (service role). For this project: `postgresql+psycopg://postgres:<service-role-password>@db.jwmcytzyhcvacjwqtynn.supabase.co:5432/postgres`
   - `APIFY_API_TOKEN`, `APIFY_ACTOR_ID`: credentials + actor for Instagram recommended Reels feed.
   - `SUPABASE_JWT_SECRET`: Supabase JWT secret used to validate access tokens (Settings → API in Supabase).
   - `SUPABASE_JWT_AUDIENCE`: Defaults to `authenticated`; override only if you changed the Supabase JWT audience.
   - `INGESTION_USER_ID`: Supabase `auth.users.id` the scheduler should ingest on behalf of; required to prevent unscoped data.
   - Frontend env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_BASE` if not running on localhost.
2) Backend dependencies:
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   ```
3) Apply migrations to Supabase:
   ```bash
   alembic upgrade head
   ```
   (Alternatively run the SQL in `sql/create_reels_tables.sql` in the Supabase SQL editor.)
   - To secure media storage, also run `sql/storage_policies.sql` (creates a private `media` bucket with per-user folder RLS).
4) Run API:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
5) Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The app reads `NEXT_PUBLIC_API_BASE` from `.env` (defaults to `http://localhost:8000`).

## Key Endpoints
- `GET /health` – service status (no auth)
- `POST /ingest/run` – trigger an Apify ingestion and persist results (requires `Authorization: Bearer <supabase access token>`)
- `GET /reels/performance` – latest 7-day cohort with derived metrics, percentiles, and performance score (requires auth)
- `GET /ingest/status` – last ingestion timestamps/counts and 7d freshness summary (requires auth)

## Background Ingestion
- APScheduler runs the Apify pull every `INGESTION_INTERVAL_HOURS` (default 6h) when credentials are present.
- Raw events are appended; `reels_latest_state` is upserted on each run.
- Scheduler now requires `INGESTION_USER_ID` so every run is scoped to a specific Supabase user.

## Tests
- Basic metric/percentile test: `cd backend && pytest -q`

## Data Model
- `reels_raw_events`: immutable observations (required + optional fields per spec). Includes `user_id` for tenant isolation.
- `reels_latest_state`: rebuildable convenience snapshot for percentile calculations (composite PK of `user_id` + `reel_id`).

## Security & Auth
- FastAPI endpoints (except `/health`) require a Supabase access token via `Authorization: Bearer <token>`; tokens are validated with `SUPABASE_JWT_SECRET`, and `user_id` is pulled from token claims.
- All queries scope by `user_id`; ingestion attaches the caller’s user id (or `INGESTION_USER_ID` for scheduled runs).
- Row Level Security is enabled on `reels_raw_events`, `reels_latest_state`, and `saved_creators` with `user_id = auth.uid()` policies to prevent cross-user access.
- `ingestion_runs` is RLS-locked to `service_role` only; end-users cannot read/write it.
- Frontend routes `/dashboard`, `/performance`, `/saved-creators`, `/media-library`, and `/creator-studio` redirect unauthenticated visitors to `/auth`.
- Use `frontend/lib/apiClient.ts` to automatically send the Supabase JWT with backend requests.
- Media storage: private `media` bucket; each object path must start with `<auth.uid()>/...`, enforced by `sql/storage_policies.sql`.

## Derived Metrics
- hours_since_publish, views_per_hour, engagement_rate
- Percentiles scoped to reels published in the last 7 days
- performance_score = 0.45*engagement_rate_pct + 0.40*views_per_hour_pct + 0.15*views_pct

## Frontend surfaces
- **Dashboard (`/`)**: Three primary cards—Performance Analytics, Creator Studio (coming soon), Media Library (secure, per-user). Quick stats on time ranges (7/30/90d), signals (views/hr, engagement), channels (IG/TikTok/YT), and security.
- **Performance Analytics (`/performance`)**: Time-window selector (7d/30d/90d), manual refresh + sample dataset, previews with dummy thumbnails, outlier list, and scatter visualization.
- **Creator Studio (`/creator-studio`)**: Coming-soon placeholder hero with roadmap hints.
- **Media Library (`/media-library`)**: Placeholder hero describing per-user isolation for media/exports; hook to Supabase auth/storage with RLS.
- Scatter plot (Recharts):
  - X: views_per_hour_percentile
  - Y: engagement_rate_percentile
  - Size: views
  - Tooltip: URL + raw metrics + badges
  - Highlight: performance_score >= 95; shaded breakout quadrant
