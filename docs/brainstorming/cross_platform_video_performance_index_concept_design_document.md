# Cross-Platform Video Performance Index

## Brainstorming & Design Anchor Document

---

## 1. Project Intent

The purpose of this project is to build an application that identifies and visualizes **high-performing short-form videos** across major social platforms, starting with **Instagram Reels**.

The core question the app should answer is:

> *“Which videos are truly performing well right now, and why, based on real audience response and momentum — not vanity metrics or outdated discovery signals?”*

This is not a content scraping tool, a hashtag research tool, or a creator leaderboard. It is a **performance measurement and analysis system** designed to surface meaningful signals about what the platforms themselves are amplifying.

The long-term vision is a **machine-learning-backed performance index** that enables trend detection, comparative analysis, and eventually predictive insights.

---

## 2. What “High-Performing” Means (Core Definition)

“High-performing” is defined **relatively**, not absolutely.

Key principles:
- No fixed view-count thresholds (e.g. “1M views = viral”)
- No dependence on creator follower count
- No SEO-style discovery signals (hashtags, keywords)

Instead, performance is evaluated using **percentile-based comparisons** within a defined cohort.

A video is considered high-performing if it ranks highly *relative to other videos published in the same time window on the same platform*.

This approach:
- Adapts automatically to platform scale
- Avoids bias toward large creators
- Remains valid as platforms evolve

---

## 3. Time Windows (Conceptual, Not Implementation)

Videos are evaluated independently across multiple rolling windows:

- **7 days** – breakout detection, early virality
- **30 days** – sustained performance
- **60 days** – medium-term winners
- **90 days** – longevity and decay analysis
- **6 months** – evergreen and long-tail impact

For the MVP, **only the 7-day window is in scope**.

Each window represents a distinct analytical lens. A video may be top-performing in one window and average in another.

---

## 4. Platform Strategy (v1)

### Initial Platform

- **Instagram Reels**

Reasons:
- Large volume of short-form content
- Strong algorithmic discovery
- Clear engagement and velocity signals
- High relevance to trend analysis

### One Platform First

Starting with one platform:
- Reduces complexity
- Allows validation of metrics and scoring
- Produces cleaner datasets for ML later

Other platforms (TikTok, YouTube Shorts) are explicitly deferred, not excluded.

---

## 5. Discovery Philosophy

Discovery is **platform-aligned**, not user-defined.

### Explicitly NOT used:
- Hashtags
- Keyword search
- Manual curation
- Creator lists

Rationale:
- Hashtags are declining as a discovery signal
- Keywords replicate the same problem under a new name
- Creator size introduces bias

### Core Principle

> *If the platform is pushing it, it is worth measuring.*

Discovery should sample content from algorithmically surfaced feeds (e.g. Reels feed / Explore-like surfaces), allowing Instagram’s own recommendation system to act as a pre-filter.

This aligns the system with real-world distribution mechanics.

---

## 6. Metrics & Features (Human-Readable)

### Raw Metrics (Collected)

- Views
- Likes
- Comments
- Shares or Saves (if available)
- Publish time

These are stored **unchanged** as raw data.

### Derived Metrics

Computed after ingestion:

- **Hours since publish**
- **Views per hour**
  - Measures velocity and breakout potential
- **Engagement rate**
  - (likes + comments + shares) / views
  - Measures content quality and resonance

### Normalized Metrics

For videos published within the same window:

- Engagement rate percentile
- Views per hour percentile
- Views percentile

Percentiles are calculated *per platform, per time window*.

---

## 7. Performance Score (v1 – Non-ML Baseline)

A single composite score is used to rank videos:

```
performance_score =
  0.45 × engagement_rate_percentile
+ 0.40 × views_per_hour_percentile
+ 0.15 × views_percentile
```

This scoring model:
- Prioritizes quality and velocity
- Uses scale as a secondary factor
- Serves as a baseline that ML must later outperform

This is intentionally simple and interpretable.

---

## 8. Visualization Goals (MVP)

The primary visualization is a **scatter plot**, where each video is one data point.

