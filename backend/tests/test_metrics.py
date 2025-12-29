"""Unit tests for derived metric calculations."""
from datetime import datetime, timedelta, timezone

from app.metrics import attach_percentiles, compute_derived_metrics
from app.models import ReelLatestState


def make_state(reel_id: str, views: int, likes: int, comments: int, publish_hours_ago: int):
    """Create a minimal ReelLatestState test fixture."""
    return ReelLatestState(
        reel_id=reel_id,
        platform="instagram",
        reel_url=f"https://instagram.com/reel/{reel_id}",
        publish_time=datetime.now(timezone.utc) - timedelta(hours=publish_hours_ago),
        latest_views=views,
        latest_likes=likes,
        latest_comments=comments,
        latest_shares_or_saves=None,
        latest_scraped_at=datetime.now(timezone.utc),
    )


def test_percentile_ranks_and_score_ordering():
    """Ensure percentile outputs exist and order aligns with expected velocity/engagement."""
    states = [
        make_state("a", views=1000, likes=100, comments=20, publish_hours_ago=10),  # strong
        make_state("b", views=500, likes=20, comments=5, publish_hours_ago=20),  # weaker
        make_state("c", views=1500, likes=80, comments=10, publish_hours_ago=5),  # high views/hr
    ]
    derived = compute_derived_metrics(states)
    enriched = attach_percentiles(derived)

    # Expect all required fields present
    for item in enriched:
        assert "performance_score" in item
        assert 0 <= item["views_percentile"] <= 100

    # Higher velocity/engagement should rank above slower low-engagement
    scores = {item["reel_id"]: item["performance_score"] for item in enriched}
    assert scores["a"] > scores["b"]
    # Reel with highest views/hr should be near the top
    top_reel = max(enriched, key=lambda x: x["views_per_hour_percentile"])
    assert top_reel["reel_id"] == "c"
