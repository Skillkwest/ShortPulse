# Launch Fitness Scorecard - 2026-06-16

Purpose: provide a current, easy-to-read launch-fitness view for the July 7, 2026 launch decision without making the older architecture catalog table carry work it is not good at.

## Scope

- Baseline date: `2026-06-16`
- Branch: `production`
- Commit anchor: `d06a54218`
- Worktree: validated AI Studio media/shell runtime hardening is now committed on the current branch; authenticated launch proof is still pending.
- Production URL checked: `https://www.shortpulse.ai`
- Evidence mode: mixed production-safe checks, current worktree inspection, focused local validation, and existing July 7 launch-control docs.

This scorecard is the active fast-read launch scoring surface. `docs/systems/catalog.md` remains the architecture inventory and historical maturity baseline. Copperknot's July 7 board and queue still control exact execution order.

## Method

The old `/10` catalog score is still useful for architecture maturity, but it is not enough for July 7. It hides whether a system is production-proven, whether a human can trust it, and whether the current worktree is actually green.

The active launch-fitness score is a `0..10` judgment using five equal launch questions:

1. Can a normal user complete the job without owner rescue?
2. Are money, account, media, project, and ownership boundaries trustworthy?
3. Is there current evidence at the right level: production, local, or static?
4. Are failure states honest, recoverable, and observable?
5. Is the source seam stable enough to keep hardening without patch-loop churn?

Score bands:

- `8.0..10`: launch-ready or near-ready after final proof.
- `7.0..7.9`: launch floor with watch items.
- `6.0..6.9`: near floor, but still missing important proof or stability.
- `4.0..5.9`: below floor; highest-ROI source hardening or proof lane needed.
- `0..3.9`: blocked; launch promise is not credible for this system without repair.

No score can outrank its evidence. Production-safe unauthenticated checks can raise security/fail-closed confidence, but they do not prove authenticated customer success or credit-consuming generation.

## Current Scores

