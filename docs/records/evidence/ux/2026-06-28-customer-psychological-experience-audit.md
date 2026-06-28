# ShortPulse Customer Psychological Experience Audit

Date: 2026-06-28

Mode: read-only UX psychology audit. No UI, UX, behavior, billing, generation, upload, delete, or repo-code changes were made. This document is the only intended artifact.

Primary lens: `docs/ux-decision-framework.md` — trust, agency, momentum, payoff.

Production surface inspected: authenticated production browser session at `https://www.shortpulse.ai/dashboard`, then dashboard project modals, profile credits/subscription/storage, AI Studio Create/Pulse/Video/Sound/Edit, report issue, pricing, sign-up, and public legal pages. Browser work intentionally avoided provider generation, credit purchase, uploads, deletion, and saved-work mutation.

Repo surface inspected: active customer-facing routes under `frontend/pages`, core route map/docs, dashboard, auth, pricing/billing/profile, AI Studio project/workspace/right-rail/generation/media-library surfaces, legal-policy rendering, report issue, app error boundary, compliance gate, and selected retained UX route evidence. `mini-ecosystem/` was excluded by repo policy.

## Executive read

ShortPulse feels most satisfying when it behaves like a durable creative workspace: named projects, visible saved work, a strong dashboard, rich tutorial cards, clear account meters, and serious creation tools. That experience says, "your work has a place here." This is the main psychological reason a user would return and keep paying.

The psychology breaks when the app asks the user to trust internal systems instead of translating them into human meaning. Credits are mathematically visible but not always emotionally legible. Project persistence is technically strong but sometimes explained with internal words like "workspace snapshot." AI Studio is powerful but can front-load too many expert decisions before the user has momentum. Legal/support/recovery surfaces exist, but some still feel unfinished or black-boxed at the exact moments where a buyer needs reassurance.

The highest-ROI fix theme is not a redesign. It is translation: "what happens next," "what is safe," "what this costs," "what this buys," "where my work went," and "how I recover."

## What feels good

1. The authenticated dashboard creates immediate ownership.
   - Production observation: dashboard shows plan, storage, credits, project entry, tutorial workflows, and community from one place.
   - Repo evidence: `New Project` and `Open Projects` are the primary hero actions in `frontend/features/dashboard/components/AuthenticatedDashboardView.tsx:102`.
   - Psychological effect: the product feels like a home base, not a throwaway prompt box.

2. Saved projects are a strong trust anchor.
   - Production observation: `Open Projects` shows named projects with preview thumbnails and a visible `Current` state in AI Studio.
   - Psychological effect: this reduces fear that outputs disappear, which is one of the biggest buyer anxieties for AI tools.

3. Credits/profile pages are materially more transparent than the dashboard summary.
   - Production observation: credits page shows available balance, next renewal, incoming credits, last synced, package prices, and price per 1,000 credits.
   - Repo evidence: credit explainer and package cards live in `frontend/features/profile/components/ProfileCreditsSection.tsx:103` and `frontend/features/profile/components/ProfileCreditsSection.tsx:191`.
   - Psychological effect: account control feels credible and adult.

4. Report Issue starts well.
   - Production observation: `/report-issue` explains that signed-in account and route context are attached automatically.
   - Repo evidence: report copy and captured context render in `frontend/pages/report-issue.tsx:99`.
   - Psychological effect: the user does not have to become a debugger before asking for help.

5. AI Studio has a real "serious tool" feeling.
   - Production observation: Create, Edit, Video, Sound, libraries, right rail, credits, and project navigation are all available in one workspace.
   - Psychological effect: the app feels capable enough to justify paid positioning.

## P0/P1 psychological breaks

### P1: Public legal pages currently undermine payment trust

Production observation: public legal pages are reachable, but the live Terms, Privacy, and Refund pages include publication-candidate language and placeholders such as `[LEGAL ENTITY NAME]`, `[SUPPORT EMAIL]`, `[LEGAL EMAIL]`, and pending counsel/entity/contact review.

Repo evidence: seed legal markdown has cleaned-up contact language in `frontend/content/legal/terms.md:11`, `frontend/content/legal/privacy.md:7`, and `frontend/content/legal/refund-policy.md:7`, while runtime policy pages are served through the legal control plane in `frontend/features/legal/server/legalPolicyContent.ts:32`.

