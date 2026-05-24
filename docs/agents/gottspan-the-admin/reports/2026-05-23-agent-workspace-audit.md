# Agent Workspace Audit - 2026-05-23

Purpose: record Gottspan's deeper audit of agent-folder cleanup issues and route major work to the owning agent instead of performing that work inside another agent's workspace.

## Scope And Rules

- Mode: audit and handoff only.
- Branch posture observed: `production` with `shortpulse.allowedBranch=production`.
- Security issues are out of Gottspan scope. Any credential, token, auth/session, RLS/storage-policy, or secret-remediation issue routes to Dave the Security Guy.
- Gottspan should not perform major cleanup inside another agent folder. The correct output is a bounded handoff that the owning agent can run.

## Summary

The audit found several real workspace-hygiene and runtime-load issues. The highest non-security cleanup lanes are Nuclo branch-instruction drift, Ophestivus split authority, Copperknot retained artifact bloat, Create Workflow binary capture retention, and D-Bug handoff status conventions.

The following areas did not need a new cleanup handoff from this pass:

- Ayla: compact contract and artifact shape; no major bloat found.
- Money Stuff: compact source map, reports, run log, and tools; no major bloat found.
- Lever: compact model-maintenance structure; no major bloat found.
- Pulse: small active package; no major bloat found.
- Skill-local `agents/openai.yaml` files: concise invocation metadata only.
- Gear Ball: high report volume, but structure is acceptable for its commit/worktree coordination role.

## Handoff Packets

- [Beeper non-security retention diet](handoffs/2026-05-23-beeper-nonsecurity-retention-diet.md)
- [Copperknot retained artifact and HTML mirror pruning](handoffs/2026-05-23-copperknot-retained-artifact-prune.md)
- [Create Workflow binary capture retention cleanup](handoffs/2026-05-23-create-workflow-capture-retention.md)
- [D-Bug handoff queue status convention](handoffs/2026-05-23-d-bug-handoff-status-convention.md)
- [Gear Ball pre-launch branch instruction reconciliation](handoffs/2026-05-23-gear-ball-prelaunch-branch-reconciliation.md)
- [Gottspan stale branch-report reconciliation](handoffs/2026-05-23-gottspan-branch-report-reconciliation.md)
- [Holomony default-load material pruning](handoffs/2026-05-23-holomony-default-load-prune.md)
- [Holomony stale absolute path cleanup](handoffs/2026-05-23-holomony-stale-absolute-paths.md)
- [Nuclo branch instruction reconciliation](handoffs/2026-05-23-nuclo-branch-instruction-reconciliation.md)
- [Ophestivus contract and artifact-home reconciliation](handoffs/2026-05-23-ophestivus-contract-artifact-reconciliation.md)
- [Bopper workspace packet and reload hygiene](handoffs/2026-05-23-bopper-workspace-packet-reload-hygiene.md)
- [Change Impact Auditor folder consistency](handoffs/2026-05-23-change-impact-auditor-folder-consistency.md)
- [Shared artifact index inventory refresh](handoffs/2026-05-23-shared-artifact-index-refresh.md)

## Evidence Snapshot

- Agent/artifact file-count hotspots:
  - `docs/records/artifacts/agent/copperknot/`: 47 files.
  - `docs/records/artifacts/agent/holomony/`: 46 files.
  - `docs/records/artifacts/agent/beeper/`: 45 files.
  - `docs/records/artifacts/agent/gear-ball/`: 40 files.
  - `docs/records/artifacts/agent/ophestivus/`: 30 files.
  - `docs/records/artifacts/agent/d-bug/`: 28 files.
- Binary or rendered artifacts still visible in retained agent surfaces:
  - `docs/records/artifacts/agent/create-workflow/workspace/captures/*.png`
  - `docs/records/artifacts/agent/holomony/reports/current/*.json`
  - `docs/records/artifacts/agent/holomony/reports/archive/*.json`
  - `docs/records/artifacts/agent/copperknot/reports/*operator-brief.html`
  - `docs/records/artifacts/agent/copperknot/reports/*launch-ready-checklist.html`
  - `docs/agents/holomony/Kirk.html`
- Nuclo still carries ladder-era wording in active surfaces even though it also has a current production-only override.
- Ophestivus has a thin visible contract at `docs/agents/ophestivus/README.md`, while much of the working identity lives under `docs/records/artifacts/agent/ophestivus/`.
- D-Bug already has a status section, but it is a manual list inside `docs/records/artifacts/agent/d-bug/handoffs/README.md`; the packet asks D-Bug to make the convention explicit and durable.
- Holomony active instructions contain stale absolute paths to an older repo location under `/Users/worldbuilder/Desktop/Desktop Clean/Projects/Coding Projects/ShortPulse Dev/ShortPulse/`.
- Gear Ball active memory and GitHub operations guidance still use `current user-approved branch` wording instead of leading with the current pre-launch `production` rule.
- Bopper is healthier than Beeper, but its workspace contains local reload files plus run packets/JSON under `docs/agents/bopper/workspace/runs/`; the packet asks Bopper to keep the reload layer thin and make packet retention intentional.
- `docs/agents/change-impact-auditor.md` remains a flat file while most active agents now use a folder contract pattern.
- Gottspan's older May 20 branch-policy reports are now historical and conflict with the newer pre-launch production-only rule unless clearly marked as superseded/historical.

## Security Routing Note

The original issue list included security-shaped items around storage state, sessions, raw network dumps, signed URLs, and revocation. Those belong to Dave the Security Guy, not Gottspan. Gottspan did not continue that investigation in this pass.
