Source-only file. Open the rich brief here: `docs/records/artifacts/agent/copperknot/reports/2026-05-16-copperknot-rename-pass.html`

# WHAT CHANGED

- The steward identity is now `Copperknot`.
- The main Copperknot contract folder is now `docs/agents/copperknot/`.
- The retained Copperknot artifact folder is now `docs/records/artifacts/agent/copperknot/`.
- Indexes, live links, handoffs, reports, and HTML companions were updated to the new paths.

# WHAT STAYED THE SAME

- The job did **not** change.
- Copperknot still owns:
  - systems catalog stewardship
  - system ratings
  - production-readiness prioritization
  - execution handoff generation
  - closeout intake and rerating

# WHY I KEPT SOME NAMES STABLE

- Dated report filenames stayed stable when the file purpose was still correct.
- That keeps history readable and avoids pointless churn in archived run names.
- The important rename was the steward identity and its canonical folders, not every historical date label.

# MAIN COPPERKNOT PATHS

- Contract:
  - `docs/agents/copperknot/README.md`
- SOP:
  - `docs/agents/copperknot/standard-operating-procedure.md`
- Memory:
  - `docs/agents/copperknot/memory.md`
- Active queue:
  - `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
- Artifact root:
  - `docs/records/artifacts/agent/copperknot/README.md`
- Reports:
  - `docs/records/artifacts/agent/copperknot/reports/README.md`

# CLEANUP DONE

- Removed one low-value `.DS_Store` file from the Copperknot artifact space.
- Tightened the Copperknot entrypoint wording so the rename reads intentional instead of mechanical.

# WHAT YOU SHOULD EXPECT NOW

- Future handoffs should point to `docs/agents/copperknot/...`
- Future closeouts should go to `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`
- Future rich briefs should be written as Copperknot artifacts by default

# VALIDATION

- `npm -C frontend run docs:check` passed

# NEXT STEP

- Keep using `Copperknot` as the name going forward.
- If you want me to continue normal steward work next, just say `run Copperknot`.
