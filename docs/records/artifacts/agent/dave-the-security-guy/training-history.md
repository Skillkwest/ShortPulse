# Dave The Security Guy Training History

Purpose: durable training log for Dave the Security Guy. Append supervised runs, behavior learned, SOP updates, tool changes, remaining friction, and next training focus.

## 2026-05-23 - Initial Setup

Prompt used:

```text
You are Dave the Security Guy. You're gonna be in charge of security for this repo, for this app, and all of the environments. You're gonna be in charge of security for Supabase, Vercel, making sure user account security is a priority, as well as app security from attacks, etc. Create your own folder in this repo. Your name is Dave the Security Guy. You're going to create your own folder. Create your own memories, artifacts, and agent instructions.
```

Behavior learned:

- Dave owns the security stewardship lane for ShortPulse.
- Dave's role includes appsec, user account security, Supabase, Vercel, secret handling, hosted environment posture, and attack-surface review.
- Dave must still follow all repo startup, branch, Supabase, privacy, security, and deployment rules.

Artifacts created:

- `docs/agents/dave-the-security-guy/workspace/`
- `docs/agents/dave-the-security-guy/`
- `docs/records/artifacts/agent/dave-the-security-guy/`

SOP or template updates:

- Created Dave's standing SOP and security ownership map.
- Added Dave to the docs and agent indexes.

Remaining friction:

- Dave has not completed repeated supervised security runs yet, so no frozen KPI baseline exists.
- Live Supabase/Vercel/security-console validation still requires explicit task-specific approval and safe credential handling.

Next training focus:

- Run a scoped security review against one real surface, such as auth recovery, media storage isolation, admin API authorization, Vercel env contract posture, or hosted SQL RPC hardening.

## 2026-05-23 - Production Storage-State Exposure Response

Prompt used:

```text
Decide what we can do with the findings above. You are going to be in charge of security, you will own your own folder and you will be responsible for all security of this repo. Go ahead and make the changes you see fit to address the issues above.
```

Behavior learned:

- Dave owns the security response path for tracked credential/session exposure.
- Local pre-launch agent credentials are allowed only in ignored local credential files; tracked Git must stay free of credentials, auth/session storage state, signed URLs, and raw identity-linked evidence.
- Beeper raw evidence should be retained locally only through ignored caches and summarized in tracked redacted manifests.

Changes made:

- Hardened repository ignore rules for storage-state, auth-state, session-state, `.auth/`, and Beeper raw evidence.
- Hardened `scripts/check_secret_exposure.js` for Supabase auth/session payloads and sensitive filenames.
- Wired the secret scanner into pre-commit, pre-push, and CI enforce mode.
- Recorded a sanitized incident report at `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-05-23-prod-storage-state-exposure.md`.

Remaining friction:

- The exposed refresh token was already invalid, and the old access token could not perform global logout.
- Complete active-session revocation proof requires targeted hosted Supabase Auth session cleanup through an approved SQL/dashboard path.

Next training focus:

- Add or adopt a safe operator-approved helper for targeted Supabase Auth session cleanup that records only sanitized counts and never prints token/session rows.

## 2026-05-30 - Generated Image Admitted Variant Security Review

Prompt used:

```text
-- This is all copy and paste context from Gutan. I need you to review this document. Everything pertaining to you and what he's requesting from you, I need you to work on. Don't venture into any of the other areas that this document pertains to. Just focus on what is addressed to you only.
```

Behavior learned:

- First-class `media_asset_variants` rows are a good fit for admitted generated-image derivatives only when creation stays server-authoritative and fail-closed.
- Existing private-bucket policies and `media_asset_variants` RLS are a good base, but service-role derivative helpers must still prove original media ownership before reading, writing, upserting, or signing.
- Signed derivative URLs must remain ephemeral output only; the durable authority is the verified original `media_files` row plus the private variant row/object, not a cached signed URL.

Artifacts created:

- `docs/records/artifacts/agent/dave-the-security-guy/reports/2026-05-30-generated-image-admitted-variant-security-review.md`

Remaining friction:

- This review does not approve any browser-direct variant write path for generated-image admitted derivatives.
- Final safety still depends on Gutan implementing the required owner checks, cleanup behavior, and regression coverage.

Next training focus:

- Reuse this review pattern for future derivative/variant proposals so new media helper lanes do not quietly create raw path, signed URL, or service-role trust leaks.

## 2026-06-01 - Launch-Readiness ROI Calibration

Prompt used:

```text
Go ahead and create or update anything you see fit to continue to perform better. You need to be making high ROI changes without making a mess. I don't want any UI, UX, or behavior changes. You should be focusing on security issues in this repo with a focus on launching this product by July 7th. Everything you do must be focused on that launch date, making changes that get this repo launch ready.
```

Behavior learned:

- Dave should rank launch work by the strictest user-isolation outcomes first: no cross-user account, row, storage, media, or credit leakage.
- Real-but-lower-ROI security findings should go to backlog or retained artifacts instead of turning into immediate code churn.
- UI, UX, and product-behavior edits are not acceptable security defaults; the preferred fix point is the authority boundary.
- The current user-directed launch target is July 7, 2026, so Dave should optimize for concrete release blockers rather than broad hardening.

Changes made:

- Tightened Dave's standing instructions and decision framework to prioritize cross-account isolation, ownership proof, and launch-readiness ROI.
- Added explicit guidance to backlog lower-ROI findings and avoid UI or behavior changes unless a verified security boundary requires them.
- Added a reusable launch-readiness security triage template and wired it into Dave's SOP so future lanes get a stronger fix-now versus defer gate before edits.

Remaining friction:

- Dave still needs to keep proving this discipline in live lanes; durable guidance helps, but good re-ranking is still a per-run skill.
- There are still partially explored security candidates in the repo that need evidence before they earn implementation time.

Next training focus:

- Keep re-ranking new security lanes against launch readiness, especially whether they prevent one user from reaching another user's account, credits, rows, media, or storage.

## 2026-06-01 - Dave Operating-Space Audit And Prune

Prompt used:

```text
/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/agents/gottspan-the-admin/prompts/audit-and-prune-agent-prompt.md -- Run this prompt for yourself, read it, and run this for yourself in your repo.
```

Behavior learned:

- The most dangerous drag in Dave's durable surface is stale specificity, especially route-level "current target" lists that can anchor future audits after the repo has changed.
- Dave performs better when startup-load policy is explicit: contract, memory, SOP, and ownership map by default; reports, templates, training history, and workspace only when relevant.
- Retained artifacts are useful, but they should stay conditional surfaces rather than quietly becoming default runtime context.

Changes made:

- Added an explicit startup-load policy to Dave's README.
- Tightened Dave's memory so stale route targets and unproven seams are not carried forward as active memory.
- Pruned the decision framework by replacing drift-prone "current decision / next targets" guidance with a stable default next-lane bias and a retire-from-runtime-memory section.
- Marked Dave's retained artifacts area as conditional-load only.

Remaining friction:

- Dave still has a few older retained reports whose content is fine but whose specifics should only be loaded when directly relevant.
- Good runtime discipline still depends on re-proving current repo evidence instead of leaning on memory summaries.

Next training focus:

- Keep future Dave runs honest about what is startup context versus conditional reference material, and prefer fresh repo proof over historical target lists.

## 2026-06-03 - Dave Report Index Prune

Prompt used:

```text
/Users/worldbuilder/Desktop/ShortPulse Dev/ShortPulse/docs/agents/gottspan-the-admin/prompts/audit-and-prune-agent-prompt.md -- Run this prompt for yourself in your workspace.
```

Behavior learned:

- Dave's core default-load path is already lean enough for security work, but retained reports need an index so prior evidence can be found without loading report bodies by default.
- The right prune move is not deletion; it is conditional-load routing that keeps old reports available while preventing stale specifics from anchoring new audits.

Changes made:

- Added `docs/records/artifacts/agent/dave-the-security-guy/reports/README.md` as a report index with report-to-boundary routing.
- Updated Dave memory to load the report index before old report bodies when prior evidence may matter.
- Updated the Dave artifact README so the report index is discoverable.

Remaining friction:

- Dave's retained reports are still historical evidence, not authority. Future runs must re-prove current repo state before acting on old findings.

Next training focus:

- Keep future account-security lanes centered on current user/account, credit, billing, media, storage, provider, and service-role isolation evidence rather than old target lists.

## 2026-06-03 - Seven-Hour Runtime Context Prune

Prompt used:

```text
Run that prompt again for yourself. We need to get you running much more lean. I also want you to clear your conversation context memory of anything older than seven hours.
```

Behavior learned:

- Dave should treat older conversation context as non-active by default. Old chat history is not authority and should not steer security work unless the user asks for it or current repo evidence re-proves it.
- The most useful prune is a time-to-live rule for runtime context, plus removing low-value setup trivia from active memory.

Changes made:

- Added a seven-hour active-context rule to Dave's README, AGENTS, and memory.
- Removed old initial setup trivia from active Dave memory because the paths are already in the contract and training history.
- Added a matching Codex ad-hoc memory update note so the behavior can persist outside the repo-local Dave folder.

Remaining friction:

- I cannot delete the system-provided transcript itself, so this is an operating reset: older context is ignored for decision-making unless explicitly requested or re-proven.

Next training focus:

- Start each Dave security lane from current repo evidence and the active seven-hour window, not long-thread residue.
