> Archived 2026-05-23 during planning cleanup. Reason: dormant draft plan packet no longer part of the active planning reading path.

# AI Studio Inpaint Reference Contract Tracker (2026-04-14)

Last updated: 2026-04-14  
Status: draft  
Owner: Engineering

## Tracker Rules
1. Do not mark a phase complete unless code, tests, docs, and cleanup obligations for that phase are complete.
2. Do not let prompt authoring or prompt-token behavior imply provider capabilities that the final payload does not transmit.
3. If the product requirement changes from single-image masked edit to multi-reference masked edit, stop and update Phase 1 instead of stretching a completed phase.
4. If the effective inpaint model changes, treat debit, polling, and route/doc parity as first-class work items.
5. Every phase must preserve a rollback note.
6. This tracker is the operational source of truth for the inpaint-reference contract program.

## Planning-Task Done State
The planning task is done when:
1. the master plan, tracker, and all five phase plans are published,
2. `docs/README.md` and `docs/planning/README.md` reference the full plan set,
3. `docs/change_log.md` records the publication of the plan set,
4. the plan set defines the stop rule and the program done state.

## Program Phases

| Phase | Status | Goal | Entry Criteria | Exit Criteria | Rollback Note |
| --- | --- | --- | --- | --- | --- |
| 1 | Planned | Lock the inpaint contract, token semantics, authoring affordances, mask contract, and provider-lane posture before implementation. | Current audit accepted as baseline. | Supported token set, authoring affordances, provider lane, and mask contract are explicit. | If agreement is not reached, keep current behavior documented as the baseline and do not start implementation. |
| 2 | Planned | Reconfirm current runtime behavior, current doc drift, and implementation guardrails from the chosen contract. | Phase 1 contract is explicit. | Payload, preflight, UI-authority, billing, polling, and docs gaps are written down with no unresolved ambiguity. | Leave runtime behavior unchanged; publish unresolved blockers instead of partial implementation. |
| 3 | Planned | Align prompt authoring, prompt compilation, reference-input construction, preflight work, and provider payload behavior. | Phase 2 guardrails accepted. | Inpaint prompt/payload behavior matches the chosen contract and unsupported linked refs no longer leak through authoring or submit paths. | Revert to the previous single-image payload path and disable unsupported linked refs if the new lane proves unstable. |
| 4 | Planned | Harden the mask contract and authoritative model/UI/billing/polling behavior. | Phase 3 payload behavior is stable enough to validate UI and mask assumptions. | Mask invariants are explicit and the Edit panel, debit path, and polling behavior derive from the authoritative effective model contract. | Re-enable the prior UI/model state only if the new authority wiring causes blocking regressions, while keeping unsupported options hidden. |
| 5 | Planned | Close the program with validation, durable docs, and explicit supported-user guidance. | Phases 1-4 are complete. | Tests, manual verification, and docs all reflect the chosen contract and route behavior. | Roll back doc claims to the last confirmed contract if final validation fails. |

## Current Locked Findings
1. The current FLUX Fill inpaint lane sends only `image_url`, `mask_url`, and prompt-oriented fields.
2. `@main` maps to the actual transmitted base image.
3. `@img1`, `@img2`, and `@img3` can be compiled into prompt text and preflighted without becoming transmitted provider inputs.
4. The current authoring surface still exposes prompt token affordances that are not lane-qualified for inpaint.
5. The current UI can show `Pulse Fill v1` while still exposing stale resolution options such as `2K`.
6. The current submit path is the generic Fal image route, while durable FLUX Fill docs still center the legacy dedicated route.
7. The current prompt-reference SOP does not clearly distinguish standard edit `image_urls` behavior from the inpaint exception.
8. The current mask path exports a separate PNG aligned to the flattened base image, but polarity/framing/base-mask invariants are not yet explicit in docs/tests.
9. The current inpaint payload carries no resolution field, so the visible `2K` state is a UI contract issue rather than a direct provider payload field.
10. The hidden-model submit path also affects debit and polling-provider behavior, so model changes must account for those seams.

## Phase Links
1. `docs/archive/planning/ai-studio-inpaint-reference-contract-master-plan-2026-04-14.md`
2. `docs/archive/planning/ai-studio-inpaint-reference-contract-phase-1-target-contract-plan-2026-04-14.md`
3. `docs/archive/planning/ai-studio-inpaint-reference-contract-phase-2-current-state-audit-and-guardrails-plan-2026-04-14.md`
4. `docs/archive/planning/ai-studio-inpaint-reference-contract-phase-3-lane-and-payload-alignment-plan-2026-04-14.md`
5. `docs/archive/planning/ai-studio-inpaint-reference-contract-phase-4-mask-and-ui-contract-hardening-plan-2026-04-14.md`
6. `docs/archive/planning/ai-studio-inpaint-reference-contract-phase-5-validation-and-doc-closeout-plan-2026-04-14.md`