Psychological effect: a buyer checking refund, privacy, or terms before paying sees an unfinished legal surface. That is not a small copy issue; it can make the whole product feel pre-commercial even when the app itself is polished.

Recommended decision: before asking real customers to pay, publish final public legal policy content without placeholders or publication-candidate caveats.

Follow-up metric: pricing-to-checkout continuation rate and support questions about refunds/privacy.

### P1: Credits are visible, but not translated into purchase confidence

Production observation: dashboard shows `485 / 12,000`; pricing shows plan credits; profile credits shows packages and unit price. None of those surfaces consistently answer the buyer's practical question: "what can I make with this, and what should I buy for the thing I am trying to do?"

Repo evidence:

- Plan cards show monthly credit quantities in `frontend/features/billing/components/SubscriptionPlanCard.tsx:57`.
- Credit packages show package size and price per 1,000 credits in `frontend/features/profile/components/ProfileCreditsSection.tsx:191`.
- AI Studio already has exact insufficient-credit copy available in `frontend/features/ai-studio/logic/insufficientCredits.ts:50`, and the guardrail passes required credits through `frontend/features/ai-studio/hooks/generationCreditGuardrail.ts:48`.

Psychological effect: the user can understand the accounting but still hesitate to spend. The feeling is "I know the price, but not the value." That weakens top-ups, upgrades, and subscription confidence.

Recommended decision: add a credit-to-output bridge on pricing/profile and make every insufficient-credit/top-up moment say required credits, available credits, shortfall, and the smallest sensible package.

Follow-up metric: checkout starts from AI Studio low-credit modal, credit-package conversion, pricing-page scroll-to-CTA conversion.

### P1: AI Studio first impression is powerful but intimidating

Production observation: blank Create shows Standard/Pulse, toolbar workflows, libraries, character mode, model, aspect ratio, resolution, quick slot inventory, reference grid, media limit, and a disabled generate button before the user writes a prompt.

Repo evidence:

- Create asks "What do you want to make?" but immediately renders secondary controls in `frontend/features/ai-studio/components/create/StandardCreatePanelView.tsx:291`.
- Character mode is visible in the first control row in `frontend/features/ai-studio/components/create/StandardCreatePanelView.tsx:311`.

Psychological effect: expert users may read this as power. New buyers may read it as prerequisite knowledge. The first emotional job should be "say your idea"; instead the user may wonder which hidden mode/model/settings are correct.

Recommended decision: preserve expert controls, but make the first empty state emotionally simpler: primary prompt first, controls as confidence aids after intent is entered or when the user asks for them.

Follow-up metric: first prompt entry rate, first successful generation rate, time from AI Studio landing to first prompt.

### P1: Project persistence copy exposes internal machinery when trust is fragile

Production observation: project creation and project opening are easy, but the live experience and repo copy lean on technical concepts rather than user reassurance.

Repo evidence:

- Project open steps include "Verify session," "Check media agreement," "Resolve project," "Load workspace," and "workspace snapshot" in `frontend/features/ai-studio/components/AiStudioProjectEntryState.tsx:36`.
- Autosave warnings mention "reduced workspace snapshot," "size limits," "archived outputs," and "asset repair" in `frontend/features/ai-studio/hooks/useAiStudioProjectWorkspacePersistenceController.ts:515`.

Psychological effect: project continuity is the paid product promise. When the app says "snapshot" or "repair pending," users may hear "my work may not come back" without knowing what is safe or what action to take.

Recommended decision: translate persistence/recovery copy into user terms: "Your project is saved," "Recent generated media may need a moment to reappear," "These items are safe," and "Here is what to do."

Follow-up metric: project reopen success perception, repeat project-open rate, support reports mentioning missing/lost work.

## P2 psychological breaks

### P2: Right-rail global state is intentional but not self-explaining

Production observation: Canvas, Quick Slot Inventory, and Reference Grid are persistent global surfaces, but the user has to infer what hidden versus deleted means.

Repo evidence:

- ADR 0083 defines Reference Grid, Quick Slot Inventory, and Canvas as workspace-global in `docs/adr/0083-create-mode-global-right-rail-authority.md:29`.
- Empty state says "Right-rail panels are hidden" in `frontend/features/ai-studio/reference-grid/components/ReferenceGridSections.tsx:606`.

