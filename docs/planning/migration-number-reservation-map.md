# Migration Number Reservation Map

Last updated: 2026-03-02  
Authority: Working  
Owner: Engineering

## Purpose
Prevent migration-number collisions across concurrent plan tracks and lock ordering before implementation PRs open.

## Reserved Slots
| Number | Reserved Scope | Status | Notes |
| --- | --- | --- | --- |
| `041_*` | Runtime Slice C settlement integrity semantics | Implemented | `041_harden_released_reservation_recapture_semantics.sql` landed. |
| `042_*` | Runtime Slice C queue/recovery RPC execute-grant parity | Implemented | `042_harden_queue_recovery_rpc_execute_grants.sql` landed. |
| `043_*` | `user_preferences.media_autosave_enabled` | Implemented | `043_add_user_preferences_media_autosave_enabled.sql` landed with rollback pair. |
| `044_*` | AI Studio session persistence table/RPC | Implemented | `044_add_ai_studio_sessions_persistence.sql` landed with rollback pair. |
| `045_*` | Safety control-plane persistence entities | Reserved | Profile/version/runtime/event tables. |
| `046_*` | Safety control-plane grants/hardening/checks | Reserved | Execute posture, cooldown/rollback helpers, validation checks. |

## Reservation Rules
1. No migration PR may use `041`-`046` unless mapped here first.
2. One migration number maps to one concern only; no mixed-scope migrations.
3. Changes to this map must also update:
   - `docs/planning/shortpulse-unified-decision-log.md`
   - `docs/planning/shortpulse-unified-buildout-tracker.md`
4. Any deviation requires a decision-log entry and explicit rollback/update note.
