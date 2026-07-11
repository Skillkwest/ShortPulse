# Next-Agent Handoff: Platform Perimeter And Observability

Lane id: `architecture-audit-12-platform-perimeter-observability`

Status: evidence-first. Perform a read-only production posture pass before proposing implementation.

## Copy/Paste Assignment

Verify the deployed perimeter, monitoring, redaction, backup, schedule, and runtime-cost posture of `https://www.shortpulse.ai`. Implement only confirmed gaps, in small independent phases. Do not duplicate platform controls that already exist outside the repository.

## Required Context

Read first:

- `AGENTS.md`, launch-week production operations, security checklist, incident/monitoring, backup, Vercel, and runtime SOPs
- current environment contract and retained production evidence, subject to freshness checks

Inspect first:

- Vercel project/domain/firewall/WAF/rate-limit configuration
- uptime/paging and incident-routing configuration
- Supabase backup/PITR status and restore evidence
- SMTP bounce/complaint handling
- worker schedules, secrets, probes, and deployed route health
- telemetry/logging/redaction and incident grouping code
- CSP, thumbnail proxying, ffmpeg routes, and function traces

## Known Evidence To Reverify

- Public thumbnail delivery has buffered responses in local code.
- Local trace inventory found 187 ffmpeg-related traces totaling about 45.6 MB; deployed function packaging and runtime impact were not proven.
- Repo code alone cannot prove WAF, paging, backup, SMTP, schedule, or provider-console posture.

## Phase 1 Deliverable

Produce a dated evidence matrix for each control: source of truth, deployed scope, configuration, last successful proof, unknown, risk, and recommended action. Distinguish absent, configured, enabled, tested, and observed-working.

## Candidate Implementation Phases

Proceed only when Phase 1 confirms the gap:

1. Shared application limiter only where verified WAF/platform coverage is insufficient.
2. Central structured telemetry redaction and secret/PII tests.
3. Atomic incident grouping/deduplication.
4. CSP inventory, report-only rollout, then nonce/hash enforcement.
5. Streaming/direct thumbnail delivery if access control permits.
6. ffmpeg route scoping or packaging reduction backed by deployed traces and budgets.

## Avoid Surface

- duplicate uptime or pager systems without proving a coverage gap
- app-wide security middleware added speculatively
- buffering large media in memory as a compatibility shortcut
- CSP enforcement before inventory/report-only evidence
- operational mutations during the evidence pass

## Acceptance Criteria

- Every perimeter/operations claim names a current source of truth and freshness.
- Unknown external-console state remains an unknown, not a repo-derived conclusion.
- Each implemented control has a failure test, rollback, owner surface, and production-safe proof.
- Logs and incidents do not expose secrets, tokens, raw provider payloads, or unnecessary customer data.
- Runtime/package changes are driven by deployed measurements.

## Validation And Proof

- Use production-safe read-only evidence first and label inaccessible consoles as blockers.
- Test redaction with synthetic secrets and PII.
- Measure response streaming, memory, cold start, package size, and route health before/after relevant changes.
- Keep backup configuration proof separate from a successful restore exercise.

## Stop Rules

- Stop before changing WAF, DNS, monitoring, backup, schedules, secrets, deploys, or provider configuration without authority.
- Do not claim production coverage from local code/tests.
- Do not introduce a second control when an existing platform control can be repaired or documented.

