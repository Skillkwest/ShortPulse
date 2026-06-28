# Psychological User Experience Audit - 2026-06-28

## Status

- Mode: audit-only.
- Allowed mutation: this document only.
- Product/code changes: none.
- Browser/manual runtime validation: not used, per request.
- Evidence surface: code and repo docs only.
- Excluded by repo policy: generated/build artifacts and `mini-ecosystem/`.
- Subagents: not used because the active tool contract requires explicit subagent/delegation wording, even though the repo has a standing audit/research policy for useful subagents.

## Lens

This audit uses `docs/ux-decision-framework.md` as the user psychology frame:

- Trust: pricing feels legible, auth/recovery work, outputs do not disappear, errors are recoverable.
- Agency: the user can tell what to do next and what a control will do.
- Momentum: the user reaches first value quickly without avoidable interruption.
- Payoff: the result feels worth the time, attention, and credit spend.

The user is not buying "AI generation" in the abstract. The user is buying faster creative progress, less effort, more leverage, more output, and confidence that the product will not waste their time or money.

## Executive Read

ShortPulse has a strong psychological base. It promises creator power, gives the signed-in user durable projects, routes credit management into account surfaces, sanitizes provider failures, protects private media delivery, and includes explicit paths for reporting confusion. These are real trust assets.

The main psychological risk is that the promise often arrives before the first concrete payoff, while the product then asks the user to pass through signup state, email confirmation, account compliance, project restore, credit calculation, dense studio navigation, and failure recovery. The user can feel that the product is powerful but operationally demanding.

That matters for retention and credit purchases because paid creative tools win when the user feels: "I know what this will cost, I know what to do next, my work is safe, and another attempt is worth it." The current repo has several moments where the user may instead feel: "I am not sure what is happening, what this will cost, whether this worked, or whether my output is safe."

## Strengths To Preserve

1. Public promise is emotionally strong.
   - Evidence: the guest dashboard leads with "A true all-in-one for AI creators" and "The world's best AI models. Thousands of workflows. One simple workspace. Zero frustration." in `frontend/features/dashboard/components/GuestDashboardView.tsx:407-420`.
   - Psychological value: the user immediately understands ambition and category.

2. Billing has a real source-of-truth model.
   - Evidence: `docs/product/billing-pricing-catalog.md:5-30` separates granted credits from runtime model debit policy; `docs/product/ai-studio-pricing.md:21-29` requires UI display and server debit to resolve the same canonical billed-credit row and fail closed when unavailable.
   - Psychological value: this is the right foundation for spend trust.

3. Insufficient-credit recovery is in-flow.
   - Evidence: AI Studio opens a credit top-up modal from insufficient-credit failures, shows available balance, loads credit packs, offers "Manage credits," and starts checkout in `frontend/features/ai-studio/components/AiStudioPageContent.tsx:1738-1760` and `frontend/features/ai-studio/components/AiStudioInsufficientCreditsModal.tsx:168-236`.
   - Psychological value: the user is not thrown out of the creative context when they need credits.

4. Provider error copy protects trust.
   - Evidence: provider/internal details are normalized into customer-facing messages, with a credit-release notice for service failures in `frontend/lib/customerFacingProviderText.ts:1-9` and `frontend/lib/customerFacingProviderText.ts:350-357`.
   - Psychological value: this reduces fear that a provider outage silently consumed credits.

5. Projects and saved-work concepts are strong.
   - Evidence: the authenticated dashboard centers "New Project" and "Open Projects"; the Projects modal has current/opening/deleting status, empty-state guidance, preview enrichment, and a delete confirmation in `frontend/features/ai-studio/components/ProjectsModal.tsx:442-607`.
   - Psychological value: users need to feel their creative work can be resumed.

6. Support copy invites confusion reports, not just bug reports.
   - Evidence: `/report-issue` says "Tell us what broke or felt confusing" and captures signed-in account and route context in `frontend/pages/report-issue.tsx:97-128`.
   - Psychological value: this is human-centered and worth preserving.

## Priority Issue Inventory

### P0 - Credit cost can become psychologically illegible at the spend moment

- Surface: AI Studio generation controls, especially assistant-output/follow-on generate.
- Evidence:
  - The pricing contract says billable UI and server debit must resolve the same canonical billed-credit row and fail closed when unavailable: `docs/product/ai-studio-pricing.md:21-29`.
  - `AgentResponseInlineGenerateButton` renders `costCredits == null` as a dash: `frontend/prefabs/agent/buttons/AgentResponseInlineGenerateButton.tsx:17-52`.
  - Separate credit-confidence helpers use "Cost estimate pending" for some panels, but this does not guarantee every generate affordance gives the same confidence state.
