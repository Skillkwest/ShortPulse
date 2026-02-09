# ADR 0002: Media Library Persistence Model

## Status
Accepted

## Context
ShortPulse needs per-user persistence for uploads, AI Studio generations, and saved prompts, all backed by Supabase with strict RLS. The Media Library UI now requires four distinct tabs (uploaded images, uploaded videos, saved prompts, AI Studio generations) and backend-only audit logging without exposing service-role keys. The repo remains client-only per ADR 0001.

## Decision
- Keep `media_files` as the canonical metadata table for stored files in the private `media_library` bucket.
- Add `source`, `source_ref`, and `prompt_id` to `media_files` to distinguish uploads from AI Studio generations.
- Add `media_prompts` for manually saved prompts and `ai_generations` for generation metadata.
- Add `media_events` as a backend-only audit log (select + insert only).
- Enforce RLS on all new tables with `user_id = auth.uid()`.

## Consequences
- Positive:
  - Clear separation between uploads, prompts, and AI Studio generations.
  - Media Library tabs map directly to table/source filters.
  - Audit logging is available without any UI exposure.
- Negative:
  - Additional tables and insert flows to maintain from the client.
  - Client-only uploads may hit CORS limits when saving provider URLs.
- Follow-ups:
  - If CORS blocks saving provider media, evaluate a Supabase Edge Function proxy (requires ADR).

## Alternatives considered
- Store prompts and generation metadata in `media_files.metadata` only: rejected (harder to query and maintain).
- No audit table: rejected (insufficient traceability for media actions).
- Introduce a backend service for uploads: deferred (client-only remains a core constraint).
