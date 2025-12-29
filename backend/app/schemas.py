"""
Pydantic schemas for API request/response contracts.
Keeps FastAPI endpoints type-safe and documented.
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, HttpUrl


class ReelPerformance(BaseModel):
    reel_id: str
    reel_url: HttpUrl
    platform: str
    publish_time: datetime
    latest_scraped_at: datetime
    views: int
    likes: int
    comments: int
    shares_or_saves: Optional[int] = None
    hours_since_publish: float
    views_per_hour: float
    engagement_rate: float
    views_percentile: float
    views_per_hour_percentile: float
    engagement_rate_percentile: float
    performance_score: float


class IngestResult(BaseModel):
    ingested_count: int
    apify_run_id: str


class ReelPerformanceList(BaseModel):
    items: List[ReelPerformance]


class IngestStatus(BaseModel):
    last_scraped_at: Optional[datetime]
    last_apify_run_id: Optional[str]
    events_last_run: int
    total_raw_events: int
    latest_state_count: int
    reels_published_last_7d: int
