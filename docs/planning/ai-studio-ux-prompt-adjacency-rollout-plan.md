# AI Studio UX Prompt-Adjacency Rollout Plan

Date: 2026-03-02  
Authority: Working  
Owner: Frontend + AI Platform  
Status: Active (G0 governance lock complete; G1 implementation pending)

## Summary
This plan defines Wave G execution for consolidated AI Studio UX and prompt-adjacency behavior under Phase 13. The scope is intentionally narrow: preserve existing generation/runtime contracts while making prompt-adjacent actions more deterministic and consistent across Create/Text/Agent surfaces.

## Goals
1. Eliminate prompt-adjacency drift across AI Studio entry points (composer, generate pills, assistant bubble actions).
2. Keep user-visible behavior deterministic under Chat Mode ON/OFF and restore-hydration gates.
3. Preserve existing route/API envelopes and avoid introducing new backend dependencies.
4. Keep rollout flag-gated and rollback-first.

## Non-Goals
1. No broad AI Studio redesign.
2. No provider/runtime contract expansion.
3. No migration/schema changes for this wave.

## Locked Constraints
1. Wave F staging admin-API observation remains deferred until staging deployment parity is restored.
2. Wave G may proceed in parallel on local/code-gated slices that do not depend on staging alias validation.
3. Existing `/api/ai/studio-agent` and `/api/fal/*` response envelopes must remain backward compatible.

## Candidate Surfaces
1. `frontend/pages/ai-studio.tsx`
2. `frontend/features/ai-studio/components/AgentChatPanel.tsx`
3. `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`
4. `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreHydration.ts`
5. `frontend/features/ai-studio/hooks/taskSubmission/*`

## Execution Phases
### G0: Governance Lock (current)
1. Publish plan/tracker/evidence note.
2. Lock scope boundaries and rollback posture.

### G1: Prompt-Adjacency Contract Consolidation
1. Audit prompt-adjacent triggers and normalize action source semantics.
2. Remove remaining duplicated prompt-derivation branches where safe.
3. Add focused regression locks for ON/OFF chat-mode adjacency behavior.

### G2: UX Consistency + Rollout Gates
1. Ensure prompt-adjacent affordances remain consistent in inline/expanded/restore states.
2. Add/expand local validation packet (tests + lint/type/build/docs).
3. Record pass/hold evidence and rollback controls.

## Validation Gates
1. Local test packet for prompt-adjacent flows and agent-bridge behavior.
2. `npm -C frontend run lint`
3. `npm -C frontend run type-check`
4. `npm -C frontend run build`
5. `npm -C frontend run docs:check`

## Rollback
1. Prefer flag disablement for new UX wiring first.
2. Revert prompt-adjacency seams as isolated frontend-only slices.
3. Keep no-op fallback path for legacy prompt-origin resolution.

## Definition of Done
1. Wave G phases G0-G2 evidenced in `phase-13` packet.
2. No regressions in existing AI Studio generation/agent contracts.
3. Canonical trackers and decision log updated at each gate.

