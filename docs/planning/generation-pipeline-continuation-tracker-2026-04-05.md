# Generation Pipeline Continuation Tracker Index (2026-04-05)

Last updated: 2026-04-05  
Status: Active  
Master plan: `docs/planning/generation-pipeline-continuation-master-plan-2026-04-05.md`

## Purpose
This index routes execution into one bucket-specific subplan per authority problem.

The old single tracker was too broad for implementation. These subplans keep the work narrow enough to avoid patchwork and make rollback ownership explicit.

## Bucket Subplans
1. [Server Authority Cutover](./generation-pipeline-continuation-server-authority-cutover-2026-04-05.md)
2. [Server Authority Execution Checklist](./generation-pipeline-continuation-server-authority-execution-checklist-2026-04-05.md)
3. [Client Demotion](./generation-pipeline-continuation-client-demotion-2026-04-05.md)
4. [Compatibility Retirement](./generation-pipeline-continuation-compatibility-retirement-2026-04-05.md)
5. [Reference Grid Read-Model Simplification](./generation-pipeline-continuation-reference-grid-read-model-simplification-2026-04-05.md)

## Execution Order
1. Phase 0 contract lock
2. Server authority cutover
3. Client demotion
4. Compatibility retirement
5. Reference Grid read-model simplification
6. Validation and closeout

## Current Status
1. Contract lock: planned
2. Server authority cutover: planned
3. Client demotion: planned
4. Compatibility retirement: planned
5. Reference Grid simplification: planned
6. Validation and closeout: planned

## Index Rules
1. Keep this file high level.
2. Put implementation rows in the bucket subplans.
3. Use the master plan for the cross-bucket authority matrix and dependency order.
