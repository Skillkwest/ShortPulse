# Architecture Audit Agent Handoffs

Status: active dispatch library; individual packets remain gated by their Freshness Gate.

Purpose: convert the July 2026 read-only architecture audit into bounded, copy/paste-ready execution lanes without turning every observation into a separate project.

## Authority And Use

- `AGENTS.md`, current scoped instructions, ADRs, SOPs, current code, and current production evidence outrank these packets.
- These packets are scope snapshots, not permission to deploy, apply hosted SQL, spend provider credits, delete customer data, or bypass launch-week production rules.
- A dedicated agent owns one packet at a time. Dedicated does not mean concurrent mutation on the shared `production` worktree.
- Before dispatch, finish or explicitly checkpoint overlapping work. On 2026-07-11 the tree already contained active SQL-security, pricing, generation, media-upload-intent, Kanban, and AI Studio changes.
- Do not infer that every packet is ready merely because it exists. Use the sequence and dependency table below.

## Universal Freshness Gate

Every receiving agent must do all of the following before editing:

1. Load the current root and scoped `AGENTS.md` files plus the repo startup spine.
2. Confirm `production` and `git config --local shortpulse.allowedBranch=production`.
3. Run the generated-artifact safety check before broad commands.
4. Capture `git status --porcelain=v1 -z -uall` and identify overlapping files.
5. Re-open every owning source seam named in the packet.
6. Inspect current tests and any newer plan, ADR, migration, or closeout touching the lane.
7. Classify each packet assertion as current, changed, or already resolved.
8. Stop and return `blocked with evidence` if another active batch owns the same canonical seam.

Do not “work around” overlap by creating a parallel implementation, legacy path, fallback, duplicate helper, or alternate table.

## Dispatch Sequence

| Rank | Lane                                      | Packet                                                                                       | Dispatch state                              |
| ---: | ----------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- |
|   00 | Hosted SQL delivery safety                | [`00-hosted-sql-delivery-safety.md`](00-hosted-sql-delivery-safety.md)                       | First prerequisite; currently overlap-gated |
|   01 | Stripe webhook inbox                      | [`01-stripe-webhook-inbox.md`](01-stripe-webhook-inbox.md)                                   | After 00 for schema work                    |
|   02 | Agent safety trust boundaries             | [`02-agent-safety-trust-boundaries.md`](02-agent-safety-trust-boundaries.md)                 | High priority; can run after overlap clears |
|   03 | Durable generation command                | [`03-durable-generation-command.md`](03-durable-generation-command.md)                       | High priority; currently overlap-gated      |
|   04 | Project workspace revision authority      | [`04-project-workspace-revision-authority.md`](04-project-workspace-revision-authority.md)   | High priority after 00                      |
|   05 | Billing entitlement and pricing authority | [`05-billing-entitlement-pricing-authority.md`](05-billing-entitlement-pricing-authority.md) | After 01; currently overlap-gated           |
|   06 | Auth session and identity projection      | [`06-auth-session-identity-projection.md`](06-auth-session-identity-projection.md)           | After customer-access invariants are fresh  |
|   07 | Voice trust and deletion                  | [`07-voice-trust-and-deletion.md`](07-voice-trust-and-deletion.md)                           | Narrow high-ROI lane                        |
|   08 | Privacy data lifecycle                    | [`08-privacy-data-lifecycle.md`](08-privacy-data-lifecycle.md)                               | Design-first; no destructive execution      |
|   09 | Worker leases and scheduler outcomes      | [`09-worker-leases-and-scheduler-outcomes.md`](09-worker-leases-and-scheduler-outcomes.md)   | After 03 identity decisions                 |
|   10 | Generated-media convergence               | [`10-generated-media-convergence.md`](10-generated-media-convergence.md)                     | After 04 response contract                  |
|   11 | Model lifecycle governance                | [`11-model-lifecycle-governance.md`](11-model-lifecycle-governance.md)                       | Runtime gate first; pricing excluded        |
|   12 | Platform perimeter and observability      | [`12-platform-perimeter-observability.md`](12-platform-perimeter-observability.md)           | Read-only production proof first            |
|   13 | CI, tests, and API boundaries             | [`13-ci-test-api-boundaries.md`](13-ci-test-api-boundaries.md)                               | Phased foundation lane                      |
|   14 | Accessibility and measured performance    | [`14-accessibility-performance-debt.md`](14-accessibility-performance-debt.md)               | Isolated fixes first; broad work measured   |

## Concurrency Policy

- Parallel read-only investigation is allowed.
- Mutation lanes should be serialized on `production` unless the user explicitly approves disjoint parallel work after exact file manifests are compared.
- Lanes 01, 03, and 05 all approach money/generation seams and must not edit `generationBilling.ts`, `falSubmitProxy.ts`, pricing policy, or shared SQL concurrently.
- Lanes 04 and 10 share restore/materialization consumers. Finish the revision/response contract before media convergence changes.
- Lanes 03 and 09 share execution ownership. Define durable generation identity before designing generic leases or admission slots.
- Lanes 07 and 08 share deletion/privacy policy. Voice deletion may ship independently, but privacy erasure must consume its final deletion receipt contract.

## Required Closeout

Each agent must return exactly one status:

- `bounded patch complete`
- `findings/design packet complete`
- `blocked with evidence`

The closeout must include:

- source packet path and lane id;
- freshness and overlap result;
- files changed;
- migrations added or applied status;
- behavior preserved;
- acceptance criteria reached;
- validation commands and results;
- local versus production proof;
- self-audit findings;
- residual risk;
- exact next action.

Do not mark a lane complete merely because local tests passed when hosted apply, deploy, production readback, provider evidence, or destructive approval is still outstanding.
