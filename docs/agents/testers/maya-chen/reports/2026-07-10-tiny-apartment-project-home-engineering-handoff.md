# Engineering Handoff: Tiny Apartment Reset Kit Project Home

Date: 2026-07-10
Tester: Maya Chen
Scenario: Create or verify the project home for Tiny Apartment Reset Kit.
Production surface: `https://www.shortpulse.ai`
Session duration: about 20 minutes.
Credits spent: 0
Run status: completed

## Summary

Maya reused the existing `5-minute renter reset tests` project rather than creating a duplicate, renamed it to `Tiny Apartment Reset Kit`, confirmed both saved images remained present, returned to Dashboard, and verified the new name persisted in the Projects modal. No generation, deletion, upload, billing action, or credit spend occurred.

Decision impact: the core project identity and media-persistence contract worked in production. The remaining concerns are interaction feedback: opening a project requires a select-then-open sequence, and rename propagation briefly leaves the Media field and AI Studio header out of sync.

## Validation Boundary

- Proved through visible regular-user Chrome behavior as Maya.
- Maya did not access Admin or privileged surfaces.
- Rename persistence was verified after returning to Dashboard.
- Two saved Media items remained associated with the same project.
- No code, database, hidden state, or direct customer-state API was used to decide the customer finding.
- No credits were spent.

## Findings

### PH-01: Core rename and persistence behavior works

- Severity: `Positive`
- Customer impact: Maya now has one recognizable project home and trusts it enough to return.
- Protected behavior: project identity, project id, saved media, and right-rail state must survive rename.

### PH-02: Project open requires an initially ambiguous two-step interaction

- Severity: `Visual/copy friction`
- Customer impact: first click selects the tile and changes it to `Open`; Maya can think the click failed.
- Acceptance criteria: selection and open state should be immediately understandable without changing the intentional delete-selection contract.

### PH-03: Rename feedback briefly shows old and new names simultaneously

- Severity: `Visual/copy friction`
- Customer impact: Maya briefly doubts whether the rename saved.
- Acceptance criteria: customer receives immediate save feedback or both visible project-name surfaces reconcile together.

## Agent Fix Packet

- Issue tags: `projects`, `project-rename`, `interaction-feedback`, `saved-work`
- Customer impact: small uncertainty around opening and rename confirmation, with no data loss.
- Product impact: polish and support reduction, not a launch blocker.
- Suspected owning surface: Dashboard Projects modal and AI Studio project-name/header synchronization.
- Likely source boundary: unknown from customer testing; trace canonical project selection/open and rename state owners before editing.
- Canonical fix expectation: preserve current two-step safety semantics while making selection/open and rename-save states explicit.

Validation steps:

1. Open Dashboard Projects with at least two projects.
2. Verify first click communicates selected state and available open action clearly.
3. Open a project with saved media and rename it through Media.
4. Verify field, header, Dashboard Projects entry, and reload/return state converge.
5. Verify saved media count and project id remain unchanged.

Protected behavior:

- Project delete remains a deliberate selection-based action.
- Rename does not create a duplicate project.
- Saved media remains attached.
- Existing project restore continues to work.
- No billing or credit behavior changes.

Stop/escalation condition:

- Stop before changing project identity, deletion semantics, persistence ownership, or cross-project media behavior without owner approval.

## Behavior Metrics

- Time to confident project choice: about 2 minutes.
- Time to verified project-home confidence: about 12 minutes.
- Clarifying questions: 7.
- Backtracks: 2.
- Dead ends: 0.
- Navigation confidence: 4/5.
- Save confidence: 5/5.
- Credits spent: 0.
- Review risk: low.

## Evidence

No screenshots retained; notes and visible return verification were sufficient.

## Admin Publish Status

Published successfully to Agent Tester Reports.

- Ingest proof: HTTP `200`, `ok: true`
- External run id: `2026-07-10-tiny-apartment-project-home`
- Stored row id: `239beaba-0762-4b72-b4e7-c03315d23e5a`
- Maya did not access Admin; owner/operator review is separate.
