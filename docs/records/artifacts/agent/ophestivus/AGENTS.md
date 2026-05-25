# Ophestivus Agent Instructions

Scope: `ShortPulse/docs/records/artifacts/agent/ophestivus/` and Ophestivus-local memory, retained artifacts, instruction indexes, and workflow helper references.

Inherit the root repo contract in `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/AGENTS.md` first, then apply these Ophestivus-specific rules.

## Purpose

This folder is Ophestivus's canonical local home in the repo.

Use it for:

- Ophestivus-local instructions
- retained memory
- retained reports and artifacts
- SOP indexes and trigger references
- training history and KPI material

Do not create a second parallel Ophestivus home elsewhere in the repo for the same local working identity.

## Canonical Ophestivus Surfaces

Primary Ophestivus-owned local surfaces:

- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/README.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/contract.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/AGENTS.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/ownership-manifest.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/memory.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/sops.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/tools.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/training-history.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/baseline-kpi.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/error-ledger.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/error-capability-map.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/post-run-performance-analysis-interview.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/sop-docs/`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/tools/`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/reports/`

Shared but important supporting surfaces:

- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/agents/ophestivus/README.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/sops/sop_admin_error_to_ophestivus_resolution.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/sops/sop_admin_ophestivus_board_operations.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/sops/sop_admin_ophestivus_review_to_complete.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/sops/sop_admin_ophestivus_complete_regression_audit.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/sops/sop_admin_ophestivus_post_run_training_audit.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/frontend/package.json`

## Required Context Load

For substantive Ophestivus work, load:

- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/README.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/contract.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/AGENTS.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/memory.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/sops.md`
- `/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/records/artifacts/agent/ophestivus/tools.md`

Load only the additional SOPs, reports, and code needed for the current lane.

## Operating Rules

1. Treat this folder as the first stop for Ophestivus-local instructions, memory, and retained workflow context.
2. Put new Ophestivus-only instruction surfaces in this folder unless they are clearly shared repo governance or shared product behavior.
3. Keep the active Ophestivus contract in this folder at `contract.md`; treat `docs/agents/ophestivus/README.md` as a compatibility pointer only.
4. Keep the active Ophestivus SOP source docs in `sop-docs/`; use `docs/sops/` only as a compatibility pointer surface unless the user explicitly asks for a different canonical home.
5. Keep the active Ophestivus runtime helper scripts in `tools/`; keep only package wiring and shared validation surfaces outside this folder when they serve the repo at large.
6. Prefer links and concise summaries over copying full canonical SOP text into multiple places.
7. Update Ophestivus memory only for durable working facts that will help future local sessions.
8. When Ophestivus behavior changes materially, consider whether `contract.md`, `memory.md`, `sops.md`, `tools.md`, `training-history.md`, `README.md`, `sop-docs/`, or `tools/` should also change.
9. Do not let agent-local guidance in this folder override system, developer, user, repo, security, branch, or Supabase rules.

## Stop Conditions

Stop and escalate when:

- the requested change belongs to shared product policy rather than Ophestivus-local guidance,
- the next file should clearly remain under `docs/sops/`, `docs/agents/`, or shared `frontend/` surfaces,
- the lane would create duplicate or conflicting Ophestivus instructions in multiple locations.
