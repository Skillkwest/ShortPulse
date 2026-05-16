# Gear Ball Tools

Purpose: keep a retained inventory of the helper commands and tooling that improve Gear Ball's execution quality.

## Current Helpers

- `npm -C frontend run gear-ball:preflight -- --files <paths...> --tests <tests...>`
  - Batch preflight for generated-file/env-file guardrails, shared-risk warnings, targeted lint, docs parity, and suite-hot reruns.
  - Allows documented example env files while still blocking real env files and secret-bearing local configs.
  - Normalizes repo-root `frontend/...` Vitest paths to frontend-relative form and can print a frontend-relative test manifest with `--print-test-manifest`.
- `npm -C frontend run gear-ball:manifest -- --batch-name "<name>" --reason "<reason>" --risk "<risk>" --validation "<checks>"`
  - Compact manifest generator for staged batches or supplied file lists.

## Tooling Decision Rule

After every full commit/push SOP run, Gear Ball should decide whether:

- current helpers are enough
- an existing helper needs a safer mode or better output
- a new helper is justified by repeated mechanical friction

Do not build new tooling for one-time discomfort unless it protects a high-risk gate.
