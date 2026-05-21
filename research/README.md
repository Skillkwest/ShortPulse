# Research Workspace

Purpose: hold deep research and hardening writeups that support ShortPulse engineering decisions without becoming canonical product truth by default.

## Status

This folder is reference material, not the main source of truth for shipped behavior.

Use `research/` for:

- long-form technical deep dives,
- external research that informs architecture or operations,
- hardening notes that are useful background for future work.

Do not use `research/` as the authoritative home for:

- live product contracts,
- route behavior,
- billing policy,
- deployment policy,
- agent contracts,
- or active SOP ownership.

Those belong under `docs/`, `sql/`, or the relevant source code surface.

## Promotion Rule

If a research conclusion becomes a durable operating rule, architecture decision, or shipped product contract, promote the result into the appropriate canonical doc under `docs/`.
