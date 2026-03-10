# Style Adherence Run Template

## Run Metadata
- Date:
- Owner:
- Branch:
- Commit SHA:
- Environment:
  - App URL:
  - Feature flags relevant to style behavior:

## Objective
- What behavior are we validating?
- What changed since the last baseline (if anything)?

## Test Matrix
Use the same prompt/references across model families for comparability.

| Case ID | Workflow | Model ID | Aspect | Resolution | Primary ref | Secondary refs | Selected style ID | Selected style prompt (normalized) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Create/Edit |  |  |  |  |  |  |  |
| A2 | Create/Edit |  |  |  |  |  |  |  |
| A3 | Create/Edit |  |  |  |  |  |  |  |

## Prompt Inputs
- Visible user prompt:
- Submission prompt expectation:
  - Must include `Visual style reference: ...` when style is selected.
- Any additional constraints (character mode, inpaint, reference tokens):

## Output Evaluation Rubric
Score each dimension `0` (none), `1` (partial), `2` (strong):
- Palette transfer
- Lighting mood transfer
- Texture/material treatment transfer
- Grade/lens/finish transfer
- Structure/identity preservation

Total style adherence band:
- `strong`: 7-10
- `moderate`: 4-6
- `weak`: 0-3

## Results
| Case ID | Palette | Lighting | Texture | Grade/Lens | Structure preserved | Total | Band | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A1 |  |  |  |  |  |  |  |  |
| A2 |  |  |  |  |  |  |  |  |
| A3 |  |  |  |  |  |  |  |  |

## Diagnostics
- Was style prompt selected and non-empty?
- Was style append present in submission prompt?
- Any conflicting directives between user prompt and style prompt?
- Any provider/model anomalies observed?

## Decision
- Classification:
  - Expected model-family behavior
  - Possible regression
  - Inconclusive
- Confidence level:
- Rationale:

## Follow-up Actions
1. 
2. 
3. 
