# Backend Architecture

Purpose: map the FastAPI service structure after refactors and clarify where to add functionality.

## Modules
- `app/main.py`: FastAPI app creation, middleware, lifecycle hooks, and route wiring.
- `app/ingestion.py`: Apify fetch, mapping, and persistence to raw events + latest state.
- `app/metrics.py`: Derived metrics and percentile calculations for performance endpoints.
- `app/scheduler.py`: APScheduler wrapper to run ingestion on intervals.
- `app/worker.py`: Standalone runner for the scheduler.
- `app/rebuild_latest_state.py`: Utility to rebuild latest snapshots from raw events.
- `app/models.py`: SQLAlchemy models for raw events and latest state.
- `app/schemas.py`: Pydantic models for request/response contracts.
- `app/config.py`: Env-driven settings via Pydantic.
- `app/db.py`: Engine/session wiring and FastAPI session dependency.

## Behaviors
- Manual ingestion: `POST /ingest/run` -> `ingestion.run_ingestion`.
- Scheduled ingestion: `IngestionScheduler` starts on startup when Apify env vars are present.
- Performance API: `GET /reels/performance` pulls latest 7d state, enriches with derived metrics + percentiles.
- Status API: `GET /ingest/status` reports last scrape run, totals, and recent publish counts.

## Adding endpoints or jobs
- Define schema(s) in `schemas.py` first.
- Add pure logic to a dedicated module; keep `main.py` focused on routing.
- Wire DB access via `Depends(get_session)` from `db.py`.
- Add inline docstrings for new public functions/classes and update related docs/checklists when adding domains.
