# Agent Export Contract (v1)

Purpose: define how Mini Ecosystem decisions are exported into executable instruction packets for real work in separate agent conversations.

Status: Active standalone operational contract.

## Intent
- Mini Ecosystem remains the control plane for role/gate decisions.
- External agent conversations are execution planes for real repository work.
- Every export must be traceable back to gate decisions and acceptance criteria.

## Trigger contract
When operator intent is: "Run it through the Mini Ecosystem," execute this sequence:
1. Run intake and gate decisions inside Mini Ecosystem.
2. Produce an export packet from template.
3. Launch external execution conversation using role starter template.
4. Require return packet with validation outcomes and gate recommendation.
5. Record final gate decision in `operations-records/`.

## Export bundle (required)
1. Conversation starter (role-specific behavior contract).
2. Task packet (scope, acceptance criteria, constraints, risk controls).
3. Validation contract (commands and pass/fail criteria).
4. Output contract (return packet schema).
5. Gate target (which gate this run can satisfy).

## Default operating assumptions
- Primary external target: coding agent conversation for real repository edits.
- Allowed autonomy default: analyze + edit + run relevant checks + commit.
- Human confirmation required for production operations and irreversible actions.
- Missing mandatory inputs always yields `HOLD`.

## Hard stop rules
The external run must return `HOLD` or `FAIL` immediately if any are true:
- Acceptance criteria are ambiguous or contradictory.
- Required validation commands cannot be run and no safe fallback exists.
- Security/privacy/data-isolation risk is detected without approved mitigation.
- Change scope expands outside declared boundaries.
- Required evidence fields in return packet are missing.

## Validation baseline by task type
- Docs-only changes:
  - `node scripts/check_docs_links.js`
  - `npm -C frontend run docs:check`
- Frontend/app changes:
  - Relevant targeted tests/checks for touched area
  - `npm -C frontend run lint`
  - `npm -C frontend run build`
- SQL/migration-oriented changes:
  - Follow `docs/sops/sop_sql_migration_operations.md`
  - Run docs parity checks when docs are touched
  - Include explicit security-impact assessment in return packet

If a command is inapplicable, return packet must state why and list fallback evidence.

## Required return packet fields
- `run_id`
- `role_mode`
- `task_summary`
- `files_touched`
- `commands_run`
- `validation_results`
- `findings` (`severity`, `summary`, `required_action`)
- `gate_recommendation` (`PASS|HOLD|FAIL`)
- `blockers`
- `next_action_owner_date`
- `commit_ref` (or `none`)

## Gate mapping
- Engineering implementation runs can satisfy Gate B.
- Technical reviewer runs can satisfy Gate C recommendation.
- QA/release runs can satisfy Gate D recommendation.
- Post-release monitoring runs can satisfy Gate E recommendation.
- Gate A remains an intake/control-plane decision.

## Recordkeeping contract
- Export packets and return packets must be captured under `operations-records/`.
- Naming:
  - `YYYY-MM-DD-<scope>-agent-export.md`
  - `YYYY-MM-DD-<scope>-agent-return.md`

## Templates
Use:
- `templates/external-agent-controller-export-template.md`
- `templates/external-agent-engineer-starter-template.md`
- `templates/external-agent-senior-reviewer-starter-template.md`
- `templates/external-agent-qa-release-starter-template.md`
- `templates/external-agent-return-packet-template.md`
