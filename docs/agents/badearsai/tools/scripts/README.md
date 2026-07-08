# Badearsai Scripts

Purpose: future home for Badearsai-owned helper scripts.

Scripts added here should be small, read-only by default, and focused on parsing, classification, or proof reporting for ShortPulse error triage packets.

Rules:

- Do not store secrets or raw private data.
- Do not call production mutation endpoints.
- Do not resolve, ignore, replay, or mutate Admin rows.
- Keep scripts deterministic and documented.
- Prefer existing repo scripts when they already cover the proof need.
