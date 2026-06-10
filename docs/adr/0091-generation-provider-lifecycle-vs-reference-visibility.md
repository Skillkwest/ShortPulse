# ADR 0091: Generation Provider Lifecycle Versus Reference Visibility

## Status

Accepted

## Date

2026-06-10

## Context

AI Studio generated media must survive browser refresh, project switching, route navigation, and closed sessions after a provider has accepted the job. Production evidence showed Kie jobs that succeeded at the provider but stayed as spinning Reference Grid cards after the user left and later reopened the project.

The root problem was lifecycle authority drift. The `/api/generation/abandon` compatibility route treated a Reference Grid visibility action as a terminal lifecycle decision: active `ai_generations` rows could be marked `fail`, stamped `failure_reason_code='user_abandoned'`, exhausted from recovery, and hidden from projection/publication surfaces while the provider job continued to run. Later provider success could not converge because normal transition guards block arbitrary `fail -> success` recovery.

## Decision

Provider lifecycle and Reference Grid visibility are separate authorities.

- Provider-accepted jobs remain server-recoverable until provider terminal success, provider terminal failure, or a future confirmed provider-canceled state.
- Browser navigation, refresh, project switch, page close, and session cleanup are not terminal generation lifecycle authority.
- Reference Grid hide/delete actions may suppress projection/publication visibility, but they must not set `ai_generations.status='fail'`, `failure_reason_code='user_abandoned'`, `recovery_state='exhausted'`, or mark attempts `abandoned` for provider-running jobs.
- `generation_abandonments` is legacy cancellation/suppression evidence only. It is not proof that the provider canceled a job.
- Provider terminal success with media may recover legacy `fail/user_abandoned` rows when no explicit provider-canceled marker or newer provider failure evidence exists.
- Provider terminal failure must produce a project-visible error reference unless the user explicitly suppressed that output.
- Project reopen reconcile must include project-bound recoverable rows even when their current projection is hidden or legacy-abandoned.

## Terms

- **Provider accepted**: ShortPulse has a durable provider request id for an `ai_generations` row.
- **Provider terminal success**: provider probe/webhook/status response proves completion and yields media or a terminal success payload.
- **Provider terminal failure**: provider probe/webhook/status response proves failure, policy block, timeout, or non-recoverable terminal error.
- **Provider canceled**: provider confirms cancellation. Reference Grid removal alone is not this state.
- **Reference-grid suppressed**: ShortPulse hides a projection/publication from Reference Grid surfaces without changing provider lifecycle.
- **User removed from view**: explicit UI action to hide/delete/detach the output card.
- **Abandoned legacy row**: old ShortPulse state where local UI cleanup stamped `user_abandoned` or wrote `generation_abandonments` without provider cancellation proof.

## Consequences

The canonical recovery path remains the existing server-owned pipeline:

1. Submit writes durable generation, attempt, projection, billing, and project association state.
2. The provider request id attaches to the generation.
3. Webhook, scheduler, and authenticated reconcile call the shared recovery engine.
4. Recovery probes provider state, persists outputs, settles billing, updates projection/publication, and associates project output.
5. AI Studio project hydration renders the recovered Reference Grid state.

No duplicate worker or client-only completion path is introduced. Legacy data repair must call the canonical recovery engine instead of writing media/projection rows directly. Production repair execution still requires explicit operator approval.

## Validation

- Unit/API tests must prove active visibility suppression preserves generation lifecycle.
- Recovery tests must prove `user_abandoned + provider success with media` can recover, while real provider failures still block success override.
- Reconcile tests must prove project reopen includes hidden legacy recoverable rows.
- Provider failure tests must prove an unsuppressed project-bound failure produces a visible error reference.
- Hosted scheduler/cron health remains an operational proof item, not a reason to add a second generation pipeline.
