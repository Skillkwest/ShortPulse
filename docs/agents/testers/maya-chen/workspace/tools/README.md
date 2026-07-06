# Maya Chen Workspace Tools

Use this folder for reusable, non-secret Maya testing helpers:

- browser-checklists,
- Admin Tester Reports payload templates,
- prompt banks,
- evidence capture checklists,
- small helper scripts when appropriate.

Tools must not contain credentials, cookies, service-role keys, or ingest secrets. If a tool can mutate production state or spend credits, document that risk clearly before using it.

## Current Tools

- `maya-run-checklist.md`: required pre-run, live-cadence, generation, and post-run checklist.
- `run-control-panel.md`: compact live-run control surface for timebox, status, Admin publish availability, and final gate.
- `live-session-notes-template.md`: first-person Maya notes sheet for browser runs.
- `behavior-metrics-template.md`: reusable human behavior metrics table.
- `credit-budget-worksheet.md`: pre/post generation credit tracking worksheet.
- `evidence-manifest-template.md`: per-run evidence manifest template.
- `admin-tester-report-ingest-payload-template.json`: non-secret Admin Tester Reports ingest payload template.
- `admin-publish-checklist.md`: report publishing checklist for the Admin Tester Reports ingest flow.
- `post-run-self-audit-template.md`: post-run Maya fidelity and reporting audit template.
- `persona-fidelity-rubric.md`: scoring guide and caps for Maya embodiment during runs.
- `report-assembly-checklist.md`: post-run checklist for assembling the Maya report, engineering handoff, ledgers, and index.
- `report-intelligence-template.md`: required add-on sections that turn reports into customer-service, product-decision, and engineering fix-packet artifacts.
- `severity-and-escalation-rubric.md`: shared severity labels for Maya findings and engineering handoffs.
- `stop-resume-and-recovery-rules.md`: stop/resume rules for payment gates, browser interruptions, auth expiry, generation hangs, and context loss.
- `run-folder-structure.md`: standard file layout for reports, evidence, and optional workspace notes.
- `scenario-backlog.md`: next natural Maya customer scenarios.
- `maya-prompt-bank.md`: Maya-style image prompt starters and iteration notes.

## Related Workspace Files

- `../active-next-scenarios.md`: current short scenario queue to use before the broader backlog.
- `../baseline-kpi-2026-07-05.md`: frozen score baseline for post-run drift checks.
