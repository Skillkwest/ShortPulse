# Beeper Run Report - 2026-05-15 - prod-core-audit

Purpose: production core route audit.

## Task

- Requested work: production core route audit
- Environment: production
- Base URL: https://www.shortpulse.ai
- Runtime project ref: ftgrqgjrchpimronuhop
- Audit user: `aiagentayla@gmail.com`

## Scope

- Routes covered: `/dashboard`, `/ai-studio`, `historical implementation`, `/character`, `/profile`
- Primary user journey: sign in with the production audit account, load the core surfaces, capture runtime signals, then drill into the first concrete failure.
- What was intentionally skipped: deep generation flows, uploads, destructive mutations, and multi-step project creation.

## Action Log

| Step | Surface                    | Action                                                                               | Result                                                                                                                                                    | Evidence                                                                                                         |
| ---- | -------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1    | walkthrough script         | Ran the starter production route sweep                                               | All five core routes loaded and produced screenshots                                                                                                      | `beeper/runs/2026-05-15-120659-prod-core-audit/evidence/audit-summary.json`                                      |
| 2    | dashboard                  | Read the signed-in shell and top-level content                                       | Dashboard loaded; announcement copy looked informal/test-like for production                                                                              | `route-01.png`                                                                                                   |
| 3    | media-library              | Followed the only concrete runtime failure from the sweep                            | One signed image request hit `net::ERR_BLOCKED_BY_ORB`                                                                                                    | `audit-summary.json`                                                                                             |
| 4    | media-library focused pass | Reopened `historical implementation`, waited for preview recovery, and inspected rendered cards | The broken preview recovered to the original upload URL; the route was not hard-broken                                                                    | `media-library-focused.json`, `media-library-focused.png`                                                        |
| 5    | network probe              | Fetched the failing signed URL directly                                              | Response was `400` with JSON body `{\"statusCode\":\"404\",\"error\":\"Not found\",\"message\":\"The resource was not found\"}`                           | local curl probe noted in run packet                                                                             |
| 6    | in-app API capture         | Captured the actual `/api/media/list` response from the app session                  | Row `4bd51927-1a92-4ee4-add6-711103921cdf` came back with a stale `thumb_variant_path`; other `1x1` thumbs matched `1x1` source rows and were not the bug | `media-library-list-network.json`                                                                                |
| 7    | code follow-up             | Read list signing + preview recovery code                                            | The route signs seeded preview candidates without existence verification, while the client retries and falls back on preview error                        | `frontend/pages/api/media/list.ts`, `frontend/features/media-library/hooks/useMediaPreviewRecoveryController.ts` |

## Findings

### Blockers

- None. The failing preview recovered client-side and did not stop route use.

### Functional Issues

- `P2` Recoverable stale image-variant pointer on production `historical implementation`.
  - Evidence:
    - `audit-summary.json` logged `net::ERR_BLOCKED_BY_ORB` for `.../variants/images/4bd51927-1a92-4ee4-add6-711103921cdf/thumb_480`.
    - Direct probe of that signed URL returned `400` with a JSON `404 Not found` body.
    - The actual route response in `media-library-list-network.json` shows row `4bd51927-1a92-4ee4-add6-711103921cdf` with `width=3456`, `height=2234`, `file_size=3009485`, and `thumb_variant_path=.../thumb_480`.
    - `media-library-focused.json` shows the rendered card eventually swapped to the original upload URL and loaded successfully.
  - User impact:
    - First-paint preview for that card burns a failed request.
    - Recovery falls back to the full original image instead of a lightweight thumb, which increases bandwidth and risks flicker/slower card paint.
  - Current behavior:
    - `/api/media/list` seeds `signedById` from `resolvePreferredMediaSigningStoragePath(...)`.
    - The seed path is signed without checking whether the object actually exists.
    - The client catches the preview error and re-signs/falls back.
  - Severity rationale:
    - Not a hard blocker because recovery works.
    - Still a real production defect because the stale derivative pointer reaches the browser and forces a heavier recovery path.

### UI / UX Notes

- Production dashboard announcement copy looks like internal testing text rather than user-facing copy: `Yooo! I wired this up to make announcements. We can publish announcements to all users very easy.`
- The Beeper audit account has noisy `1x1` test uploads on its first Media Library page. That is data clutter, not a confirmed product defect, but it weakens the signal quality of manual audits run with this account.

## Code Follow-Up

- Probable code surfaces:
  - `frontend/pages/api/media/list.ts:403-491`
  - `frontend/lib/mediaPreviewPathCore.ts:174-213`
  - `frontend/features/media-library/hooks/useMediaPreviewRecoveryController.ts:60-128`
  - historical implementation gallery grid component
- Supporting docs or tests inspected:
  - `docs/troubleshooting.md` media preview checklist
  - `docs/systems/catalog.md` entries for `media-library-workflow`, `media-delivery-signing-preview-resolution`, and `media-derivatives-variants`
  - `frontend/lib/server/mediaDerivatives/processMediaDerivative.ts`
- What another agent should inspect first:
  - Confirm whether `media_files.thumb_variant_path` for `4bd51927-1a92-4ee4-add6-711103921cdf` points at a deleted/missing storage object or whether the object path drifted elsewhere.
  - Decide whether route-first seeding in `/api/media/list` should verify candidate existence before returning `signedById`, or whether it should demote missing derivative paths to `storage_path` immediately.
  - If stale derivative pointers are common, add a targeted diagnostic or repair path instead of relying on client-side recovery.

## Evidence Packet

- JSON packet:
  - `beeper/runs/2026-05-15-120659-prod-core-audit/evidence/audit-summary.json`
  - `beeper/runs/2026-05-15-120659-prod-core-audit/evidence/media-library-focused.json`
  - `beeper/runs/2026-05-15-120659-prod-core-audit/evidence/media-library-list-network.json`
- Screenshots:
  - `route-01.png` through `route-05.png`
  - `media-library-focused.png`
- Console / runtime signals:
  - broad `net::ERR_ABORTED` entries during scripted navigation looked like route churn noise
  - the concrete actionable signal was the single `net::ERR_BLOCKED_BY_ORB` image request backed by a real signed-URL `404`
- Local code references:
  - `frontend/pages/api/media/list.ts`
  - `frontend/lib/mediaPreviewPathCore.ts`
  - `frontend/features/media-library/hooks/useMediaPreviewRecoveryController.ts`
  - historical implementation gallery grid component

## Self Audit

- Score out of 10: 8
- What felt strong:
  - Started broad, then narrowed quickly to the first evidence-backed failure.
  - Avoided a false handoff by checking whether the `1x1` thumbnails were broken derivatives or just `1x1` source fixtures.
- What slipped:
  - The first pass over-read the `1x1` thumbs as a derivative bug before correlating them with the route payload.
- What assumptions were made:
  - Assumed the production audit account's `audit-reference.png-1.png` rows are intentional test data because both the source rows and the rendered thumbs are `1x1`.
- Smallest improvement for the next run:
  - When a media-preview signal trips, capture the paired in-app `/api/media/list` or `/api/media/resolve-previews` payload immediately before inferring root cause.

## Training Record

- New helper or script needed?: no
- Existing helper update needed?: yes; the walkthrough/focused helpers would benefit from an opt-in network body capture mode for selected internal APIs when a runtime failure is detected.
- SOP / checklist update needed?: no immediate SOP change; this fits the existing issue-to-code handoff flow.
- Memory / training-history update needed?: yes
