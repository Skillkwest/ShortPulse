# Coordinate Parity Evidence Template

Use this template for baseline and phase evidence packets in the Expert Edit coordinate-parity program.

## Packet Metadata
1. Packet ID:
2. Phase / Tracker rows:
3. Date (UTC):
4. Owners:
5. Branch / commit:
6. Environment:

## Scope
1. Surfaces covered: inline / modal
2. Modes covered: markup pen/eraser, inpaint brush/lasso
3. Matrix slices covered:

## Matrix Results
| Dimension | Values Covered | Pass/Fail | Notes |
| --- | --- | --- | --- |
| Zoom | `0.5`, `1`, `2`, `4` | | |
| Pan | `(0,0)`, `(37,-19)`, `(-120,80)` | | |
| Stage Aspect | `1:1`, `4:3`, `16:9` | | |
| Image Aspect | `1:1`, `4:3`, `16:9`, `9:16` | | |
| DPR | `1`, `2`, `3` | | |

## Threshold Results
| Metric | Threshold | Observed Max | Pass/Fail | Notes |
| --- | --- | --- | --- | --- |
| Pointer-to-stroke center error | `<= 0.75 CSS px` | | | |
| Reticle vs painted diameter delta | `<= 1.0 CSS px equivalent` | | | |
| Export alignment delta | `<= 1 mask px` | | | |
| Lasso deterministic parity | exact for fixtures | | | |

## Validation Commands
1. Command list:
2. Pass/fail summary:
3. Any known flakes and reruns:

## Artifact Links
1. Test logs:
2. Visual artifacts:
3. Supporting notes:
4. Decision log entry:

## Regressions / Incidents
1. Description:
2. Matrix slice:
3. Severity:
4. Mitigation:
5. Rollback triggered: yes/no

## Signoff
1. Engineering signoff:
2. QA signoff:
3. Decision:
4. Timestamp:
