# Finding And Packet Schema

Purpose: define canonical output structures that all roles must use.

Status: Inactive specification.

## Canonical finding object
Required fields:
- `finding_id` (string)
- `role` (enum)
- `severity` (enum: `P0|P1|P2|P3`)
- `category` (string)
- `summary` (string)
- `evidence` (array of strings)
- `risk_statement` (string)
- `gate_impact` (array of `A|B|C|D|E`)
- `required_action` (string)
- `owner` (string)
- `due_date` (YYYY-MM-DD or `tbd`)
- `status` (enum: `open|accepted_risk|resolved|deferred`)

## Gate decision packet
Required fields:
- `packet_id` (string)
- `workflow_mode` (enum: `feature_delivery|codebase_audit`)
- `gate` (enum: `A|B|C|D|E`)
- `decision` (enum: `PASS|HOLD|FAIL`)
- `deciding_role` (enum)
- `timestamp_utc` (ISO-8601)
- `blocking_findings` (array of `finding_id`)
- `notes` (string)
- `next_required_action` (string)

## Handoff packet
Required fields:
- `handoff_id` (string)
- `from_role` (enum)
- `to_role` (enum)
- `workflow_mode` (enum)
- `scope_summary` (string)
- `inputs` (array of strings)
- `findings` (array of finding objects)
- `requested_decision_gate` (enum)
- `requested_outcome` (string)

## Role enum
Allowed values:
- `product`
- `engineer`
- `senior_engineer`
- `qa_engineer`
- `platform_release`
- `security_reviewer`
- `product_design`

## JSON-ready template (example)
```json
{
  "packet_id": "gate-C-2026-03-16-001",
  "workflow_mode": "feature_delivery",
  "gate": "C",
  "decision": "HOLD",
  "deciding_role": "senior_engineer",
  "timestamp_utc": "2026-03-16T19:00:00Z",
  "blocking_findings": ["F-SEC-001"],
  "notes": "Critical security finding unresolved.",
  "next_required_action": "Resolve finding F-SEC-001 and re-run review packet."
}
```

## Contract rule
Outputs that do not conform to this schema are invalid and should be treated as `HOLD` until corrected.
