# ADR 0031: AI Studio Full-Canvas Session Persistence

## Status
Accepted

## Date
2026-03-11

## Context
ADR 0029 intentionally narrowed persistence to reference-only scope to reduce restore regressions during stabilization.

AI Studio now requires durable continuity for production usage across:
1. workspace state,
2. output/reference state,
3. agent transcript/input state,
4. dual-canvas state (shared scene + per-instance cameras + transient edit sessions).

Additional constraints:
1. Existing `/api/ai/sessions/*` route and SQL RPC boundaries remain in place.
2. Backward compatibility with previously saved V1 snapshots is required.
3. Persistence must avoid runaway payload growth and keep save reliability predictable.

## Decision
1. Adopt **session snapshot schema V2** for all new writes.
2. Keep V1 read compatibility; write V2 only.
3. Persist full canvas payload in V2:
   - scene items,
   - main + right-rail camera states,
   - draft text + active text-edit session ownership.
4. Enable remote shadow writes + restore candidate loading + restore apply by default (`false` remains emergency kill-switch posture).
5. Enforce hard bounds:
   - canvas item cap: `300`,
   - snapshot size guardrail: `~900KB` serialized payload limit.
6. Keep lifecycle flush keepalive as best-effort backup only; primary reliability comes from regular debounced writes while active.

## Consequences
- Positive:
  - Full project continuity after refresh/reopen for both main canvas and right-rail canvas workflows.
  - Backward-compatible restore path for existing V1 snapshots.
  - Bounded payload growth and deterministic cap behavior.

- Negative:
  - Higher snapshot complexity and additional validation logic.
  - Oversized payloads can be rejected and require user-side state reduction.

- Follow-ups:
  - Keep SOP/API docs aligned with default-on flags and V2 schema semantics.
  - Monitor restore/save warnings and adjust UI messaging if operational noise appears.

## Alternatives considered
- Keep reference-only persistence (ADR 0029).
  - Rejected: insufficient continuity for production canvas workflows.
- Persist full state without hard limits.
  - Rejected: oversized snapshots and unstable save reliability risk.
- Introduce a separate canvas-only backend store.
  - Rejected for now: unnecessary architecture expansion vs existing session RPC boundary.

## Related
- `docs/adr/0029-ai-studio-reference-only-session-persistence.md` (superseded by this decision)
- `docs/adr/0030-ai-studio-dual-canvas-right-rail-shared-scene.md`
- `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
