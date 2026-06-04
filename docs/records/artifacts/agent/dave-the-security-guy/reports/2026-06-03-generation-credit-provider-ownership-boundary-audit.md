# Generation Credit And Provider Ownership Boundary Audit

Date: 2026-06-03
Agent: Dave the Security Guy
Mode: launch-readiness security audit, no product/UI/UX changes
Repo branch: local `production`

## Scope

This lane checked whether an authenticated user can spend, reserve, release, capture, poll, settle, associate, or attach provider generation state across another user's account by tampering with generation IDs, provider request IDs, media IDs, project IDs, storage paths, motion-reference assets, or pricing inputs.

This audit did not mutate hosted Supabase, provider accounts, Stripe, Vercel, GitHub secrets, production data, UI, UX, or product behavior.

## Ranked Finding Shortlist

| Finding | Severity | Confidence | Trust boundary | Launch impact | ROI |
| --- | --- | --- | --- | --- | --- |
| No confirmed cross-user generation credit/provider ownership leak in audited current code | Informational | High | Authenticated account to credits, provider requests, generation rows, project links, private media refs | Reduces launch uncertainty on one of the highest-risk user-isolation surfaces | High as audit evidence, no code edit |
| Direct-submit proxy test suite currently has non-security failures around direct-submit behavior/tracking expectations | Medium product/test risk, not confirmed security risk | Medium | Provider submit/tracking reliability | May affect launch behavior validation, but does not prove cross-user access or credit leakage | Defer out of Dave security lane unless re-ranked as a security boundary |

## Evidence

Submit routes derive authority server-side:

- `frontend/lib/server/api/falSubmitProxy.ts` requires `requireApiUser`, strips internal context from provider payloads, reads provider keys server-side, computes billing through `chargeGenerationRequest`, and writes generation/tracking rows with `charge.userId`.
- Provider request IDs are bound by `charge.markSubmitted(providerRequestId)`, which passes the authenticated `user.id` and server `sourceRef` to the reservation RPC adapter.
- Project association is best-effort but authority-scoped through `associateGenerationWithProjectForUserBestEffort({ userId: charge.userId, projectId, generationId })`.
- Motion-reference leases pass `userId: charge.userId` and normalize storage paths before lease creation.

Billing and pricing stay server-authoritative:

- `frontend/lib/server/api/generationBilling.ts` computes actual reservation amounts from server pricing policy. Client/displayed credit values are observability only.
- Reservation, submit-link, release, and capture calls in `frontend/lib/server/api/generationBilling/reservationRpcAdapter.ts` pass explicit `p_user_id` from the authenticated user.

Provider status polling fails closed without current-user ownership proof:

- `frontend/lib/server/api/falStatusProxy.ts` calls `resolveProviderRequestOwnership({ userId: user.id, providerRequestId })` before provider fetch or settlement.
- `ownership !== "owned"` returns `403` and does not fetch provider state.
- `frontend/lib/server/api/generationBilling/ownershipResolver.ts` first checks current-user reservation/attempt/generation ownership, then detects another owner as `forbidden`, and leaves projection-only matches as `unknown` rather than `owned`.

SQL/RPC posture matches the account-isolation boundary:

- `sql/migrations/033_fix_atomic_admission_rpc_ambiguity.sql` defines `admit_and_reserve_generation_credits` as `security definer`, `set search_path = public`, checks `auth.role() = 'service_role'` or matching `auth.uid()`, locks on `p_user_id`, scopes existing reservations and active holds by `p_user_id`, and enforces spendable balance before insert.
- `sql/migrations/014_harden_generation_reservation_rpc_security.sql` scopes `mark_generation_reservation_submitted`, `release_generation_reservation_by_source_ref`, `release_generation_reservation_by_provider_request`, and `capture_generation_reservation_by_provider_request` by `p_user_id`.
- `sql/migrations/041_harden_released_reservation_recapture_semantics.sql` preserves that `p_user_id` scoping for release/capture semantics.
- `sql/migrations/040_harden_runtime_rpc_execute_grants.sql` revokes these runtime RPCs from `public`, `anon`, and `authenticated`, and grants execute to `service_role`.
- `sql/migrations/105_enforce_spendable_balance_for_direct_generation_charges.sql` prevents direct generation charges from spending credits already held by active reservations.

Private media/project attachment controls remain user-scoped:

- `frontend/lib/server/api/internalMediaRefResolution.ts` resolves internal media refs with the authenticated `userId` and signs only current-user storage paths.
- `frontend/lib/server/projectGenerationAssociationsService.ts` verifies project ownership and generation/media ownership before associations.
- `frontend/lib/server/motionReferenceVideoAssetLease.ts` requires user-scoped motion-control storage paths before lease writes.

## Highest-ROI Decision Before Edits

No code edit was selected.

Why: the highest-risk candidate was a cross-user generation/credit/provider authority path. Current repo evidence shows the canonical paths already derive authority from the authenticated user, bind provider request IDs to user-scoped reservations, deny unknown provider ownership before provider fetch/settlement, and scope private media/project/motion attachments by user. A patch would be lower ROI than stopping because it would likely add duplicate checks or product/test cleanup without closing a proven launch-risk boundary.

## Validation

Targeted command:

```bash
npm -C frontend test -- --run tests/api/fal-submit-proxy.test.ts tests/api/fal-status.ownership.test.ts tests/api/fal-status-proxy.test.ts tests/api/fal-status.auth-context.test.ts tests/api/fal-status-persisted-results.test.ts tests/api/generation-billing.reservations.test.ts lib/server/api/__tests__/generationBilling.ownershipResolver.test.ts lib/server/api/__tests__/generationBilling.settlementService.test.ts lib/server/api/__tests__/generationBilling.settlementPolicy.test.ts lib/server/__tests__/projectGenerationAssociationsService.test.ts lib/server/__tests__/motionReferenceVideoAssetLease.test.ts
```

Result: 10 files passed and 1 file failed. Passing security-relevant coverage included provider ownership resolver, status ownership denial, status auth context, persisted status results, reservation RPC adapter behavior, settlement service/policy, project association ownership, and motion-reference lease scoping. `tests/api/fal-submit-proxy.test.ts` had 7 direct-submit behavior/tracking expectation failures, mostly `200` expected vs `502` or missing best-effort association/wake calls. Those failures are launch-relevant product/test risk, but this audit did not classify them as a confirmed cross-user security leak.

Documentation validation after Dave framework update:

```bash
npm -C frontend run docs:check
```

Result: passed.

## Residual Launch Risk

- Hosted Supabase grants/RLS were not mutated or live-probed in this lane; this report is based on local SQL and application evidence.
- The direct-submit proxy test failures should be handled by the appropriate product/reliability lane or re-ranked only if a concrete attacker path is proven.
- Provider request ownership still depends on the status route preserving `ownership === "owned"` as the only provider-fetch/settlement condition.

## Stop Condition Reached

Reached. The bounded credit/provider ownership audit did not prove a new high-ROI cross-user security issue, and the next visible work is direct-submit product/test behavior rather than a confirmed account-security boundary. Per Dave's stop condition, record the evidence and stop instead of editing by adjacency.

## Next Highest-ROI Step

Continue only with a fresh, bounded account-isolation lane that has a concrete attacker path, such as a user-controlled ID crossing into account, billing, storage signing, or admin/service-role authority. Do not continue into direct-submit behavior cleanup from this report unless it is re-ranked as a security boundary with current repo proof.
