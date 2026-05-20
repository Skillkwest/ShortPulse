# Create Workflow Incident SOP

Purpose: define the standing incident-response workflow for Create Workflow when the Create panel attachment/composer lane is broken or production behavior disagrees with local validation.

## Trigger

Use this SOP when a user reports that the AI Studio Create panel workflow is broken, especially for:

- Reference Grid / Quick Slot drag into the Create composer
- composer attachment chips rendering incorrectly
- Create attachment send preparation failures
- production behavior contradicting repo-side tests

## Core Rule

When production still contradicts local fixes, stop patching by intuition.

The next run must preserve an evidence ledger and prioritize runtime capture before another speculative code pass.

## Workflow

1. Load the repo startup contract and Create Workflow memory.
2. Define the exact user-visible symptom:
   - broken icon
   - empty chip
   - flash then dark
   - send failure
   - wrong media type accepted
3. Record the exact source surface:
   - Quick Slot
   - Reference Grid
   - Media Library
   - desktop file drop
   - Standard vs Pulse
4. Check whether the symptom is already represented in the retained incident audit.
5. Separate the problem into these lanes:
   - intake / drag payload
   - staged attachment object
   - chip preview projection
   - send preparation
   - runtime reset / hydration / overwrite
6. If production behavior is still unresolved after local fixes, capture runtime evidence before further patching:
   - staged attachment object immediately after drop
   - staged attachment object after failure state
   - projected preview object
   - final rendered `img.src`
   - console or network errors
   - if available, enable `?createWorkflowDebug=1` or `localStorage.setItem("shortpulse.create_workflow.debug", "1")`, then inspect `window.__shortpulseCreateWorkflowDebug?.getSnapshot()`
   - summarize captured JSON with `node frontend/scripts/create_workflow_debug_report.mjs /path/to/snapshot.json`
7. Only after the evidence lane is captured should implementation continue.
8. Validate the smallest affected local lane with targeted tests and lint.
9. Update retained artifacts with:
   - what was tried
   - what was disproved
   - what remains unverified
   - exact next capture or fix step

## Required Closeout

Every Create Workflow closeout must state:

- current symptom status
- exact code paths touched
- validations run
- unresolved contradictions
- next highest-value step

## Stop Rules

Stop and ask for a runtime capture step when:

- local tests keep passing but production still fails
- the active browser/runtime path is not the one being inspected
- the symptom appears only after a second state transition
- there is still no authoritative staged attachment snapshot from the failing production page
