# Hybervees Product Decision Log

Purpose: preserve candidate product decisions that emerge from tester-report analysis.

## Decision States

- `candidate`: evidence suggests a decision, but more proof or owner review is needed.
- `recommended`: Hybervees believes the evidence is strong enough for the solo owner to choose.
- `accepted`: the user approved the decision or implementation lane.
- `deferred`: evidence is useful but timing or confidence is not ready.
- `closed`: decision was implemented, rejected, or superseded.

## Decisions

| Date       | Decision candidate                                                                            | Evidence                                                                                   | Owner lane           | State     | Next proof                                                                                       |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| 2026-07-06 | Keep tester-run product insights separate from raw tester reports and customer issue reports. | Hybervees setup request; `/admin/tester-reports` is already a separate tester-run surface. | Hybervees / Gottspan | candidate | First real insight report should prove whether the separation produces useful product decisions. |
