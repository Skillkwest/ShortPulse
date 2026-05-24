> Archived 2026-05-23 during planning cleanup. Reason: dormant draft plan packet no longer part of the active planning reading path.

# AI Studio Inpaint Reference Contract Phase 5: Validation And Doc Closeout Plan (2026-04-14)

Status: draft  
Owner: Engineering

## Goal
Close the program with focused automated validation, manual confirmation, and durable documentation updates that match the shipped contract and the active route behavior.

## Scope
Phase 5 covers:
1. automated test coverage,
2. manual validation,
3. durable doc updates for the final inpaint contract,
4. program closeout evidence in the tracker and changelog.

## Required Validation
1. Automated coverage for:
   - inpaint payload fields,
   - token behavior by lane,
   - picker/drag affordances by lane,
   - linked-reference transmission or explicit rejection,
   - preflight preparation behavior,
   - inpaint resolution/aspect UI behavior,
   - hidden-model debit/polling behavior,
   - mask/base-image invariants.
2. Manual validation for:
   - one standard edit run with linked refs,
   - one inpaint run using the supported token set,
   - one unsupported inpaint-token path to confirm the expected hide/block/warn behavior if applicable,
   - one direct request inspection path to confirm the final inpaint request body matches the chosen contract.

## Required Docs Updates
Update the final supported behavior in the relevant durable docs:
1. `docs/sops/sop_ai_studio_expert_edit_prompt_references.md`
2. `docs/sops/sop_image_generation.md`
3. `docs/api/api-fal-flux-pro-fill.md` if FLUX Fill remains part of the contract
4. `docs/api/api-internal-routes.md` if the generic route behavior remains part of the durable integration story
5. any additional model/provider doc introduced by a provider-lane change

## Deliverables
1. final validation evidence in code/tests,
2. updated durable docs for the chosen contract,
3. tracker closeout with no unresolved ambiguity about supported inpaint behavior,
4. route and payload docs that match the shipped runtime.

## Non-Goals
1. No additional feature expansion after validation starts.
2. No reopening of the contract decision unless validation proves the chosen contract non-viable.

## Entry Criteria
1. Phases 1-4 are complete.
2. The implementation behavior is stable enough to validate.

## Exit Criteria
1. Tests pass for the chosen contract.
2. Manual validation confirms the shipped behavior matches the documented behavior.
3. Durable docs are updated.
4. The tracker can mark the program complete.
5. No durable doc still implies that inpaint supports linked provider images unless that behavior is actually shipped.
6. No durable doc still implies the obsolete direct FLUX Fill route is the primary client path if the generic route remains the active runtime.

## Validation
1. Re-run the focused inpaint payload and prompt-link suites.
2. Add or update tests for the Edit panel selector state, authoring affordances, debit/polling path, and mask contract.
3. Confirm docs describe only shipped behavior.
4. Confirm a real request capture or equivalent instrumentation matches the final documented payload.

## Rollback Note
If final validation fails, roll doc claims and tracker status back to the last verified contract and reopen the failing phase rather than force-closing the program.
