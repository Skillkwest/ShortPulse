# Money Stuff Retained Memory

Purpose: retain non-authoritative working memory for Money Stuff's billing workflows.

## Current Notes

- Money Stuff's primary job is customer commerce billing truth alignment, not AI usage-billing policy by default.
- The highest-risk recurring billing surfaces are:
  - public pricing truth,
  - Stripe customer repair,
  - webhook/profile projection lag,
  - annual renewal worker health.
- The highest-risk one-time billing surfaces are:
  - credit package sellability,
  - Stripe paid-session verification,
  - correct ledger grant behavior,
  - payment-history projection.