- Likely user feeling: "Am I about to spend credits without knowing the price?"
- Business risk: unclear cost suppresses repeat generation and top-up purchases because the user cannot build trust in the credit economy.
- Future fix class: make every billable generate affordance show one of three unambiguous states: known cost, calculating cost, or unavailable until cost is known. Avoid symbolic placeholders at spend points.

### P0 - Paid checkout return can feel operational instead of rewarding

- Surface: post-subscription return into AI Studio.
- Evidence:
  - After checkout success, AI Studio creates an `Untitled Project` and shows "Saving your starter project before AI Studio opens": `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx:405-432`.
  - Before that, the same entry path may show "Checking your session before project restore continues," "Checking your media agreement before project restore continues," or "Refreshing your session before project restore continues": `frontend/features/ai-studio/routes/AiStudioProtectedRouteEntry.tsx:338-371`.
- Likely user feeling: "I paid, but now the app is doing infrastructure things I do not understand."
- Business risk: this is the peak expectation moment. A confusing post-payment wait can create buyer's remorse before the user creates anything.
- Future fix class: make the post-checkout entry feel like a welcome and setup for creation. Keep the technical checks, but frame visible copy around "getting your workspace ready" and the next creative action.

### P1 - Compliance gate is necessary but emotionally cold before payoff

- Surface: protected-route media agreement.
- Evidence:
  - The gate labels the step "Account compliance," shows "One-time step," lists rules, and blocks protected routes until accepted: `frontend/features/compliance/components/MediaComplianceGate.tsx:36-123`.
  - The unavailable state says protected routes stay blocked until the app can verify agreement status: `frontend/features/compliance/components/MediaComplianceGate.tsx:110-116`.
- Likely user feeling: "I came to create, and now I am in a legal/account checkpoint."
- Business risk: the interruption happens before creative payoff, so it can be interpreted as friction rather than protection.
- Future fix class: keep the legal requirement, but add user-centered framing around safety, rights, and continuity. The emotional message should be "one-time creator protection," not only "account compliance."

### P1 - Project restore/loading copy is technically accurate but not emotionally reassuring

- Surface: AI Studio project loading and restore.
- Evidence:
  - Steps include "Verify session," "Check media agreement," "Resolve project," "Load workspace," and "Prepare studio": `frontend/features/ai-studio/components/AiStudioProjectEntryState.tsx:36-62`.
  - Visible messages include "Validating your saved project before AI Studio restore continues," "Loading the latest workspace snapshot," and "No saved workspace was found": `frontend/features/ai-studio/components/AiStudioProjectEntryState.tsx:95-121`.
  - The visual surface shows only title/message while detailed steps are screen-reader-only: `frontend/features/projects/components/ProjectEntryLoadingSurface.tsx:79-132`.
- Likely user feeling: "Something complicated is happening to my workspace; I hope it works."
- Business risk: restore moments decide whether users believe ShortPulse preserves work. Technical nouns can create anxiety when the user is waiting for their project.
- Future fix class: preserve durable-work transparency, but replace technical restore language with casual, light waiting copy that feels relaxed and human. The app can say it is "walking the dog," "inventing time travel," "planting trees," "warming up the studio," or otherwise doing something playful while the project opens. The emotional goal is: "we have this handled; hang tight," not "you are inside a workspace snapshot pipeline."

### P1 - Dense AI Studio navigation includes unfinished destinations

- Surface: AI Studio sidebar/tools.
- Evidence:
  - Templates, Workflows, My Generations, and Community are present as coming-soon tools with descriptions: `frontend/features/ai-studio/components/AiStudioPageContent.tsx:146-175` and `frontend/features/ai-studio/components/AiStudioPageContent.tsx:1903-1923`.
- Likely user feeling: "This workspace is big, but parts of it are not ready."
- Business risk: unfinished primary navigation can reduce trust in core paid generation even if the active workflow works.
- Future fix class: treat Templates, Workflows, My Generations, and Community as explicitly deferred post-launch surfaces. Quarantine or sequester these buttons so they do not compete with launch-critical creation paths, and so future proof/audit passes do not keep spending attention on features that will not be built until much later. The goal is not to make these features launch-ready now; it is to keep them from diluting confidence in the features that must prove ready.

### P1 - Credit understanding is split across too many places

- Status: deferred until further notice. Keep discoverable, but do not implement changes from this item until the owner has more time to think through the right credit-education posture.
- Surface: pricing page, profile credits, AI Studio header, insufficient-credit modal.
- Evidence:
  - Public pricing cards show credits per month and storage but do not explain what common actions cost in the same surface: `frontend/features/billing/catalog.ts:173-283`.
  - Billing docs define current plan and credit-pack quantities: `docs/product/billing-pricing-catalog.md:61-87`.
  - AI Studio header links to profile credits and shows a compact credit value: `frontend/features/ai-studio/components/AiStudioPageContent.tsx:1780-1791`.
  - Insufficient-credit modal explains required vs available credits only after a shortage: `frontend/features/ai-studio/logic/insufficientCredits.ts:47-66`.
- Likely user feeling: "I see a number of credits, but I do not know how far it gets me until I try."
- Business risk: users hesitate to buy or top up when they cannot estimate the value of a credit pack.
- Future fix class: add consistent, plain examples near purchase and generation moments, such as typical image/video/audio costs by selected model, without exposing internal pricing mechanics.

### P1 - "Insufficient Credits" is accurate but can feel punitive

- Surface: low-balance recovery.
- Evidence:
  - The canonical shortage title is `Insufficient Credits`: `frontend/features/ai-studio/logic/insufficientCredits.ts:6-8`.
  - The modal body is friendlier: "Top up now and come right back to your project": `frontend/features/ai-studio/logic/insufficientCredits.ts:47-66`.
- Likely user feeling: "I did something wrong" rather than "I can continue by topping up."
- Business risk: top-up is a purchase moment; punitive framing can reduce willingness to buy.
- Future fix class: use continuation framing, for example "Top up to continue," while still showing exact required and available credits.

### P1 - Save/autosave reassurance is not visible enough for a paid creative tool

- Surface: generated outputs, media library saves, project persistence.
- Evidence:
  - Autosave can be disabled or skipped for already saved, no-media, prompt-only, and other policy reasons: `frontend/lib/mediaAutosavePolicy.ts:40-68`.
  - Manual save failures surface generic copy unless the error is a safe storage-quota message: `frontend/features/ai-studio/hooks/useAiStudioOutputSaveRuntime.ts:62-89`.
  - No media available to save can be surfaced to the user: `frontend/features/ai-studio/hooks/useAiStudioOutputSaveRuntime.ts:206-228`.
  - Detail actions can show Save, Saving, Retry Save, Storage Full, and Saved: `frontend/features/ai-studio/components/detail-modal/sharedMediaDetailActions.ts:44-97`.
- Likely user feeling: "Did this save? Is it in my library? Will it be here tomorrow?"
- Business risk: fear of losing outputs is one of the strongest reasons users avoid paying for more generations.
- Future fix class: make save state persistent and legible at the output/card level. Distinguish "not saved yet," "saved to library," "saved in project," and "could not save" in human terms.

### P1 - Failure recovery often says "try again" without enough agency

- Surface: generation errors and detail modals.
- Evidence:
  - Error presentation collapses categories into "Service issue," "Request timed out," "No media returned," "Save failed," and details like "Please try again": `frontend/features/ai-studio/logic/errorPresentation.ts:108-180`.
  - Provider normalization improves some cases by adding concrete actions like "Add an image and try again" or "Choose a supported aspect ratio": `frontend/lib/customerFacingProviderText.ts:101-134`.
  - Service failures include a credit-release notice: `frontend/lib/customerFacingProviderText.ts:350-357`.
- Likely user feeling: "I can retry, but I do not know what to change."
- Business risk: repeated failed generations can turn from experimentation into resentment, especially when credits are involved.
- Future fix class: standardize recovery copy around three parts: what happened, whether credits were charged/held, and the best next action.

### P1 - Global app crash recovery does not reassure work preservation

- Surface: global React error boundary.
- Evidence:
  - The fallback says "Something went wrong," "A rendering error occurred," "Please reload the page or try again in a moment," with Reload and Try to recover actions: `frontend/components/AppErrorBoundary.tsx:52-95`.
- Likely user feeling: "If I reload, will I lose what I was doing?"
- Business risk: render failures on creative work surfaces can produce outsized trust damage if users fear lost outputs or prompts.
- Future fix class: when route/project context is available, state whether project/workspace autosave exists or what recovery path to use.

### P1 - Launch-readiness docs already identify human-readiness as underclassified

