# Nogo Tools

Purpose: inventory helper tools for provider spending analytics.

## Current Status

No executable Nogo-specific tools exist yet.

## Planned Tools

### Provider Spend Matrix Calculator

Goal: generate provider split tables from:

- active user counts,
- blended spend per active user,
- provider split percentages,
- expected-spend multiplier,
- daily cap multiplier.

Expected output:

- monthly expected spend,
- monthly hard cap,
- provider split,
- daily hard cap,
- alert thresholds.

### Fal Credit Balance Check

Goal: read Fal prepaid credits through the official account billing API when the user provides an approved admin key in a secure runtime.

Guardrail:

- never store or print raw API keys.
- never commit provider credentials.

### Provider Pricing Snapshot

Goal: collect current official pricing references for Kie, Fal, ElevenLabs, and OpenAI and record:

- source URL,
- observed price basis,
- verification date,
- confidence,
- changed assumptions.

## Tool Rules

- Tools must be read-only unless the user explicitly approves a mutation.
- Tools must not print secrets.
- Tools must label dashboard evidence separately from local repo assumptions.
- Tools must write outputs into Nogo reports or scratch workspace, not into canonical billing/pricing docs unless the user asks.
