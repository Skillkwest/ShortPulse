"""
Utility script to rebuild reels_latest_state from raw events.
Intended for recovery or backfill scenarios outside the main ingestion loop.
"""
import logging

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .db import SessionLocal
from .models import ReelLatestState, ReelRawEvent

logger = logging.getLogger(__name__)


def rebuild_latest_state(session: Session) -> int:
    """
    Rebuild reels_latest_state from reels_raw_events (latest by scraped_at per reel).

    Args:
        session: Active SQLAlchemy session.
    Returns:
        Number of rows written to reels_latest_state.
    Side Effects:
        Commits updates to the database.
    """
    latest_scrape_subq = (
        session.query(
            ReelRawEvent.user_id.label("user_id"),
            ReelRawEvent.reel_id.label("reel_id"),
            func.max(ReelRawEvent.scraped_at).label("max_scraped_at"),
        )
        .group_by(ReelRawEvent.user_id, ReelRawEvent.reel_id)
        .subquery()
    )

    latest_rows = (
        session.query(ReelRawEvent)
        .join(
            latest_scrape_subq,
            (ReelRawEvent.user_id == latest_scrape_subq.c.user_id)
            & (ReelRawEvent.reel_id == latest_scrape_subq.c.reel_id)
            & (ReelRawEvent.scraped_at == latest_scrape_subq.c.max_scraped_at),
        )
        .all()
    )

    if not latest_rows:
        logger.warning("No rows found in reels_raw_events to rebuild latest state.")
        return 0

    payload = []
    for row in latest_rows:
        payload.append(
            {
                "user_id": row.user_id,
                "reel_id": row.reel_id,
                "platform": row.platform,
                "reel_url": row.reel_url,
                "publish_time": row.publish_time,
                "latest_views": row.views,
                "latest_likes": row.likes,
                "latest_comments": row.comments,
                "latest_shares_or_saves": row.shares_or_saves,
                "latest_scraped_at": row.scraped_at,
                "caption_text": row.caption_text,
                "audio_id": row.audio_id,
                "audio_name": row.audio_name,
                "duration_seconds": row.duration_seconds,
            }
        )

    insert_stmt = insert(ReelLatestState).values(payload)
    upsert_stmt = insert_stmt.on_conflict_do_update(
        index_elements=[ReelLatestState.user_id, ReelLatestState.reel_id],
        set_={
            "platform": insert_stmt.excluded.platform,
            "reel_url": insert_stmt.excluded.reel_url,
            "publish_time": insert_stmt.excluded.publish_time,
            "latest_views": insert_stmt.excluded.latest_views,
            "latest_likes": insert_stmt.excluded.latest_likes,
            "latest_comments": insert_stmt.excluded.latest_comments,
            "latest_shares_or_saves": insert_stmt.excluded.latest_shares_or_saves,
            "latest_scraped_at": insert_stmt.excluded.latest_scraped_at,
            "caption_text": insert_stmt.excluded.caption_text,
            "audio_id": insert_stmt.excluded.audio_id,
            "audio_name": insert_stmt.excluded.audio_name,
            "duration_seconds": insert_stmt.excluded.duration_seconds,
        },
    )
    session.execute(upsert_stmt)
    session.commit()
    logger.info("Rebuilt latest_state with %s rows", len(payload))
    return len(payload)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    with SessionLocal() as session:
        rebuild_latest_state(session)
