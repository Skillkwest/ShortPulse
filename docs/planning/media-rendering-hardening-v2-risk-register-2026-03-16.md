# Media Rendering Hardening v2 Risk Register (2026-03-16)

Last updated: 2026-03-18
Status: active  

## Severity Scale
- `S0`: critical outage/data risk
- `S1`: major regression risk
- `S2`: medium delivery risk
- `S3`: low operational risk

## Risks
| risk_id | severity | owner | description | mitigation | rollback_trigger | status |
| --- | --- | --- | --- | --- | --- | --- |
| MRH2-R-001 | S1 | Engineering | Cross-surface delivery policy drift can regress previews once implementation starts. | Lock surface policy matrix and decision-log approval before behavior edits. | Preview resolution mismatch above threshold or repeated user-visible failures in rollout ring. | Open |
| MRH2-R-002 | S1 | Engineering | Telemetry fields can overstate actual transform/delivery mode and poison baseline evidence. | Publish telemetry truth spec and block baseline signoff until calibrated. | Baseline packet depends on a field later proven inaccurate. | Open |
| MRH2-R-003 | S1 | Engineering | MIME acceptance vs dimension parser mismatch can create metadata drift. | Authoritative fallback policy + invariant tests before render unification. | Null/incorrect dimension propagation in hot paths. | Open |
| MRH2-R-004 | S1 | Engineering | Folder query id fan-in can degrade list performance at scale. | Replace with scalable query shape and benchmark dataset tiers. | P95 latency regression beyond gate or timeout/error spike. | Open |
| MRH2-R-005 | S1 | Engineering | Legacy upload endpoint retirement can break hidden consumers. | Adapter compatibility stage + telemetry-based sunset gates. | Any adapter parity mismatch in staging or limited ring. | Open |
| MRH2-R-006 | S2 | Engineering | `minimal` list profile can break implicit metadata-dependent consumers. | Add explicit `expanded` profile and consumer compatibility tests. | Consumer parse/render failures in ring 1/2. | Open |
| MRH2-R-007 | S2 | Engineering | Existing tests can lock in rejected drift and slow valid hardening work. | Test realignment matrix and staged test rewrites before policy-cutover slices. | Policy slice blocked by obsolete characterization assertions. | Open |
| MRH2-R-008 | S2 | Engineering | Sequential upload bottlenecks can worsen user upload latency during transition. | Bounded concurrency and parity assertions during consolidation. | Upload failure/error-rate increase after change. | Open |
| MRH2-R-009 | S2 | Engineering | Anti-bloat enforcement may block merges with noisy checks. | Start in warn mode with strict sunset and known fixtures. | High false-positive rate blocks essential slices. | Open |
| MRH2-R-010 | S0 | Engineering | Decommission too early could cause production ingest or preview outage. | Require parity proof, clean release windows, and rollback validation before retirement. | Any post-decommission upload or render critical-path regression. | Open |
| MRH2-R-011 | S2 | Engineering | Incomplete surface census can leave user-visible image paths outside parity and smoke coverage. | Require explicit inventory rows or queued annex disposition for every known render surface before implementation starts. | A regression appears on a surface that was missing from inventory/policy planning. | Open |
| MRH2-R-012 | S1 | Engineering | Sign/resolve server handoff can remain implicit and surprise Surface cutover work. | Track explicit Pipeline handoff contract and require contract-matrix/decision-log alignment before Surface `P3` slices merge. | Surface cutover discovers unresolved sign/resolve behavior that blocks parity or causes user-visible drift. | Open |

## Operational Rule
Update this register in the same slice whenever risk posture changes.