Suggested mapping:
- X-axis: Views per hour percentile
- Y-axis: Engagement rate percentile
- Dot size: Views
- Color: Platform (single platform for MVP)

The visualization should immediately answer:
- What content is breaking out?
- What content is high quality but slower?
- What is noise?

No dashboards, filters, or UI complexity in v1.

---

## 9. What This Project Is NOT (Scope Control)

Explicit exclusions for v1:

- Virality prediction
- Content recommendations
- Creator rankings
- Hashtag or SEO analysis
- Audio or visual feature extraction
- Monetization tools

These are future possibilities, not current goals.

---

## 10. Machine Learning Roadmap (High-Level)

Machine learning is intentionally deferred until sufficient data exists.

Planned ML use cases:

### 1. Early Performance Prediction

- Predict 7-day performance from first few hours
- Supervised learning using percentile labels

### 2. Content Clustering

- Identify recurring high-performing formats
- Unsupervised learning on engagement and velocity patterns

### 3. Trend Detection

- Detect abnormal acceleration in content patterns
- Time-series and anomaly detection methods

ML is a **multiplier**, not the foundation.

---

## 11. Discovery Surface (Validated)

**Discovery Surface (v1)**

The system samples **algorithmically recommended Instagram Reels** surfaced in the Reels feed. This represents content that Instagram’s recommendation system is actively promoting, rather than content discovered via search, hashtags, or creator lists.

Key properties of this surface:
- Platform-aligned (post-ranking output)
- Strong velocity and engagement bias
- No reliance on hashtags or keywords
- Reflects real distribution pressure

This surface is treated as the ground-truth distribution for identifying high-performing content in the MVP.

---

## 12. Ingestion Strategy (Validated)

### Data Provider
- **Apify**
- Session-based, feed-style Instagram scraping

### Ingestion Cadence
- Runs every **6 hours**
- 4 runs per day
- 28 runs across a 7-day window

This cadence captures early breakouts while balancing cost, duplication, and signal stability.

### Volume per Run
- Approximately **200 Reels per run**

Across a full 7-day window, this produces sufficient sample size for percentile-based ranking even after deduplication.

### Deduplication
- Reels are uniquely identified by **Reel ID** (or canonical Reel URL)
- Repeated scrapes update metrics rather than create new logical entities

All historical observations are retained.

---

## 13. Raw Data Model (v1)

The system uses an **event-based ingestion model**. One row represents one observation of one Reel at one point in time.

### Primary Table: `reels_raw_events`

**Purpose:** Store all raw scrape events without mutation.

Required fields:
- `id` (UUID, primary key)
- `reel_id` (string)
- `platform` (string, fixed value: `instagram`)
- `reel_url` (string)
- `scraped_at` (timestamp, UTC)
- `publish_time` (timestamp, UTC)
- `views` (integer)
- `likes` (integer)
- `comments` (integer)

Optional fields (nullable):
- `shares_or_saves` (integer)
- `caption_text` (text)
- `audio_id` (string)
- `audio_name` (string)
- `duration_seconds` (float)

Metadata fields:
- `apify_run_id` (string)
- `source_surface` (string, fixed value: `reels_feed`)

This table is the immutable source of truth for all analytics and ML.

### Convenience Table: `reels_latest_state` (Derived)

**Purpose:** Fast access to the latest known state of each Reel.

One row per Reel:
- `reel_id` (primary key)
- `platform`
- `reel_url`
- `publish_time`
- `latest_views`
- `latest_likes`
- `latest_comments`
- `latest_scraped_at`

This table can be rebuilt at any time from `reels_raw_events`.

---

## 14. Current Status Summary

Decisions locked and validated:
- One platform first: **Instagram Reels**
- One time window first: **7 days**
- Discovery surface: **algorithmically recommended Reels feed**
- No hashtags, keywords, or creator-based discovery
- Percentile-based performance definition
- Ingestion via **Apify**
- Event-based raw data storage model

The system is now fully specified at the conceptual and ingestion levels and is ready for implementation.

