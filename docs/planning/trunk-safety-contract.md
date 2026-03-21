# Trunk Safety Contract

Last updated: 2026-03-20  
Status: Active (implementation-governed)  
Owner: Engineering

## Purpose

Define one canonical contract for high-concurrency AI agent development in ShortPulse so trunk integrity, security posture, and delivery throughput stay stable under parallel work.

This document is the source of truth for:
- required-check behavior and CI gate semantics,
- worktree and branch isolation policy,
- AI ownership/provenance controls,
- exception handling and rollback criteria.

## Scope

In scope:
- GitHub PR/branch governance and required checks.
- GitHub Actions trigger and gate semantics for PR + merge queue readiness.
- Local agent operating model (worktrees, branch naming, cleanup).
- Secret-control layers and high-risk path ownership.
- Evidence and waiver refresh requirements.

Out of scope:
- Product feature requirements.
- Database schema design decisions not tied to governance enforcement.
- Mini Ecosystem governance (`mini-ecosystem/` is out of default scope).

## Authority Chain

This contract governs and must remain synchronized with:
- `docs/planning/ci-policy-checks.md`
- `docs/release-checklist.md`
- `docs/contributor-guide.md`
- `docs/security-checklist.md`
- `docs/planning/evidence/docs/2026-02-20-branch-protection-required-check-mapping.md`
- `docs/planning/evidence/docs/2026-02-21-stg-06-prototype-waiver.md`
- `.github/workflows/ci.yml` and any dedicated gate workflow (`ci-gate.yml` when introduced)

If conflicts exist, this contract is authoritative for trunk governance intent; implementation docs must be patched in the same PR.

## Core Operating Model

Baseline model:
1. One agent session maps to one isolated worktree.
2. One worktree maps to one short-lived branch.
3. One branch maps to one focused PR.
4. Trunk (`main`) accepts changes only through PR + required checks.

Branch naming standard:
- `agent/<agent_id>/<ticket-or-slice>-<slug>` for AI-agent sessions.
- `feature/<topic>` or `fix/<topic>` remain allowed for human-led work.

## Capability Proof Contract

Repository plan and enforceability must be treated as runtime facts, not assumptions.

Required practice:
1. Capture capability evidence before changing branch/ruleset policy.
2. Record:
- repo visibility + owner type,
- ruleset/protection endpoint reachability,
- currently enforceable required checks,
- merge-queue eligibility state.
3. Store output under `docs/planning/evidence/docs/` with date-stamped packet naming.

Current posture note:
- Prototype waiver remains valid until enforceable private-repo protections are confirmed and recorded in evidence.

## Required Check Contract

Target enforcement model:
1. Exactly one required check for trunk admission: `ci_gate` (stable check-run name).
2. `ci_gate` must always run and always report on:
- `pull_request`
- `merge_group` (when merge queue is enabled)
3. Conditional test selection is allowed only inside jobs, not by skipping required workflows at trigger level.

Hard constraints:
- A required workflow must not rely on workflow-level `paths`/`paths-ignore` semantics.
- The required gate job must use an always-run posture (`if: always()` equivalent).
- Gate logic must fail in enforce mode on any failed/cancelled upstream blocking job.

Warn/enforce policy:
- PR events may run warn-mode for designated governance checks where documented.
- Merge-group events must run enforce-mode for trunk-protection checks once merge queue is active.

## Merge Queue Contract

Merge queue adoption is allowed only when all conditions below are true:
1. Required checks are stable and mapped to exact job names.
2. Required-check workflows include `merge_group` trigger support.
3. First-pass queue dry-run matrix is completed and documented:
- docs-only change,
- conditional job skip path,
- failing blocking job,
- cancelled run path,
- rerun path.
4. Rollback steps are documented and tested.

Rollback-ready posture:
- Disabling merge queue must not require reverting core CI logic.
- `merge_group` trigger support should remain in workflows after rollback for rapid re-enable.

## Worktree Operations Contract

Policy:
1. Do not run multiple agent sessions in a single working directory.
2. Use one worktree directory per agent branch.
3. Remove stale worktrees after merge/abandon.
4. Keep dev server ports unique per active worktree.

Operational defaults:
- Use deterministic branch naming (`agent/...`).
- Use scripted `up/down/prune` helpers when available.
- Keep local worktree metadata clean (`git worktree prune` cadence).

## AI Ownership And Provenance Contract

Every AI-assisted PR must include:
1. Agent/tool identity.
2. Risk tags (at minimum: `ci-config`, `auth`, `sql`, `billing`, `security`, `refactor-broad` as applicable).
3. Validation evidence matching touched risk surfaces.
4. Explicit note when high-risk paths are modified.

High-risk surfaces requiring stricter review ownership:
- `.github/workflows/**`
- `docs/planning/ci-policy-checks.md`
- auth and security boundary code paths
- SQL migrations and security check scripts

## Secrets Defense Contract

Secret controls must be layered:
1. Local boundary checks (pre-commit/pre-push scanners where configured).
2. CI secret scan gate (`scripts/check_secret_exposure.js` and successors).
3. Platform controls (secret scanning/push protection where available).
4. Environment scoping and least-privilege secret access.

Minimum trunk rule:
- Any enforce-mode secret gate failure blocks merge.

## Exception And Bypass Governance

Exceptions are allowed only with all fields present:
1. Owner.
2. Reason.
3. Scope (exact files/checks/policy being bypassed).
4. Expiration trigger/date.
5. Linked evidence packet.

Bypass events must be logged in planning evidence and called out in closeout notes for the affected lane/slice.

## Rollback Contract

If trunk safety controls cause operational blockage:
1. Revert to last known good required-check mapping.
2. Preserve evidence of failure mode and exact rollback action.
3. Open a bounded remediation slice before re-promoting enforcement.

Never roll back by silently removing governance without evidence updates.

## Implementation Stages

Stage A (adoption):
- Contract published and indexed.
- Current-vs-target governance state documented.

Stage B (normalization):
- Required-check mapping stabilized.
- Gate behavior consolidated under one required `ci_gate` contract.
- Worktree policy documented and used by contributors/agents.

Stage C (strict trunk controls):
- Merge queue enabled (when eligible).
- `merge_group` enforcement active.
- Exception flow remains explicit and auditable.

## Acceptance Criteria

This contract is considered operational when:
1. CI policy docs reference this contract and stay in parity.
2. Required-check mapping is explicit, stable, and evidence-backed.
3. Every AI-assisted high-risk PR includes provenance and validation evidence.
4. Waiver status is current and dated.
5. Docs index entries remain synchronized for discoverability.

## Change Control

Any PR changing this contract must also update:
- `docs/planning/ci-policy-checks.md` when check semantics change,
- evidence docs when enforceability or waiver posture changes,
- release checklist entries when operator workflow changes.

No silent contract drift is allowed.
