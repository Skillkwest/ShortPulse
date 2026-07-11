# Model Pricing Grid Billed-Credit Authority Plan

## Plan status

- Status: local implementation complete; production mutation remains blocked pending the explicit approvals and production proof boundary below.
- Incident in scope: Seedance generation quotes can disagree between the displayed quote and the server when video references change the pricing variant or quantity. ADR 0100 then correctly returns HTTP 409 before reservation, provider submission, or debit, but the user sees a misleading pricing-update loop.
- Product direction: for the same Seedance model, resolution, and output duration, customer credits must be identical whether the request contains no assets, images, audio, video, or any mixture of those assets.
- This plan supersedes the earlier Seedance-specific statements in this file that preserved separate customer `video_input:none` and `video_input:with` rows. A new ADR must supersede only the Seedance clause in ADR 0088; ADR history must not be rewritten.

### Local buildout checkpoint — 2026-07-11

- Implemented locally: policy-gated customer identity, `per_output_second`, five-row publication, customer/provider parameter separation, explicit client/server duration validation, custom-row collision blocking, workspace v2 freshness, target dry-run, reviewed-artifact gate, expected-active-row CAS migration, diagnostics, tests, ADR 0101, and contract documentation.
- Fresh read-only production source: active policy v9, active row id 10, last-known-safe v8/id 9, no active Seedance custom rows.
- Legacy materialized artifact proof: 10 split Seedance customer rows; SHA-256 `0d506ed967cc2cd8c658811e6929c7a14f5598d21eed0ced40ae6de0c9fcf455`.
- Non-mutating target preview: 5 added normalized rows, 10 removed split rows, 0 changed rows, 5 continuity-versus-equal-duration rate comparisons, and 100 margin-envelope cases; candidate SHA-256 `899ce54efda8978e7ccfee743576d6f6d8f9ea7f3bd281310134d63aaa2713ad`.
- Activation blocker: the default continuity-rate candidate reaches a modeled margin of `-$2.79` in the reviewed envelope. The five customer rates and acceptable margin floor remain unapproved.
- No SQL migration, deployment, policy activation, paid generation, debit, commit, or push occurred at this checkpoint.

## Planning frame

### Objective

Publish and consume one composition-neutral customer billed-credit rule per supported Seedance model and resolution, with output duration as the only Seedance quantity dimension. Preserve the provider's input-sensitive cost calculation as internal economics evidence and preserve all reference validation and provider payload behavior.

“One price” means one customer price for the same model, resolution, and output duration. It does not mean a flat price across resolutions or output durations.

### Owner and active lane

- Owner/operator: the solo ShortPulse owner.
- Implementation lane: the model-pricing policy/control plane, Seedance pricing publication, AI Studio video quote/submit path, and generation billing enforcement.
- Canonical authoring surface: `/admin/pricing` and its policy apply path.
- Canonical enforcement boundary: `chargeGenerationRequest` in `frontend/lib/server/api/generationBilling.ts` before reservation or provider dispatch.
- Provider payload, model admission, and unrelated admin/product areas remain outside this lane.

### Approved scope

- Add a policy-declared Seedance customer billing profile that collapses `video_input` as a customer billed-credit dimension.
- Add a distinct output-only quantity basis without changing the meaning of existing quantity bases.
- Publish exactly five Seedance customer rows:
  - Seedance 2: 1080p, 720p, and 480p.
  - Seedance 2 Fast: 720p and 480p.
- Make display, model-picker quote, credit guardrail, optimistic debit, submit evidence, server debit, reroll, reload, and restore resolve the same customer rule.
- Keep raw input-video count and duration for provider validation, provider cost calculation, and margin observability.
- Migrate Seedance policy/custom-row data through a non-mutating dry-run and an atomic compare-and-swap apply path.
- Classify same-policy setting/quote mismatches accurately while preserving the existing fail-closed HTTP 409 contract.
- Add focused tests, authority checks, documentation, rollout checks, and rollback proof.

### Non-goals

- Changing prices for other model families.
- Kie Seedance 2 4K admission, Seedance 2 Mini, or Seedance 2 Fast 1080p.
- Changing provider request payloads, reference staging, supported modes, or provider selection.
- Provider actual-usage ingestion beyond preserving modeled-cost telemetry.
- Subscription, top-up, Stripe, storage, grant, or reimbursement behavior.
- General admin redesign, mobile work, broad cleanup, or renaming the existing publication materializer solely because its name is stale.
- A second pricing catalog, a parallel billing engine, runtime fallbacks, or permanent legacy authorities.
- Production deployment, policy activation, paid generation, credit spend, commit, or push as part of planning.

