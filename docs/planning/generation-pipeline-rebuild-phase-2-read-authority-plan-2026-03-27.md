# Generation Pipeline Rebuild Phase 2 Read Authority Plan (2026-03-27)

Date: 2026-03-27  
Authority: Working  
Owner: Engineering  
Status: active

## Summary
Phase 2 completed the transition from linkage hardening to stricter read authority.

This phase stayed pre-schema and focused on reducing mixed transient-vs-durable read behavior so generated outputs stopped being treated as fully reusable or durable before the system had canonical authority to say so.

## Scope
In scope:
1. AI Studio generated-media read and reuse surfaces
2. Reference Grid derivation and detail/read-model helpers
3. generated preview/download/reuse state classification
4. narrow server payload adjustments when required to support durable read authority
5. directly related tests and doc updates

Out of scope:
1. new canonical generation tables
2. full reconciler unification
3. large visual/UI redesign
4. broad media-library refactor outside generated-output authority

## Objective
By the end of Phase 2, generated-media read surfaces should distinguish clearly between:
1. transient provider output
2. durably tracked generated output
3. storage-backed reusable asset

The UI may still preview transient output, but it should not misclassify that output as durably reusable or fully saved.

Phase 2 has now handed off to [generation-pipeline-rebuild-phase-3-canonical-output-plan-2026-03-27.md](./generation-pipeline-rebuild-phase-3-canonical-output-plan-2026-03-27.md) for additive schema and server-authoritative output recording.

## Slice Tracker
| Slice ID | Goal | Primary Surfaces | Exit Gate | Validation | Status |
| --- | --- | --- | --- | --- | --- |
| `GPR-P2-S1` | Remove remaining weak-identity generated read fallbacks | Reference/detail/download/reuse helpers still deriving from `taskId` or equivalent weak hints | generated read actions and reuse helpers no longer repair identity from `taskId` or provider-only state | targeted AI Studio hook/logic vitest bundle | Completed |
| `GPR-P2-S2` | Tighten generated-output ready/reusable classification | read-derivation helpers such as `referenceGridMedia.ts`, preview/detail derivations, and adjacent classifiers | generated outputs without durable authority are previewable but not classified as fully reusable/saved | targeted Reference Grid/detail derivation vitest bundle | Completed |
| `GPR-P2-S3` | Normalize server payload support for durable read authority | status/recovery/queue payload contracts where client still needs compatibility inference | generated-output clients receive the durable identifiers and persistence hints required to avoid local repair logic | targeted API/status/recovery vitest bundle | Completed |
| `GPR-P2-S4` | Lock docs and branch planning to the read-authority contract | rebuild docs, SOPs, and touched ADR/status surfaces | docs describe transient vs durable generated-output authority without drift | `npm -C frontend run docs:check` | Completed |

## Execution Order
1. Phase 2 completed before additive schema work began.
2. Canonical output recording now continues in Phase 3.

## Constraints
1. Do not introduce new client-owned lifecycle truth.
2. Phase 2 is complete; schema-first work is now tracked separately in Phase 3.
3. Prefer hiding or degrading invalid generated actions over speculative repair.
4. Keep previews working where safe, but distinguish previewability from durability.

## Validation Bundle
1. targeted AI Studio reference/detail/read-model vitest suites for touched files
2. targeted status/recovery API vitest suites if payload contracts change
3. `npm -C frontend run docs:check`

## Exit Criteria
1. Generated-media read/reuse paths no longer rely on `taskId` or equivalent weak identity repair.
2. Generated outputs without durable authority are not classified as fully reusable/saved.
3. Client read flows consume durable identity from server payloads wherever available.
4. Updated docs accurately describe the read-authority contract on this branch.
