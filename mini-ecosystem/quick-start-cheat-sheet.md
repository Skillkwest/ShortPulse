# Quick Start Cheat Sheet (5-Minute)

Purpose: fast reference for running the mini ecosystem without reading the full handbook first.

Status: Active standalone operational quick-start.

## 60-second setup
1. Open `mini-production-sop.md`.
2. Open `workflow-feature-delivery.md` (for new requests) or `workflow-codebase-audit.md` (for weekly audit).
3. Open the matching template from `templates/`.
4. Declare your active hat before each gate decision.

## Pick your flow
- New feature/request: use Feature Delivery flow.
- Weekly health pass: use Codebase Audit flow.

## Feature flow in 11 steps
1. Product hat -> `feature-intake-template.md`.
2. Gate A decision (`PASS/HOLD/FAIL`).
3. Engineer hat -> `implementation-pr-template.md`.
4. Gate B decision.
5. Senior Engineer hat -> `review-template.md`.
6. Confirm CI status.
7. Gate C decision.
8. QA + Product Design + Platform hats -> `qa-release-template.md`.
9. Gate D decision.
10. Platform hat -> `post-release-template.md` after observation window.
11. Gate E decision and follow-up actions.

## Weekly audit flow in 6 steps
1. Open `codebase-audit-template.md`.
2. Fill sections by hat order:
   Product -> Engineer -> Senior Engineer -> QA -> Platform -> Security -> Product Design.
3. Mark gate outcomes A-E.
4. Rank findings high/medium/low.
5. Create dated remediation actions.
6. Set next audit date.

## External execution flow in 5 steps
1. Complete gate framing inside Mini Ecosystem.
2. Fill `external-agent-controller-export-template.md`.
3. Start external conversation with role starter template.
4. Require output using `external-agent-return-packet-template.md`.
5. Convert recommendation into final gate decision and record it.

## Gate meanings
- A: Ready to implement.
- B: Ready for review.
- C: Ready to merge.
- D: Ready to release.
- E: Release complete.

Decision values:
- `PASS` = proceed.
- `HOLD` = blocked, needs action.
- `FAIL` = unsafe, stop.

## Hat-switching rules
- Say the active hat out loud/in notes.
- Complete that hat's checklist before changing hats.
- If hats conflict, use `decision-precedence.md`.
- If uncertain, choose `HOLD` and gather missing info.

## Definition of done (shortcut)
Work is done when Gates A-E are resolved and no critical unresolved risk remains.

## If you only do three things
1. Never skip a gate decision.
2. Never skip post-release notes.
3. Run one codebase audit every week.

## Reference docs
- Full manual: `handbook.md`
- External export contract: `agent-export-contract.md`
- Conflict rules: `decision-precedence.md`
- Completion contract: `definition-of-done.md`
- Operating rhythm: `cadence-and-rituals.md`
