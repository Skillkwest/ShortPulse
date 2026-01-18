# ShortPulse – Top Performing Videos Page

# Source of Truth (V1)

This document defines the **official product specification** for the **Top Performing Videos** page inside **ShortPulse**, the real‑time short‑form performance intelligence platform. It is intended for:

- Engineering
- UI/UX Design
- Data & Analytics
- AI Agent Context
- Product & Marketing
- Internal onboarding and documentation

This is the canonical reference. All future decisions must remain consistent with this document unless explicitly superseded.

> **Current mode:** The backend ingestion system has been removed. The page now runs entirely on a client-side demo dataset with user-triggered refresh/rescore controls. References to ingestion below describe the intended future direction when live data is reintroduced.

---

# 1. What This Page Is

The **Top Performing Videos** page is a **real-time discovery and ranking interface** that surfaces the highest‑performing short‑form videos across:

- Instagram Reels (fully implemented in v1)
- TikTok (visible but disabled)
- YouTube Shorts (visible but disabled)

It displays videos that are currently generating **exceptional momentum**, based on performance data collected from the ShortPulse ingestion system.

This page is:

- The core intelligence layer of ShortPulse
- The primary trend‑discovery surface
- A creator‑first analytics lens designed to show what is *actually* working right now

This page is **not** creator-specific in v1; it represents global trend intelligence.

---

# 2. Purpose – Why This Page Exists

Creators and entrepreneurs struggle with:

- Knowing which formats, hooks, topics, and ideas are performing well right now
- Understanding how platforms determine breakout content
- Spotting trends early instead of repeating yesterday’s ideas
- Learning from high-performing examples across platforms
- Identifying repeatable content patterns

ShortPulse solves this by:

- Continuously ingesting videos from Instagram’s algorithmic surfaces
- Ranking them using objective, platform‑aligned metrics
- Highlighting true outliers with visual clarity (Momentum Amber)
- Allowing creators to reverse‑engineer what the algorithm is rewarding

This page exists to answer the simplest possible question:

> **“What content is working right now, and why?”**

---

# 3. Who This Page Is For

This page is designed for:

### Creators

- Short‑form creators
- Influencers
- Creative editors
- Videographers

### Entrepreneurs & Brands

- Founders
- Coaches
- Ecommerce brands
- Solo businesses

### Marketers

- Social media managers
- Content strategists
- Creative directors

### Analysts

- Trend analysts
- Data‑driven creators
- Agencies monitoring niches

If someone wants to understand **performance, discovery, and momentum**, this is their home screen.

---

# 4. Platform Availability (v1)

- **Instagram**: Fully functional
- **TikTok**: Visible in UI, but disabled (future integration)
- **YouTube Shorts**: Visible in UI, but disabled (future integration)

User experience:

- Disabled platforms show a tooltip: “Coming soon.”
- Filters update visually but return no results.

This aligns UI with future vision without confusing the user.

---

# 5. Ranking Logic (v1)

Ranking is determined by the **ShortPulse Performance Score** defined in the Performance Index document. (See ShortPulse Source Documents for reference)

```
performance_score =
  0.45 × engagement_rate_percentile
+ 0.40 × views_per_hour_percentile
+ 0.15 × views_percentile
```

Videos on the Top Performing Videos page are ranked **descending** by this score.

This score is platform‑aligned, creator‑agnostic, and requires no historical creator data.

### Why this model is used in v1

- Reliable for global, non‑creator‑specific discovery
- Requires no creator history
- Easy to interpret and compute
- Matches the ingestion pipeline and percentile architecture

### Outlier Display (v1)

The page will display an **Outlier Score** defined as:

```
outlier_score = video_views ÷ median_views_for_platform_in_time_window
```

Outlier is displayed as a **raw multiplier** (e.g., “5.2×”).

Creator-relative outliers are **not** implemented in v1.

A note has been added under Future Features to define creator-follow & creator-relative outlier analytics.

---

# 6. Filters – How They Work

All filters in the UI are active in v1, even if underlying data is limited.

### 6.1 Time Window

- **7 days** (implemented)
- **30 days** (stubbed for future expansion)
- **90 days** (stubbed)

Time window changes:

- Median and percentiles
- Ranking
- Outlier calculations

### 6.2 Platform Filter

- Instagram: Functional
- TikTok: Disabled
- YouTube Shorts: Disabled

### 6.3 Niche Filter

Niches are static and curated. Examples:

- Wisdom
- AI News & Tools
- Consumer
- Fitness
- Luxury
- Fantasy
- Bizarre

### **Important:**

Videos will not be niche‑classified in v1. This is a future feature requiring AI auto‑classification. A note is included under Future Features.

### 6.4 Threshold Filters

Users may filter by:

- Minimum views
- Minimum likes
- Minimum comments
- Minimum engagement rate

These update the ranking cohort.

---

