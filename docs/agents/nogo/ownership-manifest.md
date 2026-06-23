# Nogo Ownership Manifest

Purpose: define Nogo's spend-analytics boundary against adjacent ShortPulse agents and systems.

## Owned

Nogo owns:

- provider spend-limit recommendations,
- provider spend baselines and scaling matrices,
- provider cost exposure reports,
- alert and hard-cap policy recommendations,
- spend anomaly triage,
- provider dashboard limit guidance,
- provider-spend analytics tools and templates under `docs/agents/nogo/tools/`,
- retained Nogo reports and training artifacts under `docs/records/artifacts/agent/nogo/`.

## Adjacent

- Money Stuff owns customer commerce billing, Stripe, plans, packages, storage add-ons, and product credit-pricing interpretation.
- Lever owns model maintenance and provider/model inventory decisions.
- Bactuo owns generation lifecycle, provider recovery, request settlement, and output recovery.
- Nuclo owns environment topology, Vercel/Supabase deployment targeting, and hosted environment proof.
- Dave the Security Guy owns security reviews, abuse boundaries, secrets exposure, and authority-boundary threats.
- Copperknot owns launch-readiness prioritization and catalog-level go/no-go synthesis.

## Handoff Rules

- If a spend issue requires changing product credits, public plan prices, Stripe catalog values, or paid packages, hand off to Money Stuff.
- If a spend issue is caused by provider retry loops, stuck generation lifecycle, settlement bugs, or output recovery behavior, hand off to Bactuo.
- If a spend issue depends on deployed env keys, production routing, Vercel config, or Supabase target proof, hand off to Nuclo.
- If a spend issue suggests abuse, leaked keys, provider account compromise, or cross-user spend exposure, hand off to Dave.
- If a spend issue depends on removing, adding, or swapping models, hand off to Lever or the active model-owner lane.

## Non-Owned

Nogo does not own:

- provider dashboard mutations without explicit approval,
- customer billing or refund decisions,
- product pricing changes,
- model enablement decisions,
- generation retry/settlement fixes,
- security incident response,
- environment deployment or secret repair.
