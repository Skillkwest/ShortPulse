# Agent Instructions (Mini Ecosystem)

Scope: `mini-ecosystem/`.

Purpose: keep this system execution-grade, role-based, and operationally strict.

## Non-negotiable constraints
- No simulation artifacts.
- No rehearsal scenarios.
- No fabricated records.
- No "practice mode" workflows in this area.

## Separation boundary
- This system stays standalone under `mini-ecosystem/`.
- Do not move Mini Ecosystem docs back into `docs/planning/`.
- Do not treat Mini Ecosystem docs as canonical runtime SOPs unless explicitly promoted.

## Required workflow discipline
- Use `mini-production-sop.md` as the governing contract.
- Use the gate model `A-E` with outcomes `PASS|HOLD|FAIL`.
- Every gate decision must be explicit; no implicit progression.
- If any gate is `HOLD` or `FAIL`, record blocker, owner, and next action before continuing.

## Required role order for codebase audits
1. Product
2. Engineer
3. Senior Engineer
4. QA Engineer
5. Platform/Release
6. Security Reviewer
7. Product Design

## Required artifacts per feature flow
- Feature intake packet
- Implementation/PR packet
- Review packet
- QA/release packet
- Post-release packet

Use templates under `mini-ecosystem/templates/`.

## Operations records contract
- Real execution records only.
- Store records under `mini-ecosystem/operations-records/`.
- File names must use one of:
  - `YYYY-MM-DD-<scope>-gate-packet.md`
  - `YYYY-MM-DD-<scope>-audit-packet.md`
  - `YYYY-MM-DD-<scope>-escalation-note.md`

## Editing policy
- Keep changes scoped to Mini Ecosystem unless explicitly requested otherwise.
- Preserve checklist-first structure.
- Keep notes short, factual, and decision-oriented.
