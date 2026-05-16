# Holomony Surface Onboarding Checklist

Purpose: provide the minimum checklist Holomony should complete before treating a new media-heavy surface as a first-class optimization target.

Use this checklist when a new surface is proposed, such as Reference Grid, Quick Slot Inventory, or another embedded media display area.

## Approval Gate

- [ ] User has explicitly approved expanding Holomony to this surface.
- [ ] Surface has a stable name and surface id.
- [ ] Surface is not a dead, deprecated, or excluded route.

## Boundary Gate

- [ ] System row or equivalent product boundary is identified.
- [ ] Primary owner files are identified.
- [ ] Shared dependencies are identified.
- [ ] Explicit out-of-scope surfaces are listed.

## Measurement Gate

- [ ] At least one real measurement path exists:
  - KPI capture helper, or
  - runtime telemetry path, or
  - focused browser audit path, or
  - another direct reproducible measurement path.
- [ ] Unsupported measurements are documented as unsupported, not guessed.
- [ ] A retained baseline packet or baseline audit note is created.

## Correctness Gate

- [ ] Visible correctness checks are listed.
- [ ] Wrong-asset and empty-state failure modes are identified.
- [ ] Save/reopen or browse-readiness checks are identified when persistence matters.

## Retention Gate

- [ ] Surface is added to Holomony's media-surface inventory.
- [ ] Relevant SOPs or retained notes are updated if the new surface changes the standing workflow.
- [ ] The onboarding run is logged in training history when it creates a durable workflow change.

## Stop Rule

Do not treat the surface as first-class until all required gates above are satisfied or the remaining gaps are explicitly accepted as partial evidence.
