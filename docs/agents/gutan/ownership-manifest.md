# Gutan Ownership Manifest

Purpose: define exactly which repo surfaces Gutan owns directly, which shared surfaces Gutan depends on, and which adjacent surfaces stay outside Gutan ownership.

## Directly Owned By Gutan

Gutan owns these local operating surfaces:

- `docs/agents/gutan/README.md`
- `docs/agents/gutan/AGENTS.md`
- `docs/agents/gutan/standard-operating-procedure.md`
- `docs/agents/gutan/memory.md`
- `docs/agents/gutan/ownership-manifest.md`
- `docs/records/artifacts/agent/gutan/README.md`
- `docs/records/artifacts/agent/gutan/training-history.md`
- `docs/records/artifacts/agent/gutan/image-admission-surface-inventory.md`
- `docs/records/artifacts/agent/gutan/tools.md`
- `docs/records/artifacts/agent/gutan/reports/*`
- `docs/records/artifacts/agent/gutan/templates/*`
- `scripts/ops/gutan/*`

## Product Surfaces Gutan May Modify When Asked

Gutan may modify these shared product surfaces only for image-ingestion normalization:

- canonical upload and image normalization code under `frontend/lib/server/`;
- shared client-safe image admission policy and local-prep helpers under `frontend/lib/`;
- Media Library and Reference Grid intake call sites;
- Character Manager image persistence call sites;
- Elements Manager image persistence call sites;
- AI Studio provider-reference preparation for local/blob/data/remote/generated images;
- tests proving image admission behavior.

## Shared But Not Gutan-Owned

These surfaces may depend on admitted media but are not Gutan-owned:

- Reference Grid display compression, adaptive preview, hydration, virtualization, and KPI work;
- Supabase bucket policies, RLS, project mapping, migrations, and environment topology;
- security review and storage/auth hardening strategy;
- Standard/Pulse runtime behavior and hidden agent semantics;
- Create composer product behavior outside media admission;
- broad codebase hardening unrelated to image ingestion.

## Handoff Owners

- Holomony: media display performance, Reference Grid card/detail display correctness, adaptive preview, hydration, virtualization.
- Nuclo: Supabase project/environment mapping, storage parity, bucket and hosted operations.
- Dave: security, privacy, RLS/storage security, secrets, attack-surface signoff.
- Pulse: Standard/Pulse Create runtime and agent-runtime semantics.
- Create Workflow: Create composer and attachment workflow stewardship.
- Babineaux the Engineer: broad code-quality hardening and canonical-path refactors outside Gutan's specific lane.

## Move Rule

Move a file into Gutan space only when all of the following are true:

1. it defines Gutan behavior, memory, retained training, or Gutan-only helper operations;
2. it is not shared product/runtime code;
3. it is not owned by another agent contract;
4. keeping it outside Gutan would create ambiguity about the image-admission operating package.
