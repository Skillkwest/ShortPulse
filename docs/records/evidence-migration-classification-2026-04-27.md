# Evidence Migration Classification (2026-04-27)

Purpose: classify the current `docs/planning/evidence/` tree into migration buckets without moving files yet, so later records migration work can happen namespace-by-namespace instead of file-by-file.

## Follow-up status
- First pilot executed after this snapshot:
  - `docs/planning/evidence/media-library-runtime-rebuild/` moved to `docs/records/evidence/media-library-runtime-rebuild/`
- Second markdown-only pilot executed after this snapshot:
  - `docs/planning/evidence/lane-a/` moved to `docs/records/evidence/lane-a/`
- Third markdown-only pilot executed after this snapshot:
  - `docs/planning/evidence/lane-f/` moved to `docs/records/evidence/lane-f/`
- Fourth markdown-only migration executed after this snapshot:
  - `docs/planning/evidence/kei/` moved to `docs/records/evidence/kei/`
- First split-namespace migration executed after this snapshot:
  - `docs/planning/evidence/agent/` moved to `docs/records/evidence/agent/`
  - `docs/records/artifacts/agent/phase-5/phase-5-rollout-snapshot-input.template.json` now holds the retained raw rollout template payload
- Second split-namespace migration executed after this snapshot:
  - `docs/planning/evidence/agent-pipeline-remediation/` moved to `docs/records/evidence/agent-pipeline-remediation/`
  - raw payloads and generated outputs now live under `docs/records/artifacts/agent-pipeline-remediation/`
- Next markdown-only migration executed after this snapshot:
  - `docs/planning/evidence/docs/` moved to `docs/records/evidence/docs/`
- Next markdown-only migration executed after this snapshot:
  - `docs/planning/evidence/style-adherence/` moved to `docs/records/evidence/style-adherence/`
- Next markdown-only migration executed after this snapshot:
  - `docs/planning/evidence/architecture/` moved to `docs/records/evidence/architecture/`
- Next markdown-only migration executed after this snapshot:
  - `docs/planning/evidence/sql/` moved to `docs/records/evidence/sql/`
- Next markdown-only migration executed after this snapshot:
  - `docs/planning/evidence/lane-d/` moved to `docs/records/evidence/lane-d/`
- Next markdown-only migration executed after this snapshot:
  - `docs/planning/evidence/lane-e/` moved to `docs/records/evidence/lane-e/`
- Next markdown-only migration executed after this snapshot:
  - `docs/planning/evidence/lane-b/` moved to `docs/records/evidence/lane-b/`
- Next markdown-only migration executed after this snapshot:
  - `docs/planning/evidence/generation-pipeline-hardening/` moved to `docs/records/evidence/generation-pipeline-hardening/`
- Next markdown-only migrations executed after this snapshot:
  - `docs/planning/evidence/ai-studio-reference-grid-reliability/` moved to `docs/records/evidence/ai-studio-reference-grid-reliability/`
  - `docs/planning/evidence/lane-c/` moved to `docs/records/evidence/lane-c/`
  - `docs/planning/evidence/media-rendering-hardening-v2/` moved to `docs/records/evidence/media-rendering-hardening-v2/`
- Next markdown-only migration executed after this snapshot:
  - `docs/planning/evidence/naming-canonicalization/` moved to `docs/records/evidence/naming-canonicalization/`
- Explicit governance decision after this snapshot:
  - `docs/planning/evidence/unified-buildout/` remains in place as an active-program exception while `docs/planning/shortpulse-unified-buildout-tracker.md` still treats phase evidence as current execution gating. It is no longer the default next migration target.
- Treat the inventory counts below as the pre-migration snapshot used to choose that pilot.

## Inventory snapshot
- Evidence root analyzed: `docs/planning/evidence/`
- Namespace directories: `22`
- Total retained files: `577`
- Markdown files: `542`
- Non-markdown files: `35`
- Current raw-file concentration:
  - `agent`: `1` json + `5` other
  - `agent-pipeline-remediation`: `23` json + `6` other

Current repo reality:
- Most evidence namespaces are human-readable markdown packet families.
- Only two namespaces currently require a true evidence-vs-artifacts split.
- Top-level reader navigation should route through policy/index docs, not these packet files directly.

## Classification buckets
### 1. Keep as summary/index during transition
Use these as discoverability entrypoints while physical files still live under `docs/planning/evidence/`.

- `docs/planning/evidence/README.md`
- All namespace `README.md` files
- Template/index docs that are meant to guide later packet reads rather than act as current truth

Rule:
- top-level docs and active planning indexes may point to these entrypoints,
- but they should not enumerate raw packet inventories in the main reading path.

### 2. Future `docs/records/evidence/`
These namespaces are primarily human-readable evidence packets, templates, and closeout records. They should migrate as retained evidence, not as raw artifacts.

