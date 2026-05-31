# Holomony Ownership Manifest

Purpose: define exactly which repo surfaces Holomony owns directly, which shared surfaces Holomony depends on, and which nearby surfaces should stay outside Holomony ownership.

## Directly Owned By Holomony

These are Holomony's canonical local identity, instruction, memory, and retained artifact surfaces:

- `docs/agents/holomony/README.md`
- `docs/agents/holomony/AGENTS.md`
- `docs/agents/holomony/standard-operating-procedure.md`
- `docs/agents/holomony/memory.md`
- `docs/agents/holomony/media-display-command-index.md`
- `docs/agents/holomony/media-display-authority-ledger.md`
- `docs/agents/holomony/Kirk.md`
- `docs/agents/holomony/Kirk.html`
- `docs/agents/holomony/ownership-manifest.md`
- `docs/agents/holomony/right-rail-command-index.md`
- `docs/agents/holomony/reference-grid-ownership-map.md`
- `docs/agents/holomony/reference-grid-diagnostic-sop.md`
- `docs/records/artifacts/agent/holomony/README.md`
- `docs/records/artifacts/agent/holomony/*.md`
- `docs/records/artifacts/agent/holomony/reports/*`
- `scripts/ops/holomony/*`

## Shared But Not Holomony-Owned

These are core product or repo-governance surfaces that Holomony uses, but should not absorb into Holomony's own folder:

- root `AGENTS.md`
- `docs/README.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/sops/sop_media_panel_performance_kpi.md`
- `docs/sops/sop_media_performance_operations.md`
- shared product code and tests under `frontend/`
- shared runtime/media scripts under `frontend/scripts/`
- Reference Grid product code under `frontend/features/ai-studio/reference-grid/`
- Reference Grid projection/domain/intake code under `frontend/features/ai-studio/reference-*`
- shared AI Studio modal/detail/media authority code used by more than one surface

## Explicitly Not Holomony-Owned

These may mention Holomony, but they belong somewhere else and should stay there:

- other agent folders under `docs/agents/*`
- other agent artifact folders under `docs/records/artifacts/agent/*`
- shared indexes such as `docs/agents/README.md`, `docs/README.md`, and `scripts/ops/README.md`
- historical run logs or deployment reports from other agents that mention Holomony
- shared media KPI capture/scoring/runtime code under `frontend/`

## Move Rule

Move a file into Holomony space only when all of the following are true:

1. it defines Holomony behavior, memory, retained training, or Holomony-only helper operations,
2. it is not a shared product/runtime tool used by the repo at large,
3. it is not owned by another agent's contract or artifact history,
4. keeping it outside Holomony would create ambiguity about Holomony's own operating package.

## Do Not Recreate

Do not recreate a second assistant-local package for this lane under another generic folder name.
