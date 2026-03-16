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

## JSON-ready contract skeleton
```json
{
  "packet_id": "<string>",
  "workflow_mode": "<feature_delivery|codebase_audit>",
  "gate": "<A|B|C|D|E>",
  "decision": "<PASS|HOLD|FAIL>",
  "deciding_role": "<role_enum>",
  "timestamp_utc": "<ISO-8601>",
  "blocking_findings": ["<finding_id>"],
  "notes": "<string>",
  "next_required_action": "<string>"
}
```

## Contract rule
Outputs that do not conform to this schema are invalid and should be treated as `HOLD` until corrected.