| Namespace | Current file mix | Recommended destination |
| --- | --- | --- |
| `ai-studio-expert-edit` | `17` markdown | `docs/records/evidence/ai-studio-expert-edit/` |
| `ai-studio-reference-grid-reliability` | `5` markdown | `docs/records/evidence/ai-studio-reference-grid-reliability/` |
| `architecture` | `13` markdown | `docs/records/evidence/architecture/` |
| `docs` | `7` markdown | `docs/records/evidence/docs/` |
| `generation-pipeline-hardening` | `27` markdown | `docs/records/evidence/generation-pipeline-hardening/` |
| `generation-reliability-hardening` | `32` markdown | `docs/records/evidence/generation-reliability-hardening/` |
| `kei` | `4` markdown | `docs/records/evidence/kei/` |
| `lane-a` | `10` markdown | `docs/records/evidence/lane-a/` |
| `lane-b` | `81` markdown | `docs/records/evidence/lane-b/` |
| `lane-c` | `4` markdown | `docs/records/evidence/lane-c/` |
| `lane-d` | `11` markdown | `docs/records/evidence/lane-d/` |
| `lane-e` | `10` markdown | `docs/records/evidence/lane-e/` |
| `lane-f` | `11` markdown | `docs/records/evidence/lane-f/` |
| `media-library-runtime-rebuild` | `4` markdown | `docs/records/evidence/media-library-runtime-rebuild/` |
| `media-rendering-hardening-v2` | `11` markdown | `docs/records/evidence/media-rendering-hardening-v2/` |
| `naming-canonicalization` | `23` markdown | `docs/records/evidence/naming-canonicalization/` |
| `reference-grid-modularization` | `52` markdown | `docs/records/evidence/reference-grid-modularization/` |
| `sql` | `5` markdown | `docs/records/evidence/sql/` |
| `style-adherence` | `2` markdown | `docs/records/evidence/style-adherence/` |

### 3. Future split between `docs/records/evidence/` and `docs/records/artifacts/`
These namespaces contain both human-readable packets and raw machine-generated material. They need an internal split during migration.

| Namespace | Current file mix | Evidence portion | Artifact portion |
| --- | --- | --- | --- |
| `agent` | `34` markdown, `1` json, `5` other | README, templates, markdown closeout packets | json inputs plus non-markdown helper/output files |
| `agent-pipeline-remediation` | `39` markdown, `23` json, `6` other | README files, templates, markdown summaries, closeout packets | json datasets, generated packet inputs, and other machine outputs under `artifacts/` and similar subtrees |

Migration rule for split namespaces:
1. Move namespace README files and markdown packet summaries into `docs/records/evidence/...`.
2. Move machine-generated payloads into `docs/records/artifacts/...`.
3. Update the evidence README to point at its artifact subtree rather than keeping the raw payloads mixed together.

## Recommended first migration pilot
Pilot namespace selected from this snapshot: `docs/planning/evidence/media-library-runtime-rebuild/`

Why this is the best first move:
- small (`4` markdown files),
- closed family already archived in planning,
- no raw artifact split required,
- easy to validate link/index behavior after a physical move,
- low chance of reopening active planning semantics.

Target pilot shape:
- `docs/records/evidence/media-library-runtime-rebuild/README.md`
- `docs/records/evidence/media-library-runtime-rebuild/2026-03-28-mlr-0-s2-characterization-and-freeze-repro-baseline.md`
- `docs/records/evidence/media-library-runtime-rebuild/2026-03-28-mlr-0-s2-heavy-browser-repro-packet.md`
- `docs/records/evidence/media-library-runtime-rebuild/2026-03-28-mlr-5-s2-closeout-audit.md`

## Deferred higher-complexity migrations
These should not be the first physical move:
- `reference-grid-modularization`: large packet family with many phase files
- `lane-b`: large markdown family
- `agent` and `agent-pipeline-remediation`: require evidence/artifacts split and path-sensitive references

## Active-program exception
`unified-buildout` is no longer classified as the default next records migration candidate.

Reason:
- its evidence namespace is still wired into the authoritative live tracker under `docs/planning/shortpulse-unified-buildout-tracker.md`,
- multiple phases remain `In Progress` or `Deferred`,
- and the namespace still functions as current execution proof rather than retained historical closeout only.

Migration rule:
1. Leave `docs/planning/evidence/unified-buildout/` in place while the unified build-out tracker remains active.
2. Revisit migration only after the unified program is closed, replaced, or deliberately split into current-vs-records surfaces.

## Stop rules for the migration lane
- Do not bulk-move multiple namespaces at once.
- Do not move raw artifact-heavy namespaces before the records/artifacts split contract is exercised successfully on a simpler case.
- Do not reintroduce raw evidence packet inventories into `docs/README.md` or `docs/planning/README.md`.