Psychological effect: if assets appear/disappear across Standard, Pulse, Create, Edit, Video, and Sound, the user may believe work was lost or leaked between modes. The implementation is correct; the mental model is under-taught.

Recommended decision: label global right-rail behavior as a user promise: "Shared across this project" and "Hidden, not deleted."

Follow-up metric: support reports about missing references/slots/canvas, toggles reopened after hiding.

### P2: Pulse labels can feel unfinished

Production observation: Pulse mode showed useful built-ins like `Single Shot Video`, `Multi Shot Video`, and `DFY Story Builder`, but also internal-looking labels like `Contract Pulse 904092`.

Repo evidence: Pulse rail renders saved and built-in presets through `frontend/features/ai-studio/components/create/PulseCreatePanelView.tsx:371`.

Psychological effect: Pulse should feel like guided creative intelligence. Internal-looking preset names make it feel like the user has stumbled into a testing/control-plane surface.

Recommended decision: suppress, rename, or clearly separate user-created/internal custom Pulses from polished built-in guided workflows.

Follow-up metric: Pulse activation rate and abandon rate from Pulse mode.

### P2: Video feels expensive before it feels guided

Production observation: Video exposes Standard/Motion Control/Lip Sync, model, aspect ratio, resolution, duration, audio, frame slots, mode, shot type, styles, and `Generate ✦ 20` before the user writes the scene.

Psychological effect: a knowledgeable user sees control. A hesitant buyer sees many ways to waste credits.

Recommended decision: add stronger prerequisite reassurance and plain-language summaries near Generate: "This will make a 6s vertical video with optional audio. No credits are spent until you click Generate."

Follow-up metric: video prompt entry rate, video generate click rate, pre-generate abandonment.

### P2: Generation failure/retry copy does not fully protect credit trust

Repo evidence:

- Studio Preview collapses state to "Processing" or "Failed" in `frontend/features/ai-studio/components/StudioPreview.tsx:151`.
- The empty preview still says "Generated images will appear here" even though current workflows include video and audio in `frontend/features/ai-studio/components/StudioPreview.tsx:132`.
- Provider failures are normalized through `frontend/lib/customerFacingProviderText.ts:341`.

Psychological effect: when generation is slow or failed, the user needs to know whether credits were spent, whether retrying risks another charge, and whether the result is still coming. Generic failure labels make repeat spending feel unsafe.

Recommended decision: failure/retry states should say charge status, retry safety, and next action whenever the backend knows it.

Follow-up metric: repeated generation attempts after failure, refund/credit-restoration support reports.

### P2: Storage blocks can feel punitive

Repo evidence:

- Reference Grid save label becomes "Storage full" in `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx:218`.
- Media Library upload picker returns silently when quota-blocked in `frontend/features/ai-studio/components/MediaLibraryPanel.tsx:1133`.

Psychological effect: users learn the wall before the door. Storage limits feel like punishment instead of a recoverable account-management state.

Recommended decision: every storage-blocked action should include "Manage storage" or "Free up space" plus the destination.

Follow-up metric: storage add-on conversion, failed upload retries, support reports mentioning storage full.

### P2: Report Issue confirmation is too black-boxed

Production observation: intake is clear, but success copy only says the report was saved for review.

Repo evidence: success message is `"Report sent. We saved your note and context for review."` in `frontend/pages/report-issue.tsx:71`.

Psychological effect: after asking for help, the user does not know whether anyone will respond, where, how soon, or how to return to the interrupted workflow.

Recommended decision: add next-step expectation: response channel, expected review window if known, and a return-to-prior-route action.

Follow-up metric: duplicate reports, support follow-up questions, return-to-product rate after report submission.

### P2: Public promises overstate normal AI friction

Repo evidence: public funnel routes into signup/AI Studio through `frontend/features/dashboard/routes/PublicDashboardRoute.tsx` and pricing paths, while recovery surfaces still include media agreement unavailable states in `frontend/features/compliance/components/MediaComplianceGate.tsx:41` and normalized provider failures in `frontend/lib/customerFacingProviderText.ts:341`.

Psychological effect: strong marketing is good, but absolute "zero frustration" style claims make normal provider latency, compliance gates, and recovery moments feel like broken promises.

