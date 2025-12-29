"""
FastAPI entrypoint for ShortPulse backend APIs.
Owns HTTP routing, application lifecycle hooks, and DB session wiring.
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session

from .auth import AuthenticatedUser, require_user
from .config import settings
from .db import get_session
from .ingestion import run_ingestion
from .metrics import attach_percentiles, compute_derived_metrics
from .models import ReelLatestState, ReelRawEvent
from .schemas import IngestResult, IngestStatus, ReelPerformanceList
from .scheduler import ingestion_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ShortPulse", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Start recurring ingestion scheduler on app boot."""
    ingestion_scheduler.start()


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanly shutdown the ingestion scheduler."""
    ingestion_scheduler.shutdown()


@app.get("/health")
async def health():
    """Return a simple health payload for uptime checks."""
    return {"status": "ok", "environment": settings.environment}


@app.post("/ingest/run", response_model=IngestResult)
async def ingest_now(
    current_user: AuthenticatedUser = Depends(require_user),
    session: Session = Depends(get_session),
):
    """Manually trigger an ingestion run using the provided DB session and user context."""
    try:
        result = run_ingestion(session, current_user.user_id)
        return result
    except Exception as exc:
        logger.exception("Manual ingestion failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/reels/performance", response_model=ReelPerformanceList)
async def reels_performance(
    current_user: AuthenticatedUser = Depends(require_user),
    session: Session = Depends(get_session),
):
    """Return 7d reel performance scoped to the authenticated user with derived metrics and percentiles."""
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    states = (
        session.query(ReelLatestState)
        .filter(ReelLatestState.user_id == current_user.user_id)
        .filter(ReelLatestState.publish_time >= seven_days_ago)
        .all()
    )
    derived = compute_derived_metrics(states, now)
    enriched = attach_percentiles(derived)
    return {"items": enriched}


@app.get("/ingest/status", response_model=IngestStatus)
async def ingest_status(
    current_user: AuthenticatedUser = Depends(require_user),
    session: Session = Depends(get_session),
):
    """Summarize ingestion health and totals for operational monitoring scoped to the current user."""
    user_filter = ReelRawEvent.user_id == current_user.user_id
    last_scraped_at = session.query(func.max(ReelRawEvent.scraped_at)).filter(user_filter).scalar()

    last_apify_run_id = None
    events_last_run = 0
    if last_scraped_at:
        latest_run = (
            session.query(ReelRawEvent.apify_run_id, func.count(ReelRawEvent.id))
            .filter(ReelRawEvent.user_id == current_user.user_id)
            .filter(ReelRawEvent.scraped_at == last_scraped_at)
            .group_by(ReelRawEvent.apify_run_id)
            .order_by(func.count(ReelRawEvent.id).desc())
            .first()
        )
        if latest_run:
            last_apify_run_id, events_last_run = latest_run

    total_raw_events = session.query(func.count(ReelRawEvent.id)).filter(user_filter).scalar() or 0
    latest_state_count = (
        session.query(func.count(ReelLatestState.reel_id))
        .filter(ReelLatestState.user_id == current_user.user_id)
        .scalar()
        or 0
    )

    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    reels_published_last_7d = (
        session.query(func.count(ReelLatestState.reel_id))
        .filter(ReelLatestState.user_id == current_user.user_id)
        .filter(ReelLatestState.publish_time >= seven_days_ago)
        .scalar()
        or 0
    )

    return {
        "last_scraped_at": last_scraped_at,
        "last_apify_run_id": last_apify_run_id,
        "events_last_run": events_last_run,
        "total_raw_events": total_raw_events,
        "latest_state_count": latest_state_count,
        "reels_published_last_7d": reels_published_last_7d,
    }