### Protected contracts

- Preserve the current admin calculator UX, saved production policy history, and all non-Seedance settings.
- Active policy v9 remains immutable and behaviorally split until a reviewed v10 artifact is atomically activated.
- A rollback to v9 restores the exact legacy split-row behavior.
- Preserve output-duration and resolution controls and their effect on price.
- Preserve Seedance reference-video duration collection, workflow sidecars, reroll evidence, the 15-second aggregate limit, and fail-closed handling of unknown/invalid duration.
- Preserve provider payload construction, upload/staging behavior, mode exclusivity, and reference-slot semantics.
- Preserve ADR 0100: stale or mismatched quote evidence returns HTTP 409 before reservation/provider submission, with no automatic retry.
- Preserve optimistic-debit cleanup and placeholder cleanup on failure.
- Preserve global AI Studio right-rail state and desktop UI layout.
- Customer billing never falls back to provider USD, markup, conversion, compiled rate constants, or an economics-only variant.

### Source of truth

Product and authority documents:

- `docs/adr/0088-admin-priced-billed-credit-authority.md`
- `docs/adr/0100-pricing-policy-submit-handshake.md`
- `docs/adr/0068-model-pricing-control-plane.md`
- `docs/product/ai-studio-pricing.md`
- `docs/sops/sop_video_generation.md`

Policy, variant, publication, and economics sources:

- `frontend/lib/model-runtime/pricingPolicy.ts`
- `frontend/lib/model-runtime/pricingGridVariantRules.ts`
- `frontend/lib/model-runtime/modelPricingVariants.ts`
- `frontend/lib/model-runtime/pricingStrategies.ts`
- `frontend/lib/model-runtime/materializeImageBilledCreditPolicy.ts`
- `frontend/lib/model-runtime/pricingGridBilledCredits.ts`
- `frontend/features/admin/pricingCostDocs.ts`
- `frontend/features/admin/pricingCustomRows.ts`
- `frontend/features/admin/logic/pricingWorkspacePersistence.ts`
- `frontend/features/admin/PricingModelWorkbookTable.tsx`
- `frontend/lib/server/api/modelPricingControlPlane.ts`

Runtime consumers and enforcement:

- `frontend/features/ai-studio/hooks/useActiveModelPricingPolicy.ts`
- `frontend/features/ai-studio/hooks/useAiStudioViewModel.ts`
- `frontend/features/ai-studio/hooks/useAiStudioVideoPanelProps.ts`
- `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
- `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
- `frontend/features/ai-studio/logic/rerollPricingEvidence.ts`
- `frontend/lib/server/api/generationBilling/pricingParams.ts`
- `frontend/lib/server/api/generationBilling.ts`
- the Seedance submit proxy, workflow reload, output bootstrap, project snapshot, generation trace, and credit-ledger mappers discovered from these call paths.

### Proof requirements

Implementation is locally complete only when tests prove:

- v9 remains split and unchanged; the new profile is composition-neutral; rollback restores v9 semantics.
- all five normalized customer rows publish exactly once with no customer `video_input` dimension.
- every supported asset composition resolves the same customer variant and credits at fixed model/resolution/output duration.
- input-video duration changes provider cost evidence but never customer credits.
- display, submit evidence, debit, reroll, reload, and restore agree.
- missing/invalid/over-limit video duration fails before reservation or provider dispatch.
- custom-row collisions, stale active state, incomplete artifacts, and stale artifact hashes fail closed.
- provider-economics records cannot be selected as customer billed authority.
- no non-Seedance pricing behavior changes.

Production completion is a later boundary and requires deployed v9 compatibility proof, reviewed v10 dry-run evidence, explicit rate/artifact approval, atomic activation/readback, authenticated quote parity, and separately authorized paid debit proof.

### Stop condition

Stop implementation before any production policy activation or billing change until the owner explicitly approves:

1. the five normalized customer rates;
2. output duration as the sole Seedance customer quantity basis;
3. the acceptable margin exposure for long video references;
4. treatment of existing split-row custom overrides and rounding; and
5. whether activation may increase prices for existing users.

