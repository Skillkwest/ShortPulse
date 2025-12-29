"""
Data ingestion pipeline for pulling reels from Apify and storing them.
Responsible for mapping external payloads into database models and keeping latest state snapshots fresh.
"""
import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import requests
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from .config import settings
from .models import ReelLatestState, ReelRawEvent

logger = logging.getLogger(__name__)


def _parse_datetime(value: Optional[object]) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if isinstance(value, str):
        for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except Exception:
            logger.debug("Unable to parse datetime: %s", value)
    return None


def _canonical_url(item: Dict[str, object]) -> Optional[str]:
    url = item.get("url") or item.get("link")
    if url:
        return url
    shortcode = item.get("shortCode") or item.get("code")
    if shortcode:
        return f"https://www.instagram.com/reel/{shortcode}/"
    return None


def _map_apify_item(
    item: Dict[str, object],
    scraped_at: datetime,
    apify_run_id: str,
    user_id: str,
) -> Optional[Dict[str, object]]:
    reel_id = item.get("id") or item.get("itemId") or item.get("shortCode")
    if not reel_id:
        return None

    reel_url = _canonical_url(item)
    if not reel_url:
        return None

    publish_time = (
        _parse_datetime(item.get("publishDate"))
        or _parse_datetime(item.get("takenAt"))
        or _parse_datetime(item.get("takenAtTimestamp"))
        or _parse_datetime(item.get("timestamp"))
    )
    if not publish_time:
        return None

    views = item.get("playsCount") or item.get("playCount") or item.get("views") or 0
    likes = item.get("likesCount") or item.get("likeCount") or item.get("likes") or 0
    comments = item.get("commentsCount") or item.get("commentCount") or item.get("comments") or 0
    shares = item.get("savesCount") or item.get("shareCount") or item.get("shares") or None

    mapped = {
        "user_id": user_id,
        "reel_id": str(reel_id),
        "platform": "instagram",
        "reel_url": reel_url,
        "scraped_at": scraped_at,
        "publish_time": publish_time,
        "views": int(views),
        "likes": int(likes),
        "comments": int(comments),
        "shares_or_saves": int(shares) if shares is not None else None,
        "caption_text": item.get("caption") or item.get("title"),
        "audio_id": item.get("musicId") or item.get("audioId"),
        "audio_name": item.get("musicTitle") or item.get("audioName"),
        "duration_seconds": item.get("duration") or item.get("videoDuration"),
        "apify_run_id": apify_run_id,
        "source_surface": "reels_feed",
    }
    return mapped


def fetch_apify_reels() -> Tuple[List[Dict[str, object]], str]:
    """
    Run the configured Apify actor and return raw items.

    Returns:
        A tuple of (items, apify_run_id) where items is a list of raw payload dictionaries.
    Side Effects:
        Makes an outbound HTTP request to Apify.
    """
    if not settings.apify_api_token or not settings.apify_actor_id:
        raise RuntimeError("Apify credentials are not configured.")

    url = f"https://api.apify.com/v2/acts/{settings.apify_actor_id}/run-sync-get-dataset-items"
    params = {"token": settings.apify_api_token, "limit": settings.apify_max_results}
    default_input = {
        "resultsLimit": settings.apify_max_results,
        "scrapeType": "RECOMMENDED",
        "maxRequestRetries": 2,
        "maxConcurrency": 10,
        "proxy": {"useApifyProxy": True},
    }

    # Allow override via APIFY_INPUT_JSON for quick iteration.
    custom_input = os.getenv("APIFY_INPUT_JSON")
    payload = json.loads(custom_input) if custom_input else default_input

    response = requests.post(url, params=params, json=payload, timeout=120)
    response.raise_for_status()
    run_id = response.headers.get("x-apify-run-id") or response.headers.get("X-Apify-Run-Id") or "unknown-run"
    items = response.json()
    logger.info("Fetched %s items from Apify run %s", len(items), run_id)
    return items, run_id


def persist_events(session: Session, items: List[Dict[str, object]], apify_run_id: str, user_id: str) -> int:
    """
    Persist raw events and update the latest state snapshot.

    Args:
        session: Database session used for inserts and updates.
        items: Raw payloads returned from Apify.
        apify_run_id: Identifier for the Apify run used for logging and dedupe.
        user_id: Supabase auth user id used for per-tenant isolation.
    Returns:
        Count of newly inserted raw events.
    Side Effects:
        Commits transactions to Postgres/Supabase and updates latest state rows.
    """
    scraped_at = datetime.now(timezone.utc)
    events: List[Dict[str, object]] = []
    for item in items:
        mapped = _map_apify_item(item, scraped_at, apify_run_id, user_id)
        if mapped:
            events.append(mapped)

    if not events:
        logger.warning("No valid events mapped from Apify run %s", apify_run_id)
        return 0

    insert_stmt = insert(ReelRawEvent).values(events)
    do_nothing_stmt = insert_stmt.on_conflict_do_nothing(constraint="uq_reel_scrape_run")
    result = session.execute(do_nothing_stmt)
    inserted = result.rowcount or 0

    latest_values = []
    for ev in events:
        latest_values.append(
            {
                "user_id": user_id,
                "reel_id": ev["reel_id"],
                "platform": ev["platform"],
                "reel_url": ev["reel_url"],
                "publish_time": ev["publish_time"],
                "latest_views": ev["views"],
                "latest_likes": ev["likes"],
                "latest_comments": ev["comments"],
                "latest_shares_or_saves": ev["shares_or_saves"],
                "latest_scraped_at": ev["scraped_at"],
                "caption_text": ev.get("caption_text"),
                "audio_id": ev.get("audio_id"),
                "audio_name": ev.get("audio_name"),
                "duration_seconds": ev.get("duration_seconds"),
            }
        )

    latest_insert = insert(ReelLatestState).values(latest_values)
    latest_upsert = latest_insert.on_conflict_do_update(
        index_elements=[ReelLatestState.user_id, ReelLatestState.reel_id],
        set_={
            "platform": latest_insert.excluded.platform,
            "reel_url": latest_insert.excluded.reel_url,
            "publish_time": latest_insert.excluded.publish_time,
            "latest_views": latest_insert.excluded.latest_views,
            "latest_likes": latest_insert.excluded.latest_likes,
            "latest_comments": latest_insert.excluded.latest_comments,
            "latest_shares_or_saves": latest_insert.excluded.latest_shares_or_saves,
            "latest_scraped_at": latest_insert.excluded.latest_scraped_at,
            "caption_text": latest_insert.excluded.caption_text,
            "audio_id": latest_insert.excluded.audio_id,
            "audio_name": latest_insert.excluded.audio_name,
            "duration_seconds": latest_insert.excluded.duration_seconds,
        },
    )
    session.execute(latest_upsert)
    session.commit()
    logger.info("Persisted %s new raw events for Apify run %s", inserted, apify_run_id)
    return inserted


def run_ingestion(session: Session, user_id: str) -> Dict[str, object]:
    """
    Fetch data from Apify and persist to Supabase/Postgres.

    Args:
        session: Active SQLAlchemy session.
        user_id: Supabase auth user id used for per-tenant isolation.
    Returns:
        Summary payload including ingested count and Apify run identifier.
    """
    items, run_id = fetch_apify_reels()
    ingested = persist_events(session, items, run_id, user_id)
    return {"ingested_count": ingested, "apify_run_id": run_id}
