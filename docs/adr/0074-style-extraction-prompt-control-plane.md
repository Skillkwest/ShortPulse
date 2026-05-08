# ADR 0074: Style Extraction Prompt Control Plane

## Status

Accepted

## Context

The Styles Library extraction lane (`/api/ai/extract-style`) previously loaded its system prompt only from code-local prompt config, with env fallback only when the config entry was missing. That made the admin `Agent Instructions` workspace unable to control the live style-extraction behavior even though operators now need to tune:

- which style dimensions are emphasized,
- how tightly extraction stays subject-agnostic,
- how the structured `STYLE TITLE` / `STYLE ADD-ON` contract evolves.

The existing Pulse built-in control plane already established the product pattern for admin-owned runtime instructions: a service-role-only table, admin-only mutation route, and seeded code fallback when runtime data is absent.

## Decision

- Store runtime-overridable agent prompts in a new service-role-only table: `agent_prompt_runtime`.
- Seed `OPENAI_PROMPT_STYLE_EXTRACT` into that table during migration so operators can edit the current live extractor prompt immediately.
- Resolve style extraction runtime prompts through a shared server helper that prefers control-plane data and falls back to the seeded code prompt when no runtime row exists or Supabase admin config is unavailable.
- Expose admin prompt mutation only through `/api/admin/agent-instructions/style-extract-prompt`.
- Keep the admin UI scoped to the style-extraction prompt for now, even though the underlying table can support additional prompt ids later.

## Consequences

- Operators can tune the live style-extraction system prompt without shipping a code edit or redeploy.
- The style extraction admin card now controls the same prompt consumed by `/api/ai/extract-style`.
- Seed fallback remains available for local development, partial environments, and recovery from control-plane drift.

## Guardrails

- Direct browser access to `agent_prompt_runtime` remains forbidden; only trusted server code may read or write it.
- Runtime prompt reads must fail closed to the seeded code prompt, not to an empty prompt.
- Admin writes must reject blank prompt bodies.
- Prompt normalization and post-processing policy (`styleExtractionPromptPolicy.ts`) remains a separate downstream safety/shape layer and is not replaced by the control plane.
