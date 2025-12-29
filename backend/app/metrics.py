"""
Metric utilities for reel performance.
Computes derived fields and percentile scores for latest state rows.
"""
from bisect import bisect_right
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional, Sequence

from .models import ReelLatestState


@dataclass
class DerivedReelMetrics:
    reel_id: str
    platform: str
    reel_url: str
    publish_time: datetime
    latest_scraped_at: datetime
    views: int
    likes: int
    comments: int
    shares_or_saves: Optional[int]
    hours_since_publish: float
    views_per_hour: float
    engagement_rate: float


def _safe_div(num: float, denom: float) -> float:
    return num / denom if denom else 0.0


def _hours_since_publish(publish_time: datetime, now: datetime) -> float:
    delta = now - publish_time
    hours = max(delta.total_seconds() / 3600, 1 / 60)  # minimum one minute to avoid div-by-zero
    return hours


def compute_derived_metrics(states: Sequence[ReelLatestState], now: Optional[datetime] = None) -> List[DerivedReelMetrics]:
    """
    Compute derived metrics for each latest reel state.

    Args:
        states: Latest state records to enrich.
        now: Optional override for current timestamp, mainly for testing.
    Returns:
        List of DerivedReelMetrics with velocity and engagement calculations applied.
    """
    now = now or datetime.now(timezone.utc)
    derived: List[DerivedReelMetrics] = []
    for state in states:
        shares = state.latest_shares_or_saves or 0
        hours = _hours_since_publish(state.publish_time, now)
        views_per_hour = _safe_div(state.latest_views, hours)
        engagement_rate = (
            _safe_div(state.latest_likes + state.latest_comments + shares, state.latest_views) if state.latest_views else 0.0
        )
        derived.append(
            DerivedReelMetrics(
                reel_id=state.reel_id,
                platform=state.platform,
                reel_url=state.reel_url,
                publish_time=state.publish_time,
                latest_scraped_at=state.latest_scraped_at,
                views=state.latest_views,
                likes=state.latest_likes,
                comments=state.latest_comments,
                shares_or_saves=state.latest_shares_or_saves,
                hours_since_publish=hours,
                views_per_hour=views_per_hour,
                engagement_rate=engagement_rate,
            )
        )
    return derived


def _percentile_rank(values: List[float]) -> List[float]:
    """Return percentile ranks (0-100) aligned with input values."""
    if not values:
        return []
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    if n == 1:
        return [100.0 for _ in values]

    ranks = []
    for v in values:
        idx = bisect_right(sorted_vals, v) - 1  # last position of v
        percentile = (idx / (n - 1)) * 100
        ranks.append(round(percentile, 2))
    return ranks


def attach_percentiles(derived: List[DerivedReelMetrics]) -> List[dict]:
    """
    Attach percentile ranks and performance score to derived metric dictionaries.

    Args:
        derived: Derived reel metrics to score.
    Returns:
        List of dictionaries ready for API responses with percentile and performance_score fields.
    """
    if not derived:
        return []

    views_values = [d.views for d in derived]
    vph_values = [d.views_per_hour for d in derived]
    er_values = [d.engagement_rate for d in derived]

    views_percentiles = _percentile_rank(views_values)
    vph_percentiles = _percentile_rank(vph_values)
    er_percentiles = _percentile_rank(er_values)

    enriched = []
    for d, vp, vphp, erp in zip(derived, views_percentiles, vph_percentiles, er_percentiles):
        performance_score = round(0.45 * erp + 0.40 * vphp + 0.15 * vp, 2)
        enriched.append(
            {
                "reel_id": d.reel_id,
                "platform": d.platform,
                "reel_url": d.reel_url,
                "publish_time": d.publish_time,
                "latest_scraped_at": d.latest_scraped_at,
                "views": d.views,
                "likes": d.likes,
                "comments": d.comments,
                "shares_or_saves": d.shares_or_saves,
                "hours_since_publish": round(d.hours_since_publish, 2),
                "views_per_hour": round(d.views_per_hour, 2),
                "engagement_rate": round(d.engagement_rate, 4),
                "views_percentile": vp,
                "views_per_hour_percentile": vphp,
                "engagement_rate_percentile": erp,
                "performance_score": performance_score,
            }
        )
    return enriched
