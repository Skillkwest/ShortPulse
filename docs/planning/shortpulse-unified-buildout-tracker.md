# ShortPulse Unified Build-Out Tracker

Last updated: 2026-02-27  
Branch: `second-foundational-overhaul`

## Tracking Rules
1. Do not mark a phase complete unless code + tests + docs + evidence are all complete.
2. Every phase must include a rollback note.
3. Every phase must include at least one validation run log.

| Phase | Status | Owner | Entry Criteria | Exit Criteria | Evidence Folder | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 00 | In Progress | Engineering | Current branch baseline available | Baseline checks green + incident hygiene doc updated | `evidence/unified-buildout/phase-00/` | Code baseline fixed; credential rotation is operational follow-up |
| 01 | In Progress | Engineering | Phase 00 complete | CI/guardrail drift resolved and mapped | `evidence/unified-buildout/phase-01/` | Slice A/B complete; branch-protection mapping verification pending |
| 02 | Completed | Engineering | Phase 01 complete | Token-first auth and admin decoupling validated | `evidence/unified-buildout/phase-02/` | Completed: token-first auth + `/api/admin/access` + shared admin access hook rollout |
| 03 | Completed | Engineering | Phase 02 complete | Queue/recovery transition integrity proven | `evidence/unified-buildout/phase-03/` | Completed: checked queue mutations + transition guard + CAS fallback claim + reconciliation edge hardening |
| 04 | Deferred | Engineering | Phase 03 complete | Video runtime residual hardening validated | `evidence/unified-buildout/phase-04/` | Slice A/B completed; Slice D added queue-status read-only rollout control (flagged). Deferred by sequencing decision (Decision 008): canary/signoff intentionally postponed until deployment window. Keep `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=true` until canary completion. |
| 05 | Planned | Engineering | Phase 04 complete | Media hardening delivered with parity tests | `evidence/unified-buildout/phase-05/` | Slice A/B/C/D pre-entry prep implemented (preview trust policy + new `/api/media/upload` server path + hook migration behind flag + shared query model/prompt scope fix). Slice E pre-closeout parity packet prepared. Sequencing override active while Phase 04 is deferred (Decision 008). |
| 06 | In Progress | Engineering | Phase 05 complete | Character hardening delivered with perf guardrails | `evidence/unified-buildout/phase-06/` | Slice A/B/C complete: trust-hardened drop intake, cross-surface selected-character sync, signed URL chunking safety, progressive manage-list rendering contract (`0-50` smooth, `51-100` graceful with +25 expansion), and fail-closed stale/deleted character submission guard. Sequencing override active while Phase 04 is deferred (Decision 008). |
| 07 | In Progress | Engineering | Phase 06 complete | AI Studio boundary violations reduced to zero | `evidence/unified-buildout/phase-07/` | Slice A complete: pricing/model runtime ownership moved to `lib/model-runtime`, feature-side compatibility re-exports added, server imports repointed off `features/ai-studio`, and architecture checker extended for server/pages-api -> feature boundary. Slice B contract inversion complete: hook-owned page-content contracts + single page-boundary adapter landed. Slice B submission decomposition complete: queue polling/invariant/output patch seams extracted from `useAiStudioTaskSubmission`. Slice B polling decomposition complete: provider-state, polling schedule, output-lookup hard-stop, and background-recovery policies extracted from `useAiStudioTasks` into `hooks/taskPolling/*` with focused unit coverage and parity tests. Slice C docs/evidence closeout is complete for Phase 07 engineering scope. Sequencing override active while Phase 04 is deferred (Decision 008). Pre-existing size-budget warn target remains `frontend/features/ai-studio/hooks/useAiStudioState.ts` (701 > 650, warn mode). |
| 08 | Completed | Engineering | Phase 07 complete | Stripe idempotency/recovery correctness proven | `evidence/unified-buildout/phase-08/` | Completed: insert-first webhook claim semantics, replay-safe duplicate processing, idempotent ledger duplicate handling, bootstrap-safe checkout/portal customer mapping, failed-first replay runbook, and billing parity coverage updates. |
| 09 | Completed | Engineering | Phase 08 complete | Admin transitions/access correctness proven | `evidence/unified-buildout/phase-09/` | Completed: atomic admin incident status RPC migration (`039`), `/api/admin/errors-status` transactional RPC delegation, lifecycle edge coverage expansion (invalid-input mapping/array normalization/malformed fail-safe/exception logging), actionable `/api/admin/error-events` parse-failure reliability hardening, and `/api/admin/errors-status-bulk` listed-open resolve/ignore operator controls with parity tests. Human phase-exit checkpoint passed on 2026-02-27. |
| 10 | Completed | Engineering | Phase 09 complete | Residual security controls verified in staging | `evidence/unified-buildout/phase-10/` | Completed: webhook body caps + safe webhook error surfaces, describe-image fail-closed trusted-host policy, runtime SQL security audit integration, telemetry event-only regression guard, and grant-drift remediation migration (`040_harden_runtime_rpc_execute_grants.sql`). Staging audit evidence captured with clean summary (`total_checks=60`, `passing_checks=60`, `failing_checks=0`). |
| 11 | In Progress | Engineering | Phase 10 complete | Kie migration thresholds pass shadow/canary | `evidence/unified-buildout/phase-11/` | Slice A pre-cutover readiness packet added: shadow/canary template with explicit thresholds, observation windows, and promote/hold/rollback decision framing. Slice B is active: provider-neutral canonical payload identity parsing (request/event/status aliases) wired into Fal submit/webhook paths plus provider-aware recovery probe dispatch seam for future Kie adapter insertion. No provider cutover executed yet. |
| 12 | Planned | Engineering | Phase 11 complete | Cleanup/decommission complete + two green cycles | `evidence/unified-buildout/phase-12/` |  |

## Prior-Phase Cleanup Queue (Excluding Phase 04 Deferred)
1. Phase 00:
- Close operational credential-rotation follow-up with explicit evidence note.
2. Phase 01:
- Complete branch-protection mapping verification evidence for CI lane parity.
3. Phase 05:
- Promote from pre-entry prep to formal phase execution once sequencing gate allows; attach closeout packet.
4. Phase 06:
- Phase-level completion label update after sequencing unblock (`04` deferred hold resolved and `05` closeout complete).
5. Phase 07:
- Phase-level completion label update after sequencing unblock (`04`/`05`/`06` closure chain).

## Mandatory Validation Commands per Phase
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. Domain-specific test subsets for touched scope.