- Freshness note: launch-readiness docs may be stale. Treat this as a signal that human-readiness has been launch-relevant before, not as current readiness authority without a fresh Copperknot/source-of-truth check.
- Surface: launch posture and product trust.
- Evidence:
  - The launch scorecard says no score can outrank evidence and unauthenticated checks do not prove authenticated customer success: `docs/systems/launch-fitness-scorecard-2026-06-16.md:38-39`.
  - "Quality of experience" is 5.5, below floor, because a human-readiness pass has not classified blockers vs watch items against latest WIP: `docs/systems/launch-fitness-scorecard-2026-06-16.md:54-55`.
  - Project read says ShortPulse is not launch-ready and remaining risk concentrates around create, save, reopen, reuse, and trust paid outputs: `docs/systems/launch-fitness-scorecard-2026-06-16.md:62-70`.
- Likely user feeling: not directly user-facing, but it confirms the repo already treats these psychology issues as launch-relevant rather than polish.
- Business risk: relying on stale readiness docs can mis-rank UX work, either overstating risk that has already been resolved or missing newer risks that emerged after the scorecard.
- Future fix class: before promoting this audit into launch sequencing, refresh the current launch authority/source of truth and reclassify which UX psychology issues are active blockers, deferred watch items, or already superseded.

### P2 - Public homepage motion and proof density can inspire or overwhelm

- Surface: guest dashboard.
- Evidence:
  - Tutorial autoplay and simultaneous video budgets are set to 15 across layout profiles: `frontend/features/dashboard/components/GuestDashboardView.tsx:38-48`.
  - The guest page includes hero model proof, tutorial showcase, community section, and video gallery before footer: `frontend/features/dashboard/components/GuestDashboardView.tsx:452-491`.
- Likely user feeling: "This is impressive" or "this is a lot."
- Business risk: too much motion/proof before a clear action can reduce perceived simplicity.
- Future fix class: keep the proof, but make the primary path unmistakable and ensure motion does not compete with the first conversion action.

### P2 - Auth confirmation and email flows create waiting-room anxiety

- Surface: email signup and callback.
- Evidence:
  - Email signup without an immediate session says "Check your email to confirm your account, then sign in to continue": `frontend/pages/auth.tsx:338-376`.
  - Callback copy says "Completing your sign-in," "Finalizing your authenticated session," and provides account-sync retry if bootstrap fails: `frontend/pages/auth/callback.tsx:360-760`.
- Likely user feeling: "Did I finish signing up? What happens after I click the email?"
- Business risk: signup confirmation is a fragile trust moment; delays or errors can feel like account instability.
- Future fix class: keep the secure flow, but make the next destination and payoff explicit during confirmation and callback waits.

### P2 - Project previews are useful but can briefly undercut the "my work is here" feeling

- Surface: Projects modal.
- Evidence:
  - The modal first loads projects with `previewMode=none`, then enriches preview URLs after a 250ms delay; if preview enrichment fails, the modal remains usable without previews: `frontend/features/ai-studio/components/ProjectsModal.tsx:178-236`.
  - Cards only show preview tiles when preview URLs exist: `frontend/features/ai-studio/components/ProjectsModal.tsx:488-552`.
- Likely user feeling: "My projects loaded, but where are the visuals?"
- Business risk: visual memory is central for creative work. Blank project cards may briefly feel like missing work.
- Future fix class: show an explicit preview-loading or no-preview state so absence of thumbnails does not imply absence of saved work.

### P2 - Destructive actions are mostly protected, but deletion language should stay concrete

- Surface: project/media/preset deletion.
- Evidence:
  - Project delete confirmation says the project and saved workspace will be removed permanently: `frontend/features/ai-studio/components/ProjectsModal.tsx:588-607`.
  - Media Library deletion confirms selected items will be removed permanently, while folder deletion clarifies media/prompts stay saved in All Media: `frontend/features/ai-studio/components/MediaLibraryPanelDialogs.tsx:58-164`.
- Likely user feeling: "This is serious; I need to know exactly what will disappear."
- Business risk: delete anxiety can make users avoid organizing or cleaning their workspace.
- Future fix class: preserve explicit confirmations and keep differentiating "remove from folder" from "delete from library/storage."

### P2 - Media Library empty states can still feel like data loss if context is ambiguous