Also stop on an unresolved custom-row collision, missing active-policy evidence, incomplete row coverage, policy/hash compare-and-swap failure, validation failure, or any solution that requires changing protected provider/UI/security/persistence behavior.

## Current repo truth and root cause

1. Seedance customer identity is currently expanded by `VIDEO_INPUT_EXPANDED_PRICING_STRATEGIES`, so the admin publisher emits resolution × `video_input:none|with` rows.
2. The current customer quantity basis `per_second` can include output duration plus input-video duration. It must retain that legacy meaning for v9 and other consumers.
3. Client quote calculation and server billing reconstruct references and durations at different moments. A video reference can therefore change the requested variant or quantity between the displayed quote and submit evidence.
4. The server correctly rejects the mismatch with HTTP 409 before reservation/provider dispatch. The reported “pricing updated” loop is therefore a customer identity/quantity mismatch, not a provider generation failure or debit failure.
5. `modelPricingControlPlane.ts` dynamically materializes only active version 9 as `legacy_v9_materialized`. A global variant-rule change would silently reinterpret v9 on deploy and make rollback unsafe.
6. `pricingGridBilledCredits.ts` currently derives provider observability from pricing parameters also used for customer lookup. Collapsing those parameters without separating the inputs would falsely record the no-video provider branch.
7. Unknown input-video duration currently fails partly through price resolution. When customer pricing no longer depends on that duration, explicit client and server validation becomes mandatory.
8. Custom Seedance rows can collapse onto the same normalized ID. Last-write-wins migration would silently change billing authority and is prohibited.
9. Admin workspace localStorage v1 can restore stale split-row drafts. A stale browser draft must never be a migration or activation source.

## Provider economics finding

The provider has two internal unit-rate classes, and the video-input unit rate is lower while its quantity includes input plus output duration. Consequently, “highest price” is ambiguous:

- Highest comparable unit rate: the current no-video/image-reference rate.
- Highest equal-duration scenario: `max(no-video rate, 2 × with-video rate)`.
- Highest permitted total: a long input-video run, which is much more expensive in total even with the lower unit rate.

For example, Seedance 2 at 720p costs 41 provider credits per output second without video and 25 provider credits per input-plus-output second with video. A 4-second output with a 15-second input costs 164 versus 475 provider credits. Therefore, simply choosing the no-video unit rate does not guarantee margin coverage, while charging the maximum permitted total would severely overprice short and non-video runs.

The implementation must not derive a customer rate dynamically from asset composition. The owner chooses one explicit published business rate per normalized row after reviewing margin envelopes. Provider formulas remain internal observability inputs.

## Approaches considered

### Technical architecture

| Approach                                                                               | Benefits                                                                                                                      | Risks and likely breakage                                                                                        | Verdict                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Hide/remove the video rows in the admin UI only                                        | Small visual diff                                                                                                             | Runtime still requests split IDs; missing rows or 409 loops continue; admin and debit authorities diverge        | Reject                     |
| Globally collapse Seedance variant rules                                               | Small code diff                                                                                                               | Deploy silently reinterprets active v9; rollback no longer restores prior prices; legacy custom IDs may collapse | Reject                     |
| One row but retain input-plus-output customer quantity                                 | Reduces visible row count                                                                                                     | A video reference still changes customer price, so it does not meet the product contract                         | Reject                     |
| Create a second customer/provider pricing catalog now                                  | Strong conceptual separation                                                                                                  | Duplicates authority and greatly expands schema, admin UX, migration, and operational scope                      | Reject for this correction |
| Policy-gated composition-neutral customer profile with separate raw provider economics | Preserves v9, supports atomic v10 activation, fixes the canonical identity and quantity seams, retains provider cost evidence | Requires coordinated policy, admin, runtime, migration, and validation work                                      | Recommend                  |

### Numeric rate policy

The figures below are provider-credit reference points, not approved customer billed-credit values.

