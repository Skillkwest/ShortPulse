# AI Studio UX Prompt-Adjacency Rollout Tracker

Date: 2026-03-02  
Authority: Working  
Owner: Engineering  
Program Doc: `docs/planning/ai-studio-ux-prompt-adjacency-rollout-plan.md`

## Status Overview
| Phase | Status | Owner | Entry Gate | Exit Gate | Evidence |
| --- | --- | --- | --- | --- | --- |
| G0: Governance Lock | Completed | Engineering | Wave F implementation slices landed | Plan/tracker/evidence published and indexed | `docs/planning/evidence/unified-buildout/phase-13/` |
| G1: Prompt-Adjacency Contract Consolidation | In Progress | Frontend + AI Platform | G0 complete | Prompt-adjacent action sources normalized + regression locks green | `docs/planning/evidence/unified-buildout/phase-13/` |
| G2: UX Consistency + Rollout Gates | Planned | Frontend + Ops | G1 complete | Local/staging rollout packet complete | `docs/planning/evidence/unified-buildout/phase-13/` |

## Current Gate Notes
1. Wave F staging admin-API observation is deferred pending staging deployment parity; this does not block Wave G local/code-gated implementation slices.
2. Wave G G0 governance lock is completed with plan/tracker publication.
3. G1 implementation is now the active non-staging-dependent slice.

## Execution Checklist
### G0: Governance Lock
- [x] Create Wave G plan doc.
- [x] Create Wave G tracker doc.
- [x] Add Wave G evidence note and phase-13 index entry.
- [x] Sync phase-13/stage tracker references.

### G1: Prompt-Adjacency Contract Consolidation
- [ ] Audit prompt-adjacent action paths across Create/Text/Agent surfaces.
- [ ] Normalize source/trigger semantics through shared seams.
- [ ] Add focused regression tests for chat-mode and restore-hydration adjacency behavior.

### G2: UX Consistency + Rollout Gates
- [ ] Validate UX consistency in inline/expanded/restore states.
- [ ] Execute local gate packet (`lint`, `type-check`, `build`, `docs:check`, targeted tests).
- [ ] Record pass/hold evidence and rollback note.

## Risks and Mitigations
1. Risk: accidental behavior drift between chat-mode and raw-submit paths.
   - Mitigation: regression locks before enabling any new UX behavior.
2. Risk: prompt-origin ambiguity after restore hydration.
   - Mitigation: keep one canonical prompt-origin seam and fallback path.
3. Risk: mixed-surface UX divergence.
   - Mitigation: enforce shared contracts through bridge-level adapters, not per-component branches.

