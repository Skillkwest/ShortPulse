# Hybervees Product Decision Log

Purpose: preserve candidate product decisions that emerge from tester-report analysis.

## Decision States

- `candidate`: evidence suggests a decision, but more proof or owner review is needed.
- `recommended`: Hybervees believes the evidence is strong enough for the solo owner to choose.
- `accepted`: the user approved the decision or implementation lane.
- `deferred`: evidence is useful but timing or confidence is not ready.
- `closed`: decision was implemented, rejected, or superseded.

## Decisions

| Date       | Decision candidate                                                                                           | Evidence                                                                                                                                       | Owner lane                   | State       | Next proof                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| 2026-07-06 | Keep tester-run product insights separate from raw tester reports and customer issue reports.                | Hybervees setup request; `/admin/tester-reports` is already a separate tester-run surface.                                                     | Hybervees / Gottspan         | candidate   | First real insight report should prove whether the separation produces useful product decisions. |
| 2026-07-06 | Make saved-work continuity the first trust checkpoint for new creators before asking them to spend credits.  | Maya Chen's 2026-07-03 orientation run stopped before generation after draft loss and unclear save-to-media behavior.                          | Abismia / D-Bug / Copperknot | recommended | Authenticated current-production re-test after draft/save path inspection.                       |
| 2026-07-06 | Align Reference Grid, Media Library, and My Generations copy around one clear "where did my work go?" model. | Maya could use individual controls but did not trust the larger saved-work system after My Generations was unavailable and Media looked empty. | Abismia / Copperknot         | candidate   | Review current IA/copy and compare against later tester reports.                                 |
