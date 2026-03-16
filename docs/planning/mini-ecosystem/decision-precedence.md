# Decision Precedence

Purpose: resolve role-hat conflicts quickly and consistently when one operator is wearing all roles.

Status: Working, non-authoritative planning/lab policy.

## Precedence order (highest to lowest)
1. Security and compliance constraints.
2. Data integrity and user isolation requirements.
3. Release safety and rollback viability.
4. Correctness against acceptance criteria.
5. Maintainability and architecture quality.
6. UX/polish improvements.
7. Speed/throughput preference.

## Conflict rules
- If a higher-precedence concern conflicts with a lower one, higher wins.
- If same-precedence concerns conflict, choose the lower-risk option and record a short rationale.
- If risk remains unclear, mark gate `HOLD` and collect missing evidence before deciding.

## Mandatory blockers
The following can always block progression:
- Security reviewer on auth/privacy/data-exposure risk.
- Platform/release on rollback-unavailable deployment risk.
- QA on reproducible critical-path regression.
- Senior engineer on severe correctness or stability risk.

## Decision note format
Record conflicts as:
- Context:
- Conflicting hats:
- Precedence rule applied:
- Decision:
- Follow-up action:
