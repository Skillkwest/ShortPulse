# Records Evidence Index

Purpose: index retained evidence namespaces that have already moved into the records model.

## Active migrated namespaces
- `docs/records/evidence/agent/`: retained evidence packet family for the AI Studio Agent hardening/modularization program, with raw payload inputs now split into `docs/records/artifacts/agent/`.
- `docs/records/evidence/agent-pipeline-remediation/`: retained evidence packet family for the AI Studio agent pipeline regression remediation program, with raw payloads and generated outputs now split into `docs/records/artifacts/agent-pipeline-remediation/`.
- `docs/records/evidence/docs/`: retained governance evidence packet family for STG validation, branch-protection mapping, and pre-closeout signoff packets.
- `docs/records/evidence/lane-a/`: retained evidence packet family for the closed Lane A gate recovery and governance hardening lane.
- `docs/records/evidence/lane-f/`: retained evidence packet family for the closed Lane F release and CI governance lane.
- `docs/records/evidence/kei/`: retained evidence packet family for the completed STG-04 KEI compatibility decommission lane.
- `docs/records/evidence/media-library-runtime-rebuild/`: retained evidence packet family for the closed Media Library runtime rebuild lane.
- `docs/records/evidence/style-adherence/`: retained style-behavior evidence templates and run packets for cross-model AI Studio style adherence checks.

## Usage
- Use this index when you need human-readable evidence packets that no longer belong under active planning.
- For namespaces that still physically live under `docs/planning/evidence/`, use `docs/records/README.md` and `docs/planning/evidence/README.md` during the transition.
