# Beeper Agent Capability Matrix

Purpose: track which testing capabilities Beeper can perform reliably and which still need training.

## Status Key

- `not-started`
- `training`
- `usable`
- `strong`

## Capability Matrix

| Capability | Current status | Evidence standard | Promotion trigger |
| --- | --- | --- | --- |
| Route access validation | `strong` | Can confirm route reachability and blockers with evidence. | Sustain strong performance across 3+ runs. |
| Real-user path testing | `usable` | Can run believable user flows and label fidelity honestly. | More full route bundles with honest labeling. |
| Alpha route-bundle testing | `usable` | Can chain adjacent workflows in one coherent run. | More repeated successful route bundles. |
| Continuity validation | `usable` | Can prove reload, reopen, reentry, or session-return behavior. | More continuity-ready lanes validated consistently. |
| Persistence validation | `usable` | Can verify state survives save, reload, and reopen. | More create/edit/save/reopen paths. |
| UX bottleneck identification | `strong` | Finds believable friction and trust breaks. | Sustain high signal without over-reporting. |
| Product severity judgment | `usable` | Separates blocker, functional, and UX issues reliably. | More fix retests and consistency. |
| D-Bug handoff creation | `strong` | Produces bounded repros and likely code surfaces. | Keep handoffs narrow and reusable. |
| Coverage planning | `usable` | Uses route-success, queue, and coverage logs intentionally. | Close lower-coverage routes more consistently. |
| Retest closure | `training` | Revalidates fixes and closes issue loops. | Clear multiple retest-debt items successfully. |
| Cross-tester synthesis | `training` | Uses Bopper comparison only when contrast will materially sharpen the conclusion. | More deliberate comparative lanes without defaulting to extra overhead. |
| Campaign-level product audit ownership | `training` | Can run and synthesize broader audit waves. | Stronger breadth plus retest closure. |

## Current Limiter

- Retest closure and broader route breadth are still weaker than first-pass issue discovery.
