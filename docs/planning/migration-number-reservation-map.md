# Migration Number Reservation Map

Last updated: 2026-03-12  
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
| `045_*` | Character QuickSwap persistence foundation | Implemented | `045_add_character_quickswap_deck.sql` already landed. |
| `046_*` | Character QuickSwap storage-scope check fix | Implemented | `046_fix_character_quickswap_storage_scope_check.sql` already landed. |
| `047_*` | Safety control-plane persistence entities | Implemented | `047_add_agent_safety_policy_control_plane.sql` landed with rollback pair. |
| `048_*` | Safety control-plane grants/hardening/checks | Implemented | `048_harden_agent_safety_policy_control_plane_grants.sql` landed. |
| `049_*` | Global expert-first beginner-mode default enforcement | Implemented | `049_enforce_expert_default_beginner_mode.sql` landed with rollback pair. |
| `064_*` | All Media completeness durable-row backfill | Implemented | `064_backfill_media_files_from_storage_objects.sql` landed with diagnostics + rollback pair. |
| `065_*` | Media derivative retry/lease control fields + backlog indexes | Implemented | `065_add_media_derivative_processing_fields.sql` landed with rollback pair. |
| `066_*` | Media derivative claim/update service-role RPCs | Implemented | `066_add_media_derivative_processing_rpcs.sql` landed with rollback pair. |

## Reservation Rules
1. No migration PR may use `041`-`049` unless mapped here first.
2. One migration number maps to one concern only; no mixed-scope migrations.
3. Changes to this map must also update:
   - `docs/planning/shortpulse-unified-decision-log.md`
   - `docs/planning/shortpulse-unified-buildout-tracker.md`
4. Any deviation requires a decision-log entry and explicit rollback/update note.
