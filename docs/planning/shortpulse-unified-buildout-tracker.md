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
| 04 | In Progress | Engineering | Phase 03 complete | Video runtime residual hardening validated | `evidence/unified-buildout/phase-04/` | Slice A/B completed; Slice D added queue-status read-only rollout control (flagged). Canary readiness + execution-log template committed. Regression refresh (Phase 04/05 gates) is green; staged canary execution/signoff intentionally deferred until pre-deploy window (keep `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=true` until canary run). Latest execution attempt from local shell is blocked by Vercel deployment protection (all probe responses `401`); baseline helper now supports `--vercel-bypass-token` and queue-status probe query defaults for next execution window. |
| 05 | Planned | Engineering | Phase 04 complete | Media hardening delivered with parity tests | `evidence/unified-buildout/phase-05/` | Slice A/B/C/D pre-entry prep implemented (preview trust policy + new `/api/media/upload` server path + hook migration behind flag + shared query model/prompt scope fix). Slice E pre-closeout parity packet prepared; full phase entry/closure still gated on Phase 04 canary signoff |
| 06 | In Progress | Engineering | Phase 05 complete | Character hardening delivered with perf guardrails | `evidence/unified-buildout/phase-06/` | Slice A/B/C complete: trust-hardened drop intake, cross-surface selected-character sync, signed URL chunking safety, progressive manage-list rendering contract (`0-50` smooth, `51-100` graceful with +25 expansion), and fail-closed stale/deleted character submission guard. Phase exit is sequencing-blocked until Phase 04 canary signoff and Phase 05 closeout are completed. |
| 07 | In Progress | Engineering | Phase 06 complete | AI Studio boundary violations reduced to zero | `evidence/unified-buildout/phase-07/` | Slice A complete: pricing/model runtime ownership moved to `lib/model-runtime`, feature-side compatibility re-exports added, server imports repointed off `features/ai-studio`, and architecture checker extended for server/pages-api -> feature boundary. Slice B contract inversion complete: hook-owned page-content contracts + single page-boundary adapter landed. Slice B submission decomposition complete: queue polling/invariant/output patch seams extracted from `useAiStudioTaskSubmission`. Slice B polling decomposition complete: provider-state, polling schedule, output-lookup hard-stop, and background-recovery policies extracted from `useAiStudioTasks` into `hooks/taskPolling/*` with focused unit coverage and parity tests. Slice C docs/evidence closeout is complete for Phase 07 engineering scope; phase completion labeling remains sequencing-blocked until earlier in-progress phases (`04`/`05`/`06`) close. Pre-existing size-budget warn target remains `frontend/features/ai-studio/hooks/useAiStudioState.ts` (701 > 650, warn mode). |
| 08 | Planned | Engineering | Phase 07 complete | Stripe idempotency/recovery correctness proven | `evidence/unified-buildout/phase-08/` |  |
| 09 | Planned | Engineering | Phase 08 complete | Admin transitions/access correctness proven | `evidence/unified-buildout/phase-09/` |  |
| 10 | Planned | Engineering | Phase 09 complete | Residual security controls verified in staging | `evidence/unified-buildout/phase-10/` |  |
| 11 | Planned | Engineering | Phase 10 complete | Kie migration thresholds pass shadow/canary | `evidence/unified-buildout/phase-11/` |  |
| 12 | Planned | Engineering | Phase 11 complete | Cleanup/decommission complete + two green cycles | `evidence/unified-buildout/phase-12/` |  |

## Mandatory Validation Commands per Phase
1. `npm -C frontend run lint`
2. `npm -C frontend run type-check`
3. `npm -C frontend run build`
4. `npm -C frontend run docs:check`
5. Domain-specific test subsets for touched scope.
