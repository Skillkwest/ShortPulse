# STG-02 Staging Validation (2026-02-20)

Date: 2026-02-20  
Environment: staging  
Operator: @sleepyseamonster  
Reviewer: Pending

## Scope
- Apply conversation-state hardening migrations to staging.
- Run `conversation_state_hardening_gate` in `warn` and `enforce` modes.
- Capture run evidence and defect remediation trace.

## Execution timeline

| Sequence | Action | Run / PR | Result | Notes |
| --- | --- | --- | --- | --- |
| 1 | Hardening gate (`warn`) | [Run 22243270817](https://github.com/sleepyseamonster/ShortPulse/actions/runs/22243270817) | fail (warn mode) | Missing function `public.prune_ai_agent_conversation_state_expired(integer)` in staging (028 not yet applied). |
| 2 | Merge migration 028 to `main` | [PR #29](https://github.com/sleepyseamonster/ShortPulse/pull/29) | merged | Added `028` + rollback to default branch. |
| 3 | Add controlled migration apply workflow | [PR #30](https://github.com/sleepyseamonster/ShortPulse/pull/30) | merged | Added manual environment-gated workflow using `SUPABASE_DB_URL`. |
| 4 | Apply migration 028 (`staging`) | [Run 22243364824](https://github.com/sleepyseamonster/ShortPulse/actions/runs/22243364824) | pass | `028` applied in staging. |
| 5 | Hardening gate (`warn`) | [Run 22243385772](https://github.com/sleepyseamonster/ShortPulse/actions/runs/22243385772) | fail (warn mode) | Runtime defect found: ambiguous `user_id` in `delete` inside upsert function. |
| 6 | Add remediation migration 029 | [PR #31](https://github.com/sleepyseamonster/ShortPulse/pull/31) | merged | Fixed delete ambiguity + extended apply workflow for `029`. |
| 7 | Apply migration 029 (`staging`) | [Run 22243460603](https://github.com/sleepyseamonster/ShortPulse/actions/runs/22243460603) | pass | `029` applied in staging. |
| 8 | Hardening gate (`warn`) | [Run 22243485270](https://github.com/sleepyseamonster/ShortPulse/actions/runs/22243485270) | fail (warn mode) | Runtime defect found: ambiguous `user_id` in `on conflict (user_id, conversation_id)`. |
| 9 | Add remediation migration 030 | [PR #32](https://github.com/sleepyseamonster/ShortPulse/pull/32) | merged | Switched to `on conflict on constraint ai_agent_conversation_state_pkey`; workflow extended for `030`. |
| 10 | Apply migration 030 (`staging`) | [Run 22243553110](https://github.com/sleepyseamonster/ShortPulse/actions/runs/22243553110) | pass | `030` applied in staging. |
| 11 | Hardening gate (`warn`) | [Run 22243573266](https://github.com/sleepyseamonster/ShortPulse/actions/runs/22243573266) | fail (warn mode) | FK-safe test issue: hardcoded UUIDs in check script violated `auth.users` FK. |
| 12 | Patch gate check script for FK-safe users | Commit `97e0bccd` on `main` | merged to `main` | `sql/check_conversation_state_hardening_028.sql` now derives test IDs from `auth.users`. |
| 13 | Hardening gate (`warn`) | [Run 22243621180](https://github.com/sleepyseamonster/ShortPulse/actions/runs/22243621180) | pass | Full matrix passed in warn mode. |
| 14 | Hardening gate (`enforce`) | [Run 22243636554](https://github.com/sleepyseamonster/ShortPulse/actions/runs/22243636554) | pass | Full matrix passed in enforce mode. |

## Final status
- Staging validation for STG-02 is complete.
- Conversation-state hardening gate is green in both `warn` and `enforce` modes.
- Runtime defects discovered during validation were remediated via forward-only migrations (`029`, `030`) and a test harness fix.

## Artifacts
- Gate artifacts are attached to each run as `conversation-state-hardening-gate-<run_id>`.
- Migration apply artifacts are attached as `conversation-state-migration-<migration_id>-<run_id>`.