| Candidate                             | Seedance 2 1080/720/480 | Fast 720/480    | Benefit                                                                                                                         | Risk                                                                                              |
| ------------------------------------- | ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| No-video unit baseline                | 102 / 41 / 19           | 33 / 15.5       | Preserves the current text/image/audio unit basis and likely matches “with image” intent                                        | Reference-video provider cost exceeds it once input duration is roughly 64–72% of output duration |
| Equal-duration conservative           | 124 / 50 / 23           | 40 / 18         | Covers provider cost when input-video duration is no greater than output duration; strongest default candidate for owner review | Raises non-video rates about 16–22% and still undercovers longer inputs                           |
| Literal maximum permitted total       | 1860 / 750 / 345 fixed  | 600 / 270 fixed | Covers every currently permitted modeled run                                                                                    | Breaks duration proportionality and overprices short non-video runs by roughly 4.3–4.6×           |
| Explicit admin-authored business rate | Owner-selected          | Owner-selected  | Preserves the admin pricing authority and can encode an intentional margin/subsidy policy                                       | Requires explicit approval and current production override evidence                               |

Recommended rate process: use explicit admin-authored rates, with the equal-duration conservative values included in the dry-run as the default comparison candidate and the no-video values as the continuity comparison. Do not hardcode “highest” or automatically select a rate during migration.

## Recommended design

### 1. Policy-declared customer billing profile

- Add an explicit per-model profile such as `billingVariantProfile: "seedance_composition_neutral_v1"` to the normalized, compacted, equality, and artifact-hash contracts in `pricingPolicy.ts`.
- Profile absent means legacy split behavior. This preserves v9 and all unrelated models.
- Add `per_output_second` as a new published quantity basis. It reads normalized output duration only.
- Do not change legacy `per_second`; v9 and rollback must retain output-plus-input behavior where currently defined.
- Unsupported profiles and quantity bases fail closed.

### 2. Customer identity and provider economics separation

- Replace strategy-only customer-dimension expansion with a model-and-policy-aware resolver.
- Under the new profile, customer `resolveModelPricingVariantId` omits `video_input`; resolution and other already-normalized customer dimensions remain unchanged.
- Keep low-level provider variant construction split by video input so `computeSeedancePerSecondCost` still receives raw input count/duration and can select the correct internal rate.
- Resolve customer billed credits from normalized customer parameters, but compute provider raw cost from the original server-validated request parameters.
- Preserve split provider variant objects only as economics/observability records with customer billed overrides and customer quantity rules removed. They must be excluded from customer publication completeness and lookup.
- If immediate operator editing of hidden provider rates is required, stop: that is a separate admin UX/schema decision, not a reason to add a parallel customer authority here.

### 3. Explicit duration safety

- Reuse one Seedance reference-duration validator across client and server semantics.
- A request with video references requires positive duration evidence and an aggregate duration no greater than 15 seconds.
- The client may display the stable customer price while duration is being resolved, but Generate remains disabled with an accurate validation message.
- The server repeats validation before reservation or provider dispatch so direct or stale clients cannot bypass it.
- Preserve duration through slots, submit context, reroll evidence, workflow reload, output bootstrap, and project restore.

### 4. Strict publication and migration

- The normalized candidate publishes exactly three Seedance 2 and two Seedance 2 Fast customer rules and no customer split rules.
- Generic custom-row normalization preserves stored legacy IDs/specs. A policy-aware migration maps them deliberately.
- Reject two custom rows targeting the same normalized customer ID, a custom row colliding with a built-in normalized rule, or any unresolved `video_input`-specific customer intent.
- Never choose a winning override by numeric maximum or write order.
- Migrate or invalidate stale Seedance variant IDs in admin simulator/usage-mix state. Version the pricing workspace storage key so v1 split-row drafts cannot be applied as v10 input.
- A dedicated non-mutating migration dry-run reads the exact active policy and custom rows, not browser state. It returns the active version ID, proposed rates, five-row completeness, added/changed/removed rules, collisions, margin envelopes, and a deterministic artifact hash.
- Apply rebuilds the candidate, verifies the reviewed hash, and calls the canonical advisory-locked RPC with the expected active policy version ID. The RPC compares that ID to the active pointer while holding the lock.

### 5. Runtime parity and conflict semantics

- Make policy fetch/cache, Create/Video display, model picker, required-credit guard, optimistic debit, submit context, server lookup, reroll, reload, and restore consume the policy-aware customer resolver.
- Keep client evidence an equality/version contract, never a server candidate-selection authority.
- Preserve missing-authority and stale-policy rejection before reservation/provider submission.
- Distinguish a same-policy setting/quote mismatch from an actual policy version update in the user message. Do not retry or submit automatically.
- Charge/trace metadata records customer policy version, profile, variant, rule, and billed credits separately from provider scenario, unit rate, output duration, input-video duration/count, modeled raw cost, billed revenue, and modeled margin.