- Surface: Media Library panels and modal grids.
- Evidence:
  - Empty states include "No saved items found for this folder," "No images found for this folder," "No saved prompts yet," and "No saved items yet": `frontend/features/ai-studio/components/MediaLibraryPanelRootContent.tsx:180-260`, `frontend/features/ai-studio/components/media-library-modal/MediaLibraryAllItemsGrid.tsx:266`, and `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPromptGrid.tsx:75-140`.
  - Prior retained repo artifacts also mention a no-match search state that said "No images uploaded yet," showing this class of issue has happened before.
- Likely user feeling: "Did my media disappear, or am I just filtered somewhere?"
- Business risk: any ambiguity around missing media directly attacks output continuity trust.
- Future fix class: make empty states always name the active scope: folder, tab, filter, search, upload type, or true account-empty state.

### P2 - The project name is a good anchor but edit affordance is indirect

- Surface: AI Studio header.
- Evidence:
  - The current project name is shown in the AI Studio header and can be clicked to edit in the Media panel: `frontend/features/ai-studio/components/AiStudioPageContent.tsx:1793-1822`.
- Likely user feeling: "This is my workspace," followed by possible confusion about why editing the name opens another panel.
- Business risk: naming projects increases ownership and return intent; friction here weakens workspace identity.
- Future fix class: preserve the project-name anchor, but make edit behavior feel direct and predictable.

### P2 - Report issue is good, but failure moments do not consistently route to it

- Surface: error and support recovery.
- Evidence:
  - `/report-issue` has the right user-centered copy and captures context: `frontend/pages/report-issue.tsx:97-128`.
  - Error surfaces generally provide retry/reload/top-up actions, but not always a support/report path.
- Likely user feeling: "If retry does not work, what now?"
- Business risk: users who cannot recover silently churn instead of telling the owner what blocked them.
- Future fix class: after repeated or high-trust failures, offer a contextual "Report this issue" path with captured route/generation/project context.

### P2 - Plan language is mostly creator-focused but has a few expectation mismatches

- Surface: pricing cards and plan descriptions.
- Evidence:
  - Starter is "Best for graphic artists and all image based workflows"; Media is "image + short form video"; Studio is for "serious AI production"; Business says "Team access": `frontend/features/billing/catalog.ts:173-283`.
  - Repo instructions define a solo-owner operating model for internal collaboration, while customer-facing "Team access" may be a product tier promise rather than an internal-team claim.
- Likely user feeling: "Which plan is actually right for my work?"
- Business risk: vague tier fit can slow purchase decisions, especially when credits are already abstract.
- Future fix class: make each plan map to concrete usage outcomes and avoid implying unsupported team/multi-seat semantics if not actually supported.

## Cross-Cutting Psychological Breaks

1. Promise-to-gate mismatch.
   - The app promises creative ease, then often shows auth, compliance, project restore, or subscription mechanics before creative payoff.

2. Spend uncertainty.
   - Credit balances and packs exist, but the user does not always know what a specific next action costs or whether cost data is final.

3. Work-continuity anxiety.
   - The app has projects, media library, autosave, and saved states, but the visible copy does not always answer "is my work safe?"

4. Recovery without enough control.
   - Many failures are sanitized and safe, but too many end at "try again" rather than a specific next action.

5. Feature breadth before feature confidence.
   - The workspace shows many capabilities, including coming-soon surfaces, before the user has necessarily succeeded with one primary workflow.

## Recommended Next Decisions

1. Treat credit-cost legibility as the first psychological trust blocker.
   - Every billable button should have a known cost, a clear pending state, or a disabled unavailable state.

2. Reframe first protected entry around creative payoff.
   - The first post-signup or post-payment screen should tell the user what they are about to create, not only what the system is verifying.

3. Add a "work is safe" language layer.
   - Project restore, autosave, saved media, save failure, and crash recovery should consistently explain what is preserved and what action the user should take.

4. Remove or demote unfinished destinations from the main creative decision path.
   - Coming-soon tools should not compete with the workflows that must earn trust today.

5. Convert repeated failure into guided recovery.
   - For generation/provider/save/auth failures, standardize copy around cost status, likely cause, and the highest-confidence next action.

6. Run a future production/authenticated human-readiness pass when approved.
   - This code/docs audit can identify likely psychological breaks, but it cannot prove actual user feeling, latency, conversion, or production authenticated success without runtime evidence.

## Evidence Boundary

This document should not be read as production proof. It is a code-and-docs psychological audit. It identifies likely user feelings and product risks from the surfaces the repo currently renders or documents. It does not prove live behavior, customer sentiment, checkout settlement, provider success, authenticated generation, media delivery, or actual conversion outcomes.
