# Bopper Runs

Purpose: store dated run packets for Bopper.

## Startup

- Use `node bopper/scripts/start-average-run.mjs --slug <name>` to scaffold a new supervised run packet.

## Required Files Per Substantive Run

Each run packet should contain:

- `packet.json`
- `run-brief.md`
- `notes.md`
- `click-log.md`
- `decision-log.md`
- `evidence/`
- `evidence/README.md`

## What These Files Are For

- `packet.json`: structured metadata for the run so later agents can parse the packet without scraping prose
- `run-brief.md`: why this lane was chosen, what Bopper expects, and what success/confusion/abandonment would look like
- `notes.md`: chronological scratch log
- `click-log.md`: what Bopper clicked and why he clicked it
- `decision-log.md`: what Bopper concluded as the ICP about intuitiveness, support dependence, credit risk, and likely abandonment
- `evidence/`: screenshots, packets, or other concrete artifacts
- `evidence/README.md`: quick manifest for what evidence exists and what each artifact proves
