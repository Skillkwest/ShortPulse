# Template: External Agent Controller Export

Date:
Run ID:
Scope label:
Source request:
Target gate:

## Control-plane decisions
- [ ] Gate A decision exists.
- [ ] Acceptance criteria are explicit and testable.
- [ ] In-scope and out-of-scope are declared.
- [ ] Hard stops are declared.
- [ ] Required validations are declared.

## Role target
- Execution role:
- Role starter template path:
- Expected output packet path:

## Task packet
Objective:
In scope:
Out of scope:
Acceptance criteria:
Risks and constraints:
Required files/areas:

## Validation contract
Commands required:
- [ ] Command 1:
- [ ] Command 2:
- [ ] Command 3:
Pass criteria:
Fallback rules (if command unavailable):

## Output contract
- [ ] External agent must return packet using `external-agent-return-packet-template.md`.
- [ ] Include explicit gate recommendation (`PASS|HOLD|FAIL`).
- [ ] Include blockers and next-owner/date when not `PASS`.

## Dispatch note
Conversation starter text:

