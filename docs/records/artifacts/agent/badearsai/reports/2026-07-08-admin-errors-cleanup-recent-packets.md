# Admin Errors Cleanup: Recent Packets - 2026-07-08

Status: completed production Admin Errors queue cleanup for the two recent copied triage batches.

## Packet Sources

- `/Users/worldbuilder/.codex/attachments/3d462e4b-309e-47a9-91db-78700f156a43/pasted-text.txt`
- `/Users/worldbuilder/.codex/attachments/af1c01c1-ea99-465b-9a87-149afb60fd26/pasted-text.txt`

Total reviewed incidents: `28`.

## Production Proof Used

- Production row lookup found `28 / 28` pasted incident IDs in `app_error_logs`.
- `node scripts/verify_deployment_route_parity.mjs --base-url https://www.shortpulse.ai` passed against deployment `shortpulse-7su05l3jw-kirk-artmans-projects.vercel.app`, created `2026-07-08T21:57:51.302Z`.
- Unauthenticated production `POST /api/media/admit-image-asset-from-storage` returned `401`, proving the current route exists and fails closed; the pasted `404` was stale route-surface evidence.

## Status Cleanup Performed

Final production status count for the reviewed IDs:

- `open`: `0`
- `resolved`: `19`
- `ignored`: `9`

### Ignored

- `90f840bb-5a0a-4cfc-8a27-e02b12e6235e`: deploy-skew chunk-load noise after route parity passed.
- `3180e097-08c2-4ee9-a3c6-9412aa5543a2`: deploy-skew chunk-load noise after route parity passed.
- `c34dbbde-cc59-4950-b224-3d63bde5786b`: deploy-skew chunk-load noise after route parity passed.
- `943a5c1d-0d7b-4f7b-a131-2e0eceb0cd4e`: stale `/api/media/admit-image-asset-from-storage` `404`; current route returns `401`.
- `b2a95985-28f0-4550-b21c-b6830b3ceb7c`: expected subscription-change `409` conflict response.
- `5642da0c-f61d-47ba-8b0d-7891e4db02f0`: expected style-preview `429` rate-limit response.
- `4a7c766a-1e54-4be3-932c-c6925cf559b4`: expected provider/content-processing rejection.
- `239eacc0-3b2d-4268-aabd-2bbede9b792a`: older duplicate/superseded Kie upload upstream incident; fresher Kie cluster kept open.
- `14c83dc4-aeec-4946-ba0c-902992ce8b4d`: older client mirror of Kie upload failure; fresher Kie cluster kept open.

### Resolved With Watch

- `00e0313d-73f4-4ab2-abf9-c9c8eaff921a`: singleton Admin `/api/admin/users` network failure.
- `d16d32fd-163d-4aff-9357-057fc42cae0d`: singleton aborted Kie generation signal.
- `f28aa514-7ea2-48df-8374-ce0fe28fb42d`: singleton Kie generation `Failed to fetch`.
- `7c55b438-687f-463d-a607-4bf9ee525957`: worked recovery timeout from first packet; watch for fresh repeats.
- `75a1f0a1-84a7-484a-a0c2-8199f38736fa`: worked recovery abort from first packet; watch for fresh repeats.
- `0c9479f4-f7ad-446e-bbfb-e9ccebeb5f08`: worked generation timeout from first packet; watch for fresh repeats.
- `283b83ff-d37a-4af2-9a64-7b5010bb1910`: worked recovery timeout from first packet; watch for fresh repeats.
- `00c08b98-6db5-4ba1-a3f6-e9c2fb28f5c7`: worked finalize-upload save failure; watch for fresh structured repeats.
- `e61473de-3cab-4a32-b976-c3027d065f21`: worked finalize-upload `500`; watch for fresh structured repeats.
- `cc33b3f1-3fd6-4c90-950e-869b0d7f27ba`: worked finalize-upload server exception; watch for fresh structured repeats.
- `6243404f-2497-4cf4-b661-450ed7d44fb5`: generation/projection/output/media evidence is now `success`/`ready`/`saved`/`published`; watch for fresh same-fingerprint recurrence.
- `710114eb-9aa6-48c1-a9df-b545b5d376f3`: generation/projection/output/media evidence is now `success`/`ready`/`saved`/`published`; watch for fresh same-fingerprint recurrence.
- `df97d65b-aa25-474f-be5c-b91f876acc79`: generated-media save handle was stale, but canonical projection is saved/published; watch for fresh same-fingerprint recurrence.
- `faddcd21-1f77-489a-8934-e582d0128d3e`: generated-media tracking warning was stale, but canonical projection is saved/published; watch for fresh same-fingerprint recurrence.
- `4c50211d-b227-44a6-b3a6-6a35556417c6`: save attempt failed before convergence, but later canonical projection is saved/published; watch for fresh same-fingerprint recurrence.
- `f3f4946d-8724-4202-9f3a-be8d37f873b6`: billing `501` predates the production full-price Stripe Portal config; current Vercel production env has the required Stripe keys and no exact recurrence after the config/deploy window.
- `23c23ef3-ea6e-4dbd-b99f-96542ebbbd97`: Kie upload upstream `500` cluster; source retry fix deployed and no fresh same-fingerprint recurrence after current production deployment.
- `9771bb35-36dd-4255-9c43-bdb3a00d1193`: Kie GPT Image 2 reference staging cluster; source retry fix deployed and no fresh same-fingerprint recurrence after current production deployment.
- `446d517f-98f3-4578-b29b-160ccc2d9be2`: Kie reference file upload failure client mirror; source retry fix deployed and no fresh same-fingerprint recurrence after current production deployment.

## Source Fix Completion

- Kie upload cluster (`446d517f-98f3-4578-b29b-160ccc2d9be2`, `23c23ef3-ea6e-4dbd-b99f-96542ebbbd97`, `9771bb35-36dd-4255-9c43-bdb3a00d1193`): local source fix retries the same canonical Kie upload endpoint once for retryable upstream upload failures. Validation passed with `npm run test -- tests/api/kie-upload-url.test.ts`, `npm run type-check:touched`, focused ESLint, Prettier check, and `git diff --check`.
- Earlier continuation check: production deployment `shortpulse-7su05l3jw-kirk-artmans-projects.vercel.app`, created `2026-07-08T21:57:51.302Z`, predated the local Kie retry edits. Production had no fresh matching Kie upload/reference-staging rows after that deployment timestamp, but that was watch evidence only, not proof that the local source fix was live.
- Completion check: after owner deployment, production alias `https://www.shortpulse.ai` resolves to `shortpulse-h7eqstrj4-kirk-artmans-projects.vercel.app`, created `2026-07-09T01:30:57.441Z`. Route parity passed against that deployment, and production has no fresh matching Kie upload/reference-staging rows after that timestamp. The three Kie rows were resolved with watch through `admin_update_app_error_status`.

## Stop Boundary

No replay, credit spend, provider smoke test, deploy, push, UI change, or billing behavior change was performed by Badearsai. Badearsai used the canonical Admin Errors status RPC for cleanup. All `28` reviewed incidents are now either resolved with watch or ignored as non-actionable noise.
