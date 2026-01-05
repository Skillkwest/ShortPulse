# SOP: Performance Detection & AI Content Labeling

Purpose: bridge the performance analytics page to the agreed ML/AI detection strategy. Defines what the `/performance` UI should expect, what to ignore, and how to label AI-generated content without contaminating ranking.

## Scope & Audience
- Covers data delivered to `/performance` (Top videos list, modal, scatter) and any services feeding it.
- Audience: frontend (field mapping/UX), data/ML (signal computation), product (label semantics).

## Required Performance Signals (ranking only)
- **Outlier multiplier**: `views ÷ platform_median(rolling_window)`; primary breakout gate.
- **IQR upper fence**: `Q3 + 1.5 × IQR` on views to suppress noise.
- **Velocity**: `views_per_hour`; used directly and for acceleration.
- **Engagement ratio**: `(likes + comments + saves) ÷ views`; validation/quality signal.
- **Performance score**: `0.45 * engagement_rate_percentile + 0.40 * views_per_hour_percentile + 0.15 * views_percentile` (locked).
- **Rank**: sort descending by performance score; tie-break by rank seed.

## Added Metrics (included)
- **Effect size**: `(mean(top_group) − mean(control_group)) ÷ pooled_std_dev` to weed out thin wins and compare across platforms. Surface as metadata, not a rank multiplier.
- **Acceleration delta**: `Δ(views_per_hour)` to detect directionality; advisory only.
- **Uncertainty state**: `high_confidence | candidate | insufficient_data | conflicting_signals`; never force a false high-confidence badge.

## AI Detection (ML-only, non-ranking)
- Signals: visual artifacts (temporal/texture/face/hand/light), audio cadence/frequency/breath, caption perplexity/token repetition/prompty phrasing, posting-cadence anomalies.
- Output per video:
  - `ai_generated_probability` (0–1)
  - `ai_class` in `{ai_assisted, human_recorded, unknown}`
  - `ai_flag` in `{ai_candidate, ai_confirmed_top_performer, ai_early_breakout, ai_unknown}` (see hybrid rules)
- Usage: label/filter only. **Never** alters ranking, sorting, or outlier gates.
- Surfacing guidance:
  - Show AI badge only when `ai_flag === ai_confirmed_top_performer` **and** `uncertainty` is `high_confidence`.
  - For `ai_candidate` or `ai_early_breakout`, keep labels internal or under a muted “Candidate” tag; do not call it “top” until Method 1 confirms.
  - `unknown` stays unlabelled; do not coerce a guess.

## Hybrid Discovery (Method 1 + Method 2)
- **Method 1 (authoritative)**: broad scrape → eligibility + statistical gates (outlier/IQR/velocity/engagement) → AI likelihood. Only path that can mark `ai_confirmed_top_performer`.
- **Method 2 (advisory)**: scrape AI-native creators frequently → watch velocity/acceleration only → tag `ai_candidate`. Cannot promote or rank.
- **Reconciliation hard rules**:
  - Method 2 feeds suggestions only; Method 1 must confirm.
  - Performance thresholds are never relaxed for AI content.
  - AI detection stays probabilistic; `unknown` is valid.
  - Cross-platform concordance (`cross_platform_signal` tag) is informational only.

## Data Contract for `/performance`
Required fields (existing): `reel_id`, `thumbnail_url`, `platform`, `platform_label`, `category`, `views`, `likes`, `comments`, `shares_or_saves`, `publish_time`, `hours_since_publish`, `views_per_hour`, `engagement_rate`, `rank`, `performance_score`, `outlierMultiplier`, `baselineViews`, `iqrUpperFence`, `views_percentile`, `views_per_hour_percentile`, `engagement_rate_percentile`, `trend_direction`.

New/optional fields from this SOP:
- `effect_size?: number`
- `acceleration_delta?: number`
- `uncertainty_state?: "high_confidence" | "candidate" | "insufficient_data" | "conflicting_signals"`
- `ai_generated_probability?: number`
- `ai_class?: "ai_assisted" | "human_recorded" | "unknown"`
- `ai_flag?: "ai_candidate" | "ai_confirmed_top_performer" | "ai_early_breakout" | "ai_unknown"`
- `cross_platform_signal?: boolean`

Frontend handling:
- If optional fields are absent, preserve current UI (no badges).
- If present, render:
  - Effect size: small secondary stat or tooltip in modal; do not sort by it.
  - Acceleration: secondary trend chip (e.g., “Rising” vs “Cooling”) tied to `trend_direction`.
  - AI badges: follow surfacing guidance above; never change card ordering.
  - Cross-platform: subtle tag; informational only.

## Explicit Exclusions (do not build)
- No virality prediction, algorithm explanation, single global score, creator quality scoring, outcome promises, or automated recommendations tied to AI detection.
- Do not relax outlier/IQR/velocity/engagement gates for AI-labeled items.

## Implementation Notes
- Keep all ranking math server/data-side; the page consumes scored records and renders.
- Persist `last_refresh_at` alongside `data_version` to keep the live indicator consistent.
- When integrating real data, keep demo fallback values (`null`/`undefined`) valid to avoid UI blowups during rollout.
