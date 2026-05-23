# Handoff: Nuclo Branch Instruction Reconciliation

Owner: Nuclo

## Problem

Nuclo has the most important stale instruction drift in the non-security audit. Some active Nuclo surfaces still describe the ladder-era model while newer repo policy says the current pre-launch phase is production-only. Nuclo does include a current production-only override, but the older branch model remains prominent enough to confuse future runs.

## Evidence

- Root `AGENTS.md` now says all pre-launch work is on local and GitHub `production`.
- `docs/agents/nuclo/README.md` still lists primary branch ladder surfaces:
  - `working-development`
  - `staging-preview`
  - `production`
- `docs/agents/nuclo/README.md` operating guardrails still say to map:
  - `working-development` -> development lane
  - `staging-preview` -> staging lane
  - `production` -> production lane
- `docs/agents/nuclo/memory.md` includes both:
  - `Branch ladder rule: working-development -> staging-preview -> production`
  - `Standing user branch rule: during the current pre-launch phase, work only on production`
- `docs/agents/nuclo/memory.md` now also has a May 23 note that production-only overrides the older local branch default.

## Requested Cleanup

1. Make Nuclo's active contract lead with the current pre-launch production-only rule.
2. Move the ladder-era branch model into historical/contextual language unless it is still needed for environment mapping.
3. Update `environment-ledger-template.md` if it reads like current branch-operating instruction rather than environment reference.
4. Keep environment topology clear: production-only branch work does not mean all environments are the same.
5. Do not rewrite historical reports; add top-level current-context notes instead.

## Validation

- Run `npm -C frontend run docs:check`.
- Search Nuclo active surfaces for `working-development` and confirm each remaining mention is historical or environment-reference, not current work instruction.
