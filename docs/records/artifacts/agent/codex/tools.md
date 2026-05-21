# Codex Tools

Purpose: index the small set of repo-local tools and helper surfaces that Codex owns for self-governance and folder maintenance.

## Owned Surfaces

- [docs/agents/codex/README.md](../../../../agents/codex/README.md)
  - local contract for Codex as a repo-side operating surface
- [docs/agents/codex/AGENTS.md](../../../../agents/codex/AGENTS.md)
  - local instruction overlay for Codex-only folder rules
- [docs/agents/codex/memory.md](../../../../agents/codex/memory.md)
  - lean repo-visible memory for assistant-specific deltas
- [training-history.md](./training-history.md)
  - retained self-correction and training continuity record

## Owned Helper Script

- `bash scripts/ops/codex/codex_folder_audit.sh`
  - checks that Codex's required folder files exist
  - verifies Codex is indexed in the docs entrypoints
  - runs the standard docs link and semantic drift checks

## Shared Repo Tools Codex Relies On

- `node scripts/check_docs_links.js`
- `node scripts/check_docs_semantic_drift.js`

These are shared repo validation tools, not Codex-owned tools, but they are part of the standard Codex folder audit path.