Recommended decision: keep the confidence, remove absolutes. Promise creative leverage and recoverability, not frictionless magic.

Follow-up metric: signup-to-first-generation completion and rage-click/backtrack events around gates/failures.

## P3 psychological breaks

### P3: Account summary can feel like monitoring before creation

Production observation: the dashboard header immediately shows plan, storage, and credits before work entry.

Repo evidence: authenticated dashboard header cards are defined in `frontend/features/dashboard/components/AuthenticatedDashboardRoute.tsx:322`.

Psychological effect: for returning users this builds control. For new users it may feel like metering before value.

Recommended decision: preserve account meters, but pair them with more value translation: "ready to create" rather than only quotas.

### P3: Sound credit estimate is less reassuring than Create/Video

Production observation: Sound Voiceover showed `Generate ✦ —` while disabled, whereas Create and Video showed visible estimates (`4`, `20`) in their disabled states.

Psychological effect: inconsistency makes pricing feel less predictable, especially for users trying to compare workflows.

Recommended decision: show why the estimate is unavailable or when it will appear.

### P3: Media Library success feedback may be too fleeting

Repo evidence: Media Library membership feedback timeout is `1800ms` in `frontend/features/ai-studio/components/MediaLibraryPanel.tsx:111`.

Psychological effect: "saved," "moved," or "added" are ownership events. If confirmation disappears too fast, users may repeat actions or doubt persistence.

Recommended decision: durable media actions should leave a slightly longer or inspectable confirmation trail.

### P3: App crash recovery misses the support bridge

Repo evidence: app error boundary offers reload/recovery actions in `frontend/components/AppErrorBoundary.tsx:63`, while `/report-issue` is the route that captures signed-in context.

Psychological effect: after a crash, the user is most anxious, but the app does not point to the support lane that preserves context.

Recommended decision: add a report/support option when a signed-in route hits the global error boundary.

### P3: Auth/signup fallback can become a closed-door experience

Repo evidence: when signup is requested but disabled, auth falls back to sign-in and shows "Account creation is not open yet" in `frontend/pages/auth.tsx:249`.

Psychological effect: if this switch is ever off while public CTAs invite signup, users experience "I was invited, then rejected."

Recommended decision: if signup closes, public CTAs must change at the same time or use explicit waitlist/limited-access copy.

## Ranked fix themes

1. Launch trust blockers
   - Finalize public legal policy content.
   - Remove production placeholders and publication-candidate language.
   - Align public promise language with recoverable AI reality.

2. Money confidence
   - Translate credits into output examples.
   - Make low-credit modals concrete: required, available, shortfall, best package.
   - Add charge/retry safety language to failed/processing generation states.

3. Work continuity confidence
   - Replace internal persistence language with user-safe language.
   - Teach global right rail as "shared within this project."
   - Make save/move/add confirmations more durable.

4. First-value momentum
   - Soften the first blank AI Studio state.
   - Make the next action more dominant than model/settings/control stacks.
   - Clean up internal-looking Pulse names.

5. Recovery reassurance
   - Add next-step expectations to report issue.
   - Add support handoff to crash/legal-unavailable/recovery dead ends.

## Suggested implementation order

1. Finalize legal pages and remove placeholder production content.
2. Add credit-to-output and low-credit shortfall translation.
3. Rewrite project restore/autosave notices into user-safe language.
4. Add right-rail "shared/hidden not deleted" reassurance.
5. Simplify first-run AI Studio empty-state hierarchy without removing expert controls.
6. Add support/next-step bridges to report issue, crash, legal unavailable, and auth recovery.

## Non-goals for this audit

- No visual redesign recommendation beyond copy/mental-model hierarchy.
- No mobile-specific optimization.
- No admin/operator UX scoring.
- No provider generation testing.
- No checkout/purchase testing.
- No uploads, deletes, project mutations, or credit-spending actions.

## Bottom line

ShortPulse already has the ingredients of a product people can pay for: durable projects, rich creative surfaces, account visibility, and enough capability density to feel serious. The main psychological risk is that the app sometimes talks like its implementation instead of like a guide. Users will keep buying when they believe three things: their work is safe, their spend is understandable, and the next step is obvious. The repo and production app are close enough that targeted trust-language and value-translation work should have higher ROI than broad UX restructuring.
