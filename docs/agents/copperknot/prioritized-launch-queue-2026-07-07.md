# Prioritized Launch Queue Through 2026-07-07

Purpose: define the exact next execution order for the July 7, 2026 launch-readiness window.

## Queue Rule

Work higher rows first unless fresh evidence changes launch risk. Queue order is based on the July 7 launch promise: protect real user task completion, paid-use trust, data/credit/media integrity, and solo-owner operability.

Preserve the current UI, UX, and intended behavior as the default. Major visible or functional changes belong in a lane only when current evidence proves they are necessary for launch readiness and a smaller source-level or validation-focused fix will not protect the launch promise.

## Queue

| Priority | Launch system | State | Evidence | Work type | Recommended owner | Done proof |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `Recovery, settlement, and output integrity` | `Blocked - Handed Off` | `Locally Tested` | Bactuo continuation after five Copperknot passes; production-safe lifecycle proof after resolver, direct-provider settlement-gate, and admin-health lineage hardening | Bactuo plus Copperknot review | Continue from `docs/agents/copperknot/handoffs/2026-06-03-recovery-settlement-output-integrity.md`; accepted-job recovery, settlement, publication, visible output convergence, status reads, direct-provider persistence, and diagnostics share the same lineage and ordering proof. |
| 2 | `Media library and organization` | `Below Bar - Handed Off` | `Locally Tested` | Holomony continuation after one Copperknot pass; source audit and proof without redesign | Holomony plus Copperknot review | Continue from `docs/agents/copperknot/handoffs/2026-06-03-media-library-organization-launch-readiness.md`; canonical media save/ingest paths, autosave-off behavior, global folder membership, project association, preview correctness, and save-to-library continuity have current tests or production-safe proof. |
| 3 | `Storage, delivery, and variants` | `Below Bar` | `Production Checked` | source audit then hardening | Holomony or Dave for boundary slices | Signed delivery, variants, derivative worker posture, and no-transform policy are validated against current source and production-safe checks. |
| 4 | `Create and Pulse workflow` | `Below Bar` | `Repo Inspected` | workflow proof and targeted fixes | Pulse/Create Workflow with Copperknot review | Standard/Pulse boundaries, prompt/reference composition, Generate CTA behavior, and non-mutating production surface checks pass; credit-consuming proof is explicitly approved if needed. |
| 5 | `AI Studio shell and navigation` | `Below Bar` | `Repo Inspected` | preservation-minded UX/system audit | Abismia plus Copperknot review | Workflow navigation, shared right rail, panels, modals, and mobile/desktop layout are classified into blockers, watch items, and polish with source-backed fixes for blockers that preserve the current experience where possible. |
| 6 | `Generation runtime and providers` | `Below Bar` | `Repo Inspected` | provider contract audit | Bactuo | Active OpenAI, Kie, Fal compatibility, and ElevenLabs submit/status/result contracts are normalized and tested where launch-critical. |
| 7 | `Credits, pricing, billing, and entitlements` | `Launchable With Watch` | `Repo Inspected` | billing proof and policy audit | Money Stuff | Runtime pricing, estimate/debit, entitlement, Stripe/catalog, and admin pricing evidence is current; paid-flow gates are named. |
| 8 | `Security and ownership boundaries` | `Launchable With Watch` | `Repo Inspected` | security release audit | Dave the Security Guy | Current reports are reconciled, SQL/runtime security checks are scoped, and no unresolved cross-user/protected-boundary launch risk remains. |
| 9 | `Projects and workspace restore` | `Launchable With Watch` | `Production Checked` | regression proof | Datserok | Current dirty worktree does not regress project save/open/restore, project output ownership, or workspace exclusion rules. |
| 10 | `Expert Edit workflow` | `Launchable With Watch` | `Production Proven` | watch proof | Copperknot or Create/Edit owner | Existing production smoke remains valid after current worktree changes; deeper proof is queued only if final board needs stronger confidence. |
| 11 | `Video workflow` | `Below Bar` | `Repo Inspected` | workflow proof | Bactuo or workflow owner | Kie model constraints, reference requirements, output insertion, and production-safe surface checks pass. |
| 12 | `Sound workflow` | `Below Bar` | `Repo Inspected` | workflow proof | Bactuo or workflow owner | ElevenLabs voice ownership, staging, autosave, and output insertion launch subset is verified. |
| 13 | `Creative libraries` | `Below Bar` | `Repo Inspected` | clustered workflow audit | Abismia or relevant library owner | Characters, Elements, Styles, Presets, and Pulse library blockers are separated from launch polish. |
| 14 | `Public entry and account trust` | `Below Bar` | `Repo Inspected` | route/account proof | Copperknot or Babineaux | Auth, account, compliance, profile, and public pricing routes pass production-safe checks. |
| 15 | `Admin and launch operations` | `Below Bar` | `Production Checked` | operator proof | Gottspan or Copperknot | Admin errors, reports, user health, pricing state, issue intake, route parity, and launch diagnostics are sufficient for solo operation. |
| 16 | `Quality of experience` | `Below Bar` | `Repo Inspected` | preservation-minded UX launch pass | Abismia | Cross-route user experience issues are triaged into blockers, watch items, and post-launch polish without redesigning the app by default. |

## Dispatch Policy

- Copperknot owns readiness movement even when another agent executes a lane.
- Handoffs must cite `docs/agents/copperknot/july-7-launch-authority.md`, `docs/agents/copperknot/july-7-system-map.md`, this queue, and the relevant source docs/code.
- Execution agents may not change launch state, priority, or scoring. They return evidence; Copperknot accepts or rejects it.
- Credit-consuming production tests, billing/business-policy changes, commit/push/deploy/release actions, destructive data operations, and major public-promise changes remain hard autonomy gates.
- Major UI, UX, or intended-behavior changes require evidence that the current experience cannot meet the July 7 launch promise without that change.
