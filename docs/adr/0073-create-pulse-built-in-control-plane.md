# ADR 0073: Create Pulse Built-in Control Plane

## Status

Accepted

## Context

Create Pulse previously mixed two different ownership models:

- built-in guided-workflow definitions were seeded in code,
- user Pulse surfaces could save built-in-id overrides into `user_preferences.ai_studio_saved_pulses`,
- runtime requests depended on browser-supplied Pulse metadata.

That model no longer fits the admin-owned `Agent Instructions` workspace. The built-in Pulse set now needs one shared source of truth that can be edited once and applied consistently across:

- `/admin/agent-instructions`,
- Pulse library and Create rail hydration,
- `/api/ai/studio-agent-pulse` runtime execution.

## Decision

- Store the active built-in Create Pulse catalog in a new singleton control-plane table: `create_pulse_builtin_runtime`.
- Keep the table service-role-only for direct reads and writes.
- Expose admin mutation only through `/api/admin/agent-instructions/pulse-builtins`.
- Expose authenticated runtime/catalog reads only through `/api/ai/create-pulse-builtins`.
- Seed the control plane from the current three built-ins, but treat that seed as replaceable operator-owned data rather than fixed product truth.
- Re-resolve built-in Pulse instructions on the server before Pulse runtime execution so built-in requests do not trust browser-local metadata.
- Restrict `user_preferences.ai_studio_saved_pulses` to per-user custom Pulses only; built-ins are no longer user-editable override records.

## Consequences

- Admin operators get one authoritative editing surface for built-in guided-workflow definitions.
- Pulse runtime, the Create rail, and the Pulse library can all render the same built-in catalog without code-local drift.
- Existing stale per-user built-in collisions are normalized away from user Pulse persistence.
- Built-in Pulse ids, labels, descriptions, and instructions can change without shipping a code edit, as long as the control-plane catalog remains valid.

## Guardrails

- Standard-mode agent instructions now use their own live control-plane contract and fail closed when the Standard runtime prompt row is missing or unreadable.
- Customer sessions must never read `create_pulse_builtin_runtime` directly.
- Built-in guided-workflow execution must fail closed to the server-resolved catalog, not fall back to user override payloads.
- Built-in catalog writes must validate unique preset ids plus non-empty labels, descriptions, and system instructions before persistence.
