# AI Studio Reference Grid Reliability Decision Log (2026-03-21)

Last updated: 2026-03-21  
Status: Active

## Purpose
Capture durable execution decisions for Reference Grid reliability hardening.

## Decisions
| ID | Decision | Status | Rationale | Links |
| --- | --- | --- | --- | --- |
| `RGR-D01` | Treat Reference Grid card visibility as reliability source-of-truth surface for generated outputs. | Locked | User-facing incident class is grid visibility mismatch, not preview-only mismatch. | `RGR-M05`; `docs/adr/0046-ai-studio-output-visibility-authority-contract.md` |
| `RGR-D02` | Prioritize recovery correctness defects before hydration/visual tuning. | Locked | Recovery defects can silently suppress convergence and invalidate downstream UX fixes. | `RGR-M02`, `RGR-M03` |
| `RGR-D03` | Keep phased rollout model (`P0`..`P4`) with explicit evidence gates between phases. | Locked | Prevents broad risky bundle and supports targeted rollback. | `docs/planning/ai-studio-reference-grid-reliability-master-roadmap-2026-03-21.md` |
| `RGR-D04` | Require parity tests for decoupled mode before closing data-authority work. | Locked | Existing architecture has known eventual-consistency drift risk. | `RGR-M05`, `RGR-M06` |
| `RGR-D05` | Distinguish generation-loading and hydration-loading telemetry and UI semantics. | Locked | Reduces false diagnosis of "missing" when cards are present but hydrating. | `RGR-M08` |
| `RGR-D06` | Defer phase execution-plan authoring until master governance docs are complete and indexed. | Locked | Avoids phase-plan drift without tracker/spec/risk contracts. | `docs/planning/ai-studio-reference-grid-reliability-master-plan-2026-03-21.md` |
| `RGR-D07` | Maintain no-fallback-architecture rule for core defect fixes; use bounded fallback only for hydration timeout convergence. | Proposed | Preserves architecture integrity while allowing targeted safety fallback. | `RGR-M07`; `docs/adr/0046-ai-studio-output-visibility-authority-contract.md` |
| `RGR-D08` | Publish recovery timing policy as explicit contract before semantics tuning closes. | Proposed | Current perception gap around "immediate" recovery requires durable policy contract. | `RGR-M09`; `docs/adr/0047-ai-studio-generation-recovery-timing-and-failure-threshold-contract.md` |

## Amendments
Add dated entries when decisions change:
1. decision id,
2. changed fields,
3. reason,
4. linked evidence.
