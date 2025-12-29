"""
Async scheduler wrapper for recurring ingestion runs.
Keeps ingestion cadence configured without blocking the FastAPI event loop.
"""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from . import ingestion
from .config import settings
from .db import SessionLocal

logger = logging.getLogger(__name__)


class IngestionScheduler:
    """Manage lifecycle of the APScheduler instance that triggers ingestion."""

    def __init__(self):
        self.scheduler = AsyncIOScheduler(timezone="UTC")
        self.started = False

    async def _run_ingestion(self):
        """Execute a single ingestion run within an isolated session."""
        session = SessionLocal()
        try:
            if not settings.ingestion_user_id:
                logger.warning("Skipping scheduled ingestion; INGESTION_USER_ID not configured.")
                return
            result = ingestion.run_ingestion(session, settings.ingestion_user_id)
            logger.info("Scheduled ingestion complete: %s", result)
        except Exception:
            logger.exception("Scheduled ingestion failed")
        finally:
            session.close()

    def start(self):
        """Start the scheduler when credentials are present and avoid double-starts."""
        if self.started:
            return
        if not settings.apify_api_token or not settings.apify_actor_id:
            logger.warning("Apify credentials missing; skipping scheduler start.")
            return
        if not settings.ingestion_user_id:
            logger.warning("INGESTION_USER_ID not configured; scheduler disabled to avoid unscoped data.")
            return
        self.scheduler.add_job(self._run_ingestion, "interval", hours=settings.ingestion_interval_hours)
        self.scheduler.start()
        self.started = True
        logger.info("Ingestion scheduler started. Interval: %sh", settings.ingestion_interval_hours)

    def shutdown(self):
        """Stop the scheduler when the FastAPI app shuts down."""
        if self.started:
            self.scheduler.shutdown(wait=False)
            self.started = False


ingestion_scheduler = IngestionScheduler()