| Rank | Launch system | Launch fitness | State | Evidence basis | Why it sits there | Next highest-ROI move |
| ---: | --- | ---: | --- | --- | --- | --- |
| 1 | `Recovery, settlement, and output integrity` | 4.0 | Blocked | Local historical hardening plus stale handoff | This remains the launch spine for accepted jobs, credit settlement, output visibility, and recovery. It is still missing current production-safe lifecycle proof. | Bactuo-owned lifecycle proof or fresh source audit before any readiness lift. |
| 2 | `Media library and organization` | 4.8 | Below floor | Prior local proof plus current media guardrail cleanup | Media save/reuse is core to human trust. The media-rendering guardrail is locally green again, but integrated authenticated save/reuse, organization, and return-to-work proof is still partial. | Rerun stable-lane media save/reuse proof on an authenticated customer path. |
| 3 | `Right-rail asset reuse` | 4.7 | Below floor | Current source inspection plus focused local validation | Canvas media actions and reference runtime additions now have focused workflow-reload/type proof, and the shared media guardrail debt is cleared locally. Right-rail state remains global launch-critical and still lacks stronger integrated reopen/reuse evidence. | Run a stable-lane integrated right-rail reuse proof with authenticated reopen/reuse coverage. |
| 4 | `AI Studio shell and navigation` | 4.5 | Below floor | Focused local validation plus repo inspection | The shared shell/runtime lane now builds and its focused layout/reload tests are green, but broader authenticated shell/navigation proof is still missing. | Run a preservation-minded shell/navigation pass on the stable lane. |
| 5 | `Video workflow` | 4.5 | Below floor | Focused local reload proof plus approval-gated provider boundary | Video reload hydration invariants are locally green again, but provider/generation proof remains approval-gated and broader customer-flow proof is still thin. | Keep reload proof green and refresh bounded authenticated Video proof when safe. |
| 6 | `Create and Pulse workflow` | 5.0 | Below floor | Local route/panel proof, no current authenticated production proof | Local contracts are meaningful, but core generation success and authenticated user journey proof remain unproven. | Refresh authenticated non-credit workflow proof and only then consider approved generation smoke. |
| 7 | `Generation runtime and providers` | 5.2 | Below floor | Local provider contracts; refreshed model catalog checks | Fal route wrappers pass and model catalog freshness is locally green again, but production provider success remains unproven and credit-consuming smoke remains approval-gated. | Keep catalog parity green and refresh production-safe provider proof before any readiness lift. |
| 8 | `Storage, delivery, and variants` | 5.5 | Below floor | Production checked for protected routes; local no-transform posture | Supabase image transforms remain prohibited and scans found only guard/test/rejection references, but authenticated sign/list/resolve and hosted derivative posture are not proven. | Run hosted storage/derivative SQL proof and authenticated media delivery proof when safe. |
| 9 | `Sound workflow` | 5.5 | Below floor | Local route/helper proof | Local ElevenLabs and staging proof helps, but provider/env posture and authenticated output insertion are still not production-proven. | Production-safe provider/env check, then approved minimal sound output proof if needed. |
| 10 | `Creative libraries` | 5.5 | Below floor | Local source hardening plus current library contract proof | Library reuse seams are stronger than before, and the latest Character/Elements properties-rail contracts are locally green, but integrated authenticated save/reopen/select/reuse proof is still missing. | Prove integrated reuse in a stable authenticated lane. |
| 11 | `Quality of experience` | 5.5 | Below floor | Repo inspected | The app's current UI/UX is the desired baseline, but a human-readiness pass has not classified blockers vs watch items against the latest WIP. | Run a preservation-minded UX launch pass after validation floor is green. |
| 12 | `Projects and workspace restore` | 6.5 | Near floor | Prior production checked plus current local reload proof | Project restore has better evidence than many systems, but it still needs a fresh post-convergence save/open/restore proof on a stable tree. | Reconfirm project save/open/restore on the stable lane. |
| 13 | `Expert Edit workflow` | 6.5 | Near floor | Prior production smoke plus local proof | Prior production smoke supports the floor, but shared media/detail surfaces still need a stable-lane refresh after the latest source hardening. | Rerun Expert Edit focused smoke on the stable lane. |
| 14 | `Security and ownership boundaries` | 7.0 | Floor with watch | Secret scan, route parity, fail-closed checks, local route/security proof | Fail-closed posture is good on production-safe probes, but hosted SQL/RLS drift and authenticated owner-boundary proof remain final launch checks. | Hosted SQL security audit plus focused authenticated owner-boundary checks. |
| 15 | `Admin and launch operations` | 7.0 | Floor with watch | Docs/checks, route parity, operator route protections | Admin surfaces are not the top blocker, but launch-week operator proof is still needed. | Authenticated operator smoke where safe. |
| 16 | `Credits, pricing, billing, and entitlements` | 7.5 | Launchable with watch | Billing readiness `9 pass / 1 warn / 0 fail` | Production billing catalog, offers, env contract, hidden free tier, and renewal fail-closed checks look good. Stripe webhook event proof remains unproven locally. | Resolve Stripe webhook event proof boundary with the correct secret/prod-safe lane. |
| 17 | `Public entry and account trust` | 7.5 | Launchable with watch | Production public routes, canonical auth callback, protected account fail-closed | Arrival and account entry surfaces are production-checked. Authenticated profile/email/billing-account actions remain watch proof. | Authenticated account mutation checks when safe. |

## Project Read

ShortPulse is not launch-ready today. It is stronger than a prototype, but the remaining launch risk is concentrated in a few systems that decide whether a real customer can create, save, reopen, reuse, and trust paid outputs.

The project is in a `source-hardening and convergence` phase, not a final-proof phase. The latest AI Studio runtime lane has converged locally: focused workflow-reload/layout tests are green, changed-file typecheck is green, and a production build passed. The immediate media-rendering guardrail blocker is now cleared locally:

- `validate:media-rendering-guardrails` passed on `2026-06-16` after no-behavior size-budget cleanup in `MediaLibraryPanel.tsx` and `useMediaPreviewSigningController.ts`.

The strongest areas right now are public entry/account trust, billing, security fail-closed posture, admin route/docs hygiene, and model catalog hygiene. The weakest areas are recovery/settlement, media organization, right-rail reuse, AI Studio shell/navigation, and Video workflow stability.

## Decision

The scoring method should change from a single maturity score to a two-layer model:

- Architecture catalog score: useful for long-term maturity and ownership.
- Launch-fitness score: useful for July 7 readiness and next-work decisions.

For launch work, use the launch-fitness score first. Use the architecture catalog score only to understand long-term health, not to decide whether a system is ready for July 7.
