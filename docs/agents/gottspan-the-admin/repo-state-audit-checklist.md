# Gottspan Repo-State Audit Checklist

Purpose: give Gottspan a compact repeatable checklist for repo-steward audits so branch posture, worktree drift, docs integrity, and ownership gaps are reviewed in a consistent order.

## When to use this

Use this checklist when:

- the user asks for a repo audit
- the user asks Gottspan to manage the repo
- branch/worktree posture may be part of the risk
- docs/SOP governance may be drifting
- a broad stewardship pass is needed before implementation

## Phase 1. Repo posture

1. Confirm task mode:
- no-edit audit
- implementation
- mixed audit + fix

2. Check current branch:
- `git branch --show-current`

3. Check enforced branch contract:
- `git config --local --get shortpulse.allowedBranch`

4. Check worktree state:
- `git status --short`

5. Check workspace safety posture before broad commands:
- generated artifact directories present
- unexpected large backup directories inside repo

## Phase 2. Governing docs

1. Load:
- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/README.md`
- `docs/troubleshooting.md`
- `docs/glossary.md`
- scoped `frontend/AGENTS.md` and `docs/AGENTS.md`

2. Load task-specific docs only after the lane is classified.

## Phase 3. Risk classification

Ask:

1. Is branch/worktree posture itself a risk?
2. Is this really a docs/SOP governance issue?
3. Is this really an admin subsystem issue?
4. Does this belong to a specialized agent instead?
5. Is the evidence strong enough to justify a repo-level conclusion?

## Phase 4. Repo integrity checks

Review only the surfaces relevant to the lane, but consider these common checks:

- docs index drift
- route/SOP mismatch
- agent contract/memory/artifact mismatch
- missing retained artifact surfaces for important agents
- release-path contradictions
- dirty protected/release branch posture
- hidden ownership gaps between agents

## Phase 5. Stewardship action

Prefer the smallest durable action that reduces repo risk:

- rewrite or tighten a contract
- add a missing SOP
- add or repair an index entry
- add a retained evidence packet
- add a role-specific checklist or template
- hand off explicitly to Gear Ball, Nuclo, Copperknot, or Ophestivus

## Phase 6. Validation

Before closing:

1. Verify changed docs exist and resolve.
2. Verify required indexes point to them.
3. Run relevant docs checks when available.
4. State any blocked validation clearly.
5. State unresolved repo risk explicitly.

## Minimum closeout

A Gottspan repo-state audit is not done until the final output includes:

- current branch posture
- worktree posture
- the highest-risk finding
- what was changed or preserved
- what remains unresolved
- the next best stewarded action
