# Media Rendering Hardening v2 Decision Log (2026-03-16)

Last updated: 2026-03-16  
Status: Active

## Decision Table
| decision_id | date | topic | decision | rationale | impact | status |
| --- | --- | --- | --- | --- | --- | --- |
| MRH2-D-001 | 2026-03-16 | Program strategy | Use strangler hardening with hot-path-first sequencing. | Reduces regression risk and keeps slices small. | Governs all phase sequencing and PR discipline. | Accepted |
| MRH2-D-002 | 2026-03-16 | Behavior safety | Require characterization evidence before behavior changes. | Prevents accidental contract drift on fragile surfaces. | Blocks P1+ changes until P0A/P0B complete. | Accepted |
| MRH2-D-003 | 2026-03-16 | List profile | Add explicit `minimal|expanded` contract with `minimal` default. | Removes hot-path overfetch while preserving compatibility path. | Affects `/api/media/list` and all consumers. | Accepted |
| MRH2-D-004 | 2026-03-16 | Upload authority | Make `/api/media/upload` canonical; keep legacy routes as temporary adapters. | Consolidates ingest logic and de-risks retirement via sunset gates. | Affects upload routes, docs, and compatibility telemetry. | Accepted |
| MRH2-D-005 | 2026-03-16 | Scope boundary | Keep `mini-ecosystem/` out of scope for this program. | User constraint and isolation boundary. | Prevents cross-system coupling in this track. | Accepted |
| MRH2-D-006 | 2026-03-16 | Signed URL policy | Final cross-surface policy split/unification to be locked in P1 slice. | Current surfaces exhibit policy drift. | Drives resolver/test updates. | Pending |
| MRH2-D-007 | 2026-03-16 | Legacy sunset threshold | Decommission thresholds to be finalized using telemetry in P3/P8. | Must be usage-based, not date-only. | Governs adapter removal timing. | Pending |

## Rule
Every contract or architecture decision in this program must be logged here before merge.
