# Glossary

## Outlier multiplier
`views ÷ platform_median(rolling_window)`. Primary breakout signal used for comparisons across creators/platforms.

## Velocity
`views_per_hour`. Used as a core signal and to infer rising/cooling directionality.

## Engagement rate
`(likes + comments + saves/shares) ÷ views`. Used as a quality/validation signal; not a “virality guarantee”.

## Cohort
A set of comparable videos/creators used as the baseline distribution for percentiles and outlier gates.

## RLS (Row-Level Security)
Supabase/Postgres policies that enforce per-user access (e.g., `user_id = auth.uid()`).

