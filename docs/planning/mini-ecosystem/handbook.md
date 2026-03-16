# Mini Ecosystem Handbook

Purpose: explain exactly how to operate the Real Environment Delivery mini ecosystem as a solo operator wearing multiple professional hats.

Status: Working, non-authoritative planning/lab handbook.

## Who this is for
- You, as a single operator who wants a production-style process.
- Future contributors who need to follow your workflow without guessing.

## What this handbook gives you
- A repeatable path for feature work (`request -> release -> feedback`).
- A repeatable path for health audits of the current codebase.
- Clear gate decisions (`A-E`) and role-hat responsibilities.
- Lightweight checklist artifacts so rigor stays practical.

## Core map (read in this order)
1. `mini-production-sop.md` (governing rules)
2. `workflow-feature-delivery.md` (new work flow)
3. `workflow-codebase-audit.md` (weekly quality flow)
4. `decision-precedence.md` (conflict resolver)
5. `definition-of-done.md` (completion contract)
6. `cadence-and-rituals.md` (operating rhythm)
7. `performable-core/README.md` (future execution-grade contract layer)

## Golden rules
- Always declare the active hat before making gate decisions.
- Do not skip gates; mark `PASS`, `HOLD`, or `FAIL` explicitly.
- Use checklist templates first; keep notes short and factual.
- If a higher-priority risk exists (security/release/correctness), stop and resolve before progressing.

## Gate model quick reference
- Gate A: Ready to implement.
- Gate B: Ready for review.
- Gate C: Ready to merge.
- Gate D: Ready to release.
- Gate E: Release complete.

Gate outcomes:
- `PASS`: criteria satisfied.
- `HOLD`: blocked by unresolved concern.
- `FAIL`: currently unsafe/unfit to continue.

## Hat model quick reference
Use these hats during each flow:
1. Product
2. Engineer
3. Senior Engineer
4. QA Engineer
5. Platform/Release
6. Security Reviewer
7. Product Design

Full role contracts live under `team-model/roles/`.

## How to run feature delivery
1. Start with `templates/feature-intake-template.md` as Product hat.
2. Decide Gate A (`PASS/HOLD/FAIL`).
3. Use `templates/implementation-pr-template.md` as Engineer hat.
4. Decide Gate B.
5. Use `templates/review-template.md` as Senior Engineer hat.
6. Confirm CI status and decide Gate C.
7. Use `templates/qa-release-template.md` as QA + Product Design + Platform hats.
8. Decide Gate D.
9. Roll out with controlled method and observe runtime behavior.
10. Use `templates/post-release-template.md` as Platform hat.
11. Decide Gate E and log follow-up work.

## How to run weekly codebase audit
1. Start with `templates/codebase-audit-template.md`.
2. Fill each role section in order:
   - Product -> Engineer -> Senior Engineer -> QA -> Platform -> Security -> Product Design.
3. Assign gate outcomes for A-E in audit context.
4. Rank findings (`high/medium/low`).
5. Convert top findings into dated remediation actions.
6. Set next audit date.

## Recommended operating cadence
- Per feature:
  - Gate A at kickoff.
  - Gate C before merge decision.
  - Gate D before release.
  - Gate E after observation window.
- Weekly:
  - One full codebase audit packet.
- Monthly:
  - One process tune-up to remove friction and improve templates.

## Decision conflicts: what to do
If two hats disagree:
1. Open `decision-precedence.md`.
2. Apply precedence order (security/release/data integrity first).
3. Record a short decision note.
4. If uncertain, mark gate `HOLD` and collect missing information.

## Definition of done: practical interpretation
A change is done when:
- Gates A-E are resolved to `PASS`, or
- Any deferral is explicitly non-critical with owner/date documented.

A change is not done when:
- Gate C, D, or E remains unresolved.
- Critical security/reliability issue is still open.

## Which template to use and when
- New request appears: `feature-intake-template.md`
- Building and preparing PR: `implementation-pr-template.md`
- Technical review and merge readiness: `review-template.md`
- Staging verification and release prep: `qa-release-template.md`
- Production observation and closeout: `post-release-template.md`
- Weekly quality pass: `codebase-audit-template.md`

## How detailed notes should be
Use this standard:
- Checklist items: always complete.
- Notes: 1-3 concise bullets per section.
- Evidence links: optional.
- Avoid long narrative unless needed for risk clarity.

## Troubleshooting process friction
Common issues and fixes:
- "Too much overhead"
  - Keep checklists, shorten notes, and skip optional commentary.
- "Unclear decision"
  - Use precedence rules and mark `HOLD` instead of guessing.
- "Gates feel repetitive"
  - Merge duplicate checklist items during monthly tune-up.
- "I keep skipping audits"
  - Timebox weekly audit to 30 minutes and only log top three risks.

## First-week adoption guide
Day 1:
- Read core map docs and role charters.
- Run one feature through Gate A and B only.

Day 2-3:
- Complete one full feature flow through Gate E.

Day 4-5:
- Run one full codebase audit packet.
- Capture top remediation tasks with owner/date.

End of week:
- Review what felt heavy or unclear.
- Update templates/checklists for less friction.

## What stays separate from canonical SOPs
This ecosystem is planning/lab guidance and remains non-authoritative until promoted.

Current separation boundary:
- Location: `docs/planning/mini-ecosystem/`
- No production runtime behavior depends on these docs.
- No automatic promotion to `docs/sops/` without deliberate decision.

## Maintenance checklist for this handbook
- [ ] Keep links to templates and workflows current.
- [ ] Keep gate definitions aligned with `mini-production-sop.md`.
- [ ] Keep role list aligned with `team-model/roles/`.
- [ ] Update cadence guidance if your working rhythm changes.

## Future activation note
When you are ready to shift from manual checklist operation to performable role execution, use:
- `performable-core/finding-and-packet-schema.md`
- `performable-core/severity-and-gate-policy.md`
- `performable-core/role-execution-contracts.md`
- `performable-core/orchestration-contract-inactive.md`
- `performable-core/activation-readiness-checklist.md`