## Implementation sequence

### Phase 0: characterize and freeze the migration input

1. Read production policy v9 and active custom rows through the canonical control plane without mutation.
2. Record exact Seedance split rows, billed overrides, quantity rules, rounding, and custom collisions.
3. Add characterization tests for v9 policy materialization, client/server quote parity, 409-before-reservation behavior, duration validation, reroll/reload, and provider raw cost.
4. Record the current focused-test and authority-check baseline.

Stop if current production rows/custom overrides cannot be read or their normalized intent is ambiguous.

### Phase 1: add dual-contract policy capability

1. Add the policy profile and `per_output_second` schema support, including normalization, compaction, equality, serialization, and hashing.
2. Make customer dimension resolution policy-aware; profile absent preserves the legacy split.
3. Preserve generic custom-row IDs during generic normalization and add policy-aware migration validation.
4. Add policy tests proving v9 is byte/behavior compatible and a profile-bearing candidate is composition-neutral.

### Phase 2: separate canonical customer and provider inputs

1. Introduce explicit `customerPricingParams` and `providerCostParams` at the canonical breakdown boundary.
2. Use normalized model/resolution/output duration only for customer identity and quantity under the new profile.
3. Use original server-validated input count/duration for provider economics.
4. Preserve economics-only split records without making them customer billed authorities.
5. Extend charge/diagnostic metadata and verify trace/ledger mappers cannot mislabel an economics delta as a display/debit mismatch.

### Phase 3: publish the five-row admin contract

1. Make cost docs, workbook row construction, formatting, custom rows, simulator, and materialization policy-aware.
2. Remove `with`/`none` labels and selectors only for profile-bearing Seedance customer rows.
3. Publish exactly five complete customer rules with `per_output_second`.
4. Add custom-row collision rejection and deterministic stale simulator/draft handling.
5. Preserve the current calculator layout and all non-Seedance rows/settings.

### Phase 4: wire all quote and submit consumers

1. Update active-policy fetch/cache and refresh behavior.
2. Update video quote branches, model picker, CTA props, required-credit guard, optimistic debit, and displayed evidence.
3. Update submit context and server extraction/debit to use the collapsed customer rule while retaining raw provider parameters.
4. Add explicit duration validation before client Generate and before server reservation.
5. Update reroll, workflow reload, output bootstrap, and project restore to preserve duration and resolve the current profile correctly.
6. Classify same-policy quote-setting conflicts accurately without changing the HTTP 409/no-retry behavior.

### Phase 5: build the target dry-run and atomic apply

1. Extend the canonical control plane with a target-aware v10 dry-run that starts from freshly read active v9 plus active custom rows.
2. Report five added normalized rules, ten removed split customer rules, exact changed rules, collision/completeness results, proposed rates, and margin envelopes for output 4/5/10/15 seconds × input 0/2/5/10/15 seconds.
3. Hash the normalized candidate and require that reviewed hash plus the expected active version ID during apply.
4. Enforce the expected version comparison inside the advisory-locked RPC.
5. Keep v9 immutable as `last_known_safe` and retain its compatibility reader until the documented removal condition is met.

If live deployment compatibility requires a temporary RPC overload, document its owner, validation, and removal condition; it may not become a permanent duplicate apply authority.

### Phase 6: document and validate

1. Add a new ADR superseding only ADR 0088's Seedance split-row/input-plus-output customer contract; add a pointer from ADR 0088 rather than rewriting history.
2. Update the pricing product doc, control-plane SOP, video generation SOP, AI Studio index, API/diagnostic wording, and change log.
3. Run the full focused matrix and repository gates below.
4. Audit the final diff for global strategy flips, fallback paths, duplicate authorities, non-Seedance drift, and unrelated cleanup.

### Phase 7: later production rollout boundary

1. Deploy dual-contract code while v9 remains active.
2. Prove production still reads/materializes the exact split v9 contract.
3. Run the non-mutating v10 dry-run against the fresh active version and review rates, collisions, margin envelopes, diff, and artifact hash.
4. Stop for explicit owner approval of the five rates and candidate artifact.
5. Apply v10 atomically with expected-version CAS and read back the active version, hash, custom rows, profile, quantity basis, and five-row manifest.
6. Prove authenticated no-spend quote parity across asset compositions.
7. Run a paid generation/debit proof only under separate explicit spend authorization.
8. Observe billing/provider economics; rollback to immutable v9 on a material display/debit, validation, or margin safety failure.

