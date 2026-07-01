# 0080: Custom Voice Ownership Authority

## Status

Accepted

## Context

ShortPulse uses a shared ElevenLabs workspace for voice creation and generation. The original
voice-library contract inferred ownership from provider-global inventory and provider categories
like `generated` and `cloned`. That allowed one user to discover, use, and potentially delete
another user's custom voice.

`user_preferences.ai_studio_saved_voices` provided per-user persistence, but it was shaped as a
UI cache rather than an explicit ownership ledger. For a server-side security boundary, that was
too ambiguous.

## Decision

ShortPulse now treats custom voice ownership as an app-owned server contract:

1. Shared provider inventory never implies ownership.
2. Custom voice ownership is recorded in `public.user_owned_custom_voices`.
3. Voice list, use, and delete routes must verify caller ownership through app-managed state before
   treating a custom voice as accessible.
4. `user_preferences.ai_studio_saved_voices` remains a compatibility/UI metadata cache, not the
   final ownership authority.
5. Create/clone flows must fail closed and roll back provider/sample artifacts when authoritative
   ownership persistence does not succeed.
6. Only high-confidence or explicitly repaired ownership rows are trusted at runtime; legacy
   migrated rows must be quarantined for review before they can act as custom-voice authority.
7. Voice Clone source audio retention is tracked separately in `voice_source_lifecycle`; source
   audio is cleanup evidence, while `user_owned_custom_voices.sample_storage_path` remains the
   protected custom-voice sample authority.

## Consequences

### Positive

- Custom voice privacy is enforced by a dedicated per-user ledger instead of provider inference.
- Shared provider workspace drift no longer changes user ownership boundaries.
- Server routes have one clearer source of truth for custom voice access decisions.

### Tradeoffs

- The system temporarily runs a dual-store model during migration: authoritative table plus legacy
  saved-voice cache.
- Historical custom voices may need backfill, quarantine, or admin repair before the legacy cache
  can be fully retired.

## Follow-up

- Backfill legacy ownership candidates via
  `sql/migrations/129_backfill_user_owned_custom_voices_from_preferences.sql`, then quarantine the
  legacy-migrated rows with
  `sql/migrations/130_quarantine_legacy_migrated_custom_voice_ownership.sql`.
- Quarantine orphaned provider voices with no trusted owner row.
- Remove legacy ownership fallback once migration/cleanup is complete.