# 7. Video Card – How to Read It (v1)

Minimal and clean.

Each video card displays:

- Thumbnail
- Platform icon
- Views
- Outlier score (raw multiplier)
- Publish age (“6h ago”)
- Rank badge (#1, #2, #3 …)

Optional, if available:

- Engagement rate

Colors follow the ShortPulse Color System. (See ShortPulse Source Documents for reference)

- Signal Teal: Active/interactive elements
- Momentum Amber: High‑impact metrics (outliers, top badges)

---

# 8. Video Modal – Deep Dive (Heavy Data Specification)

The modal is the analytical core of this page.

Even if some metrics are not available yet, the design *must* include placeholders or future states.

### 8.1 Preview Section

- 9:16 video frame
- Platform icon
- Creator name (if available)
- Publish time
- Open on Platform button

### 8.2 Performance Snapshot

- Views
- Outlier multiplier
- Velocity (views per hour)
- Engagement rate
- Watch time (future)

### 8.3 Detailed Metrics

These fields are shown **when data exists**, otherwise display a “Data Unavailable” state.

- Views percentile
- Engagement percentile
- Velocity percentile
- Completion rate
- Shares / saves
- Comments & comment rate
- Median comparison value
- IQR fence (lower/median/upper)
- Scatter plot cluster location
- Views over time chart
- Data freshness timestamp

### 8.4 Visual Semantics

From the ShortPulse color system:

- Momentum Amber identifies top‑tier performance metrics
- Signal Teal is used for selected states and actionable controls
- Soft Ash is used for neutral labels and body text

---

# 9. Interaction States

Included per your instruction.

### 9.1 Hover States

- Cards: subtle lift + teal outline
- Filters: teal glow on hover

### 9.2 Loading States

- Skeleton loaders on cards
- Blurred modal until data loads
- Spinner for infinite scroll

### 9.3 Empty States

If filters produce no results:

- Icon + text: “No videos found.”
- Suggest removing thresholds

### 9.4 Error States

- Network error banner
- Retry button

### 9.5 Disabled States

- TikTok and YouTube buttons are visible but disabled
- Tooltip: “Coming soon”

### 9.6 Responsive Rules

- Desktop: 4–6 cards per row
- Tablet: 2–3 cards
- Mobile: 1 per row, swipe navigation

---

# 10. Data Refresh Logic

Even though ingestion runs every 6 hours, the UI will:

- Refresh the Top Performing Videos page **once per day at midnight**
- Display the last update time inside the modal only

Users do not see a prominent refresh timestamp unless they inspect a specific video.

---

# 11. AI Interpretation Layer (Future Framework)

This document includes notes for future AI integration.

While users will not have access to AI explanations in v1, the system must be designed so that future AI agents can:

- Explain why a video is trending
- Compare videos
- Extract patterns across niches
- Interpret outlier significance
- Provide creator‑specific recommendations (once following exists)

These capabilities depend on:*niche classification*, *creator history*, and *wider ingestion*.

These are noted as **advanced features**, not v1.

---

# 12. Future Features & Architecture Roadmap

The following features must be accounted for in design but **not implemented in v1**.

### 12.1 Creator Follow System

Users can follow specific creators. Selecting a creator inside Analytics unlocks:

- Creator‑relative outlier scores
- Creator‑history scatter plots
- Creator‑specific insights

This aligns with the Outlier Source of Truth.

### 12.2 AI Niche Auto‑Classification

ShortPulse will auto‑classify videos into static niches. Requires:

- Caption/text extraction
- Visual analysis
- LLM classification

### 12.3 Platform Expansion

TikTok and YouTube will become fully functional. Requires:

- Multi-platform ingestion strategy
- Unified performance normalization

### 12.4 Trend Reports & Alerts

Possible future surfaces:

- "New breakout in your niche"
- "Rising format this week"
- Weekly performance digest

### 12.5 Predictive Analytics

Using ML from the Performance Index roadmap. (See ShortPulse Source Documents for reference)

### 12.6 Additional Ranking Dimensions

- Hook classification
- Topic clustering
- Content format signatures

These depend on ML and large data volumes.

---

# 13. Page Position in ShortPulse

This is the **primary landing page** for logged‑in users. It represents the "pulse" of the short‑form ecosystem.

Page Name: **Top Performing Videos** App Name: **ShortPulse**

---

# 14. Summary of Intent & Philosophy

This page is built around three principles:

### 1. **Clarity over complexity**

Creators see exactly what is performing well.

### 2. **Signal over noise**

Momentum Amber and percentile metrics highlight true breakout content.

### 3. **Future‑proof architecture**

The system is designed to scale into:

- Creator‑specific analytics
- Multi‑platform ingestion
- AI‑driven insights
- Predictive modeling

This document is the authoritative Source of Truth for the design and implementation of the Top Performing Videos page in ShortPulse.

End of document.