## Validation matrix

### Policy and publication

- Profile and `per_output_second` survive normalize/compact/equality/hash round trips.
- Profile absent produces legacy split v9 IDs/rules; profile present produces collapsed IDs/rules; rollback restores split behavior.
- Unsupported profile/basis fails closed.
- Generic custom-row normalization preserves legacy IDs; policy-aware migration rejects duplicate collapsed targets.
- Seedance 2 publishes exactly 3 rows and Fast exactly 2, with no customer video-input selector or labels.
- Dry-run is deterministic, reports the exact five-add/ten-remove baseline plus custom changes, rejects collisions/incompleteness, and produces a stable hash.
- Provider economics records survive but cannot appear in published customer rule enumeration or customer lookup.

### Pricing math

- Both models × every active resolution × output 4/5/9/10/15 seconds × asset composition `{none, image, audio, video, image+audio, image+video, video+audio, all}`.
- Within a fixed model/resolution/output duration, every composition resolves the same customer variant and credits.
- Varying input-video count/duration never changes customer credits.
- Resolution and output duration continue to change customer credits.
- Provider raw breakdown still selects the correct no-video/with-video rate and includes input plus output duration where applicable.
- `per_output_second` preserves the workbook's required rounding order.

### UI, submit, server, and persistence

- Generate CTA, selected-model quote, model picker, balance guard, optimistic debit, submit evidence, and server debit agree.
- A direct selected video asset and a linked-element video each flow from slot state through displayed quote, submit context, and server billing without a false 409.
- Unknown, invalid, or over-15-second input-video duration blocks before reservation/provider dispatch; known valid duration does not affect the customer quote.
- Missing published customer authority fails closed.
- v9 evidence is accepted before v10, v10 evidence after activation, and cross-policy evidence is rejected.
- Failure removes placeholders and optimistic debit exactly once.
- Reroll/reload/project restore preserve reference duration and resolve the same current customer price.
- Admin stale usage selections normalize visibly; stale v1 Seedance drafts cannot be applied.
- Concurrent apply with a stale active-version ID or mismatched artifact hash is rejected.
- Trace/ledger output shows display equals debit and reports provider economics separately.

### Repository gates

- Focused policy, pricing, admin, video, billing-route, reroll, reload, and persistence suites.
- `npm run check:pricing-authority`.
- Generate CTA contract check, pricing display-drift check, and pricing action inventory.
- Type check, focused lint, docs check, and production build.
- `git diff --check` and a final scoped-diff/self-audit.

## Rollback and temporary compatibility

- Policy v9 remains immutable and is the rollback artifact.
- The profile is absent in v9, so rollback restores the exact six-row Seedance 2 and four-row Fast customer contract.
- Old tabs crossing the version boundary refresh through ADR 0100 conflict handling and never submit/debit automatically.
- `legacy_v9_materialized` may be removed only after v10 is active, production readback and observation are complete, rollback requirements have been deliberately retired, and the owner approves removal.
- Any temporary RPC overload required for deploy ordering is removed after all supported deployed callers use the CAS signature and the active v10 readback is stable.

## Remaining unproven decisions

- The exact active v9 Seedance customer rows, custom overrides, and browser-independent migration input still require a fresh read-only production snapshot at implementation time.
- The five normalized customer billed-credit rates are not approved. Equal-duration conservative rates are the recommended comparison candidate, not an automatic migration rule.
- Real customer input-video duration distribution and the acceptable margin floor/subsidy are unknown.
- No production deployment, v10 activation, authenticated quote readback, paid generation, or debit proof has occurred under this plan.

## Exact implementation proof boundary

Local implementation may proceed autonomously through dual-contract code, tests, documentation, a deterministic non-mutating dry-run, and a self-audited diff while v9 remains active. It must stop before assigning unapproved production rates, deploying, activating v10, or spending credits.

The next decision boundary is owner review of a fresh dry-run containing the exact active v9/custom-row snapshot, the five proposed rates, margin envelopes, rule diff, collision report, and candidate artifact hash. Only explicit approval of that packet authorizes atomic v10 activation. Production closure then requires readback of the activated artifact plus authenticated quote parity; paid generation/debit proof remains a separate spend boundary.
