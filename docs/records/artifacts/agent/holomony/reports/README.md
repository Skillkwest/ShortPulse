# Holomony Reports

Purpose: store retained KPI snapshots, performance audit reports, optimization summaries, and related evidence for Holomony.

Use this folder for:

- scored media panel KPI packets
- interpreted KPI reports
- performance hotspot audits
- before/after optimization summaries
- media-surface expansion reports for future Reference Grid or related work

## Layout

- `current/`
  - the small set of reports and retained packets that still act as current source-of-truth references for active Holomony work
- `archive/`
  - older retained packets, superseded baselines, completed audit narratives, and historical training evidence that should stay preserved but not dominate the default reading path
- `run-report-template.md`
  - reusable template for new substantive retained reports

Default reading path:

1. `current/`
2. the specific historical file in `archive/` only if the current lane needs background or comparison

## Naming Guidance

Prefer dated filenames with the surface or lane name included.

Good patterns:

- `YYYY-MM-DD-ai-studio-panel-kpi-baseline.md`
- `YYYY-MM-DD-elements-panel-baseline.packet.json`
- `YYYY-MM-DD-reference-grid-onboarding-audit.md`
- `YYYY-MM-DD-media-panel-hotspot-audit.md`

Use:

- `.md` for interpreted reports and summaries
- `.json` for raw KPI packets or machine-readable retained evidence

## Current Report Classes

- retrospective synthesis
- SOP synthesis
- KPI baseline or audit reports
- hotspot or optimization audit reports
- surface onboarding reports
- workflow and user-alignment audits

## Current Source-Of-Truth Set

- `current/2026-05-21-approved-panel-runtime-check.md`
  - latest paired runtime check for the approved panel surfaces on current production
- `current/2026-05-19-approved-panel-baseline-refresh.md`
  - approved-panel baseline refresh and the current repeated KPI/persistence read for AI Studio plus Elements
- `current/2026-05-20-ai-studio-media-library-incident-hotfix.md`
  - latest retained AI Studio media-library incident and hotfix runtime read
- `current/2026-05-18-media-library-five-column-density-plan.md`
  - active retained density-plan contract for the five-column library lane
- `current/2026-05-18-character-panel-media-assignment-onboarding-audit.md`
  - current onboarding audit for the character-panel candidate surface
- `current/2026-05-19-ai-studio-panel-baseline.packet.json`
- `current/2026-05-19-ai-studio-panel-persistence-audit.json`
- `current/2026-05-19-elements-media-panel-baseline.packet.json`
- `current/2026-05-19-elements-media-panel-persistence-audit.json`

## Historical Notes

- `archive/` keeps historical evidence intact rather than deleting it.
- Earlier packets and reports are still useful training/history, but they are not the default current-state surface anymore.
