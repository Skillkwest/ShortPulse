# ShortPulse Backlog

Last audited: 2026-07-08
Status: active

How to use:

- Keep this list execution-focused and current.
- Start with `docs/planning/execution-authority.md` before opening a new lane.
- Open new work only from a catalog weakness, a known issue, a failing test/live repro, or a blocker discovered inside the current lane.
- For launch-readiness sequencing, keep this backlog aligned with the current Copperknot queue and systems catalog rather than treating it as an isolated planning surface.
- If a newer source of truth contradicts this file, update this backlog before using the stale item to justify work.
- In this file, "below launch-readiness target" means the current readiness docs still treat that workflow or system as not yet ready to ship with confidence.
- Move major outcomes into `docs/change_log.md`.
- Keep section structure locked (no urgency/priority sub-sections).

Structure (locked):

- `Program 0: Execution Authority`
- `Program 1: Runtime And Money`
- `Program 2: Media And Reference Integrity`
- `Program 3: Structural Decomposition`
- `Program 4: Workflows And Product Surfaces`
- `Program 5: Release Confidence And Research`

## Program 0: Execution Authority

## Program 1: Runtime And Money

- Make paid generation cost and charge state obvious before and after spend: show known costs or safe pending/unavailable states before Generate, explain charge/retry status on failures, and make Sound disabled estimates as reassuring as Create and Video. Sources: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P0 - Credit cost can become psychologically illegible at the spend moment"; `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Generation failure/retry copy does not fully protect credit trust" and "P3: Sound credit estimate is less reassuring than Create/Video."
- Make credits understandable across pricing, AI Studio, dashboard, and profile by connecting visible balances, plan credits, top-ups, and remaining-credit indicators to clear creative value. Keep the broader credit-education posture deferred until the owner revisits it. Sources: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Credit understanding is split across too many places"; `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P1: Credits are visible, but not translated into purchase confidence" and "P3: Account summary can feel like monitoring before creation"; Trello `Backlog` card "credits remaining visual ui in ai studio top left and in dashboard. redesign functional amount indicator" imported 2026-07-07.
- Add customer-visible generation credit usage history to `/profile?section=credits` without changing pricing, renewal, expiration, top-up packaging, subscription behavior, refund policy, or exposing raw ledger/provider metadata. Source: `docs/records/artifacts/agent/hybervees/reports/2026-07-07-maya-credits-renewal-confidence-insight-review.md`.
- Reframe low-balance and insufficient-credit recovery as a continuation/top-up path while preserving exact required and available credit values. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - \"Insufficient Credits\" is accurate but can feel punitive."
- Clarify plan/tier language so subscriptions map to concrete creator outcomes and do not imply unsupported team or multi-seat semantics. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Plan language is mostly creator-focused but has a few expectation mismatches."
- Make post-subscription checkout return feel rewarding and creator-facing while AI Studio creates or opens the starter project. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P0 - Paid checkout return can feel operational instead of rewarding."
- Finalize public legal policy content and trust details so payment-adjacent pages do not expose placeholders, publication-candidate caveats, or unresolved entity/contact language. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P1: Public legal pages currently undermine payment trust."
- Rotate Stripe restricted keys and update any dependent configuration or operational notes needed for safe payment runtime. Source: Trello `Backlog` card "rotate stripe keys for restricted keys" imported 2026-07-07.

## Program 2: Media And Reference Integrity

- Make saved-work state, destination, and confirmation obvious across Reference Grid and Media Library, including not-saved, saved-to-library, saved-in-project, could-not-save, and "view it" recovery paths. Do not reopen `My Generations` from this item. Sources: `docs/records/artifacts/agent/hybervees/reports/2026-07-06-maya-authenticated-orientation-insight-review.md`; `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Save/autosave reassurance is not visible enough for a paid creative tool"; `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P3: Media Library success feedback may be too fleeting."
- Make generated-media context recovery obvious from saved assets: expose details, prompt/model setup, timestamps, and copy-prompt feedback without relying on hidden double-click behavior. Sources: `docs/records/artifacts/agent/hybervees/reports/2026-07-07-maya-find-generated-image-context-insight-review.md`, `docs/records/artifacts/agent/hybervees/reports/2026-07-07-maya-prompt-detail-recovery-insight-review.md`, `docs/records/artifacts/agent/hybervees/reports/2026-07-07-maya-find-both-assets-later-insight-review.md`; Trello `Backlog` card "timestamps on media to display in the detail modal with ui" imported 2026-07-07.
- Clarify global right-rail behavior as a project-level promise: Reference Grid, Quick Slot Inventory, and Canvas can hide/show without deleting assets, and remove-from-grid must stay distinct from delete-from-library. Sources: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Right-rail global state is intentional but not self-explaining"; `docs/records/artifacts/agent/hybervees/reports/2026-07-07-maya-reference-grid-understanding-insight-review.md`; Trello `Backlog` card "Ref Grid expand" imported 2026-07-07.
- Improve active-generation status in the Reference Grid with elapsed-time or duration indicators for generating references. Sources: Trello `Backlog` cards "elapsed time pill on generating refs" and "generation duration counter on active generations in the ref grid" imported 2026-07-07.
- Make Media Library loading, empty, and preview states explain the active scope so users can tell the difference between loading, true empty, filters/folders/tabs, and missing project previews. Sources: Trello `Backlog` card "Loading skeleton spinners in the media library" imported 2026-07-07; `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Project previews are useful but can briefly undercut the \"my work is here\" feeling" and "P2 - Media Library empty states can still feel like data loss if context is ambiguous."
- Preserve concrete media action language and recovery paths for destructive actions, storage blocks, uploads, reference saves, folder membership, and media moves. Sources: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Destructive actions are mostly protected, but deletion language should stay concrete"; `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Storage blocks can feel punitive."
- Add preview thumbnails for Character look cards or look-related media where users need quick visual identification. Source: Trello `Backlog` card "Preview thumb on looks" imported 2026-07-07.
- Refine video snapshot naming conventions so generated or captured snapshots are understandable and consistent. Source: Trello `Backlog` card "refine video snapshot naming conventions" imported 2026-07-07.
- Polish audio waveform graphics across media and audio reference surfaces. Source: Trello `Backlog` card "ALL audio waveform graphics polish" imported 2026-07-07.
- Add the background-image creation prompt area for audio reference cards in the admin panel. Source: Trello `Backlog` card "Audio ref card background image creation prompt area in admin panel" imported 2026-07-07.
- Evaluate a third-party masonry display system for media-heavy surfaces before adopting it. Source: Trello `Backlog` card "3rd party masonry display system for media" imported 2026-07-07.
- Define the Gallery surface or decide its canonical relationship to Media Library and Reference Grid before building it. Source: Trello `Backlog` card "Gallery" imported 2026-07-07.

## Program 3: Structural Decomposition

- Standardize behavior across prefab buttons without changing current product semantics. Source: Trello `Backlog` card "Standardized behavior across prefab buttons." imported 2026-07-07.
- Make global crash recovery explain project/workspace preservation or the correct recovery path, and add a signed-in report/support bridge when route/project context is available. Sources: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Global app crash recovery does not reassure work preservation"; `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P3: App crash recovery misses the support bridge."

## Program 4: Workflows And Product Surfaces

- Preserve AI Studio Create prompt drafts across natural pre-spend detours, especially checking `/profile?section=credits` and returning with browser history. Source: `docs/records/artifacts/agent/hybervees/reports/2026-07-06-maya-authenticated-orientation-insight-review.md`.
- Add full-app undo behavior with clear ownership and safety boundaries for `Ctrl+Z`. Source: Trello `Backlog` card "ctrl z Undo full app wide" imported 2026-07-07.
- Design Seedance multishot image-slot behavior shot by shot. Source: Trello `Backlog` card "seedance multishot image slot shot by shot" imported 2026-07-07.
- Redesign and polish Pulse while preserving current Pulse terminology, launch-critical workflow contracts, and guided-workflow semantics; remove or clearly separate internal-looking labels. Sources: Trello `Backlog` card "Redesign pulse" imported 2026-07-07; `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Pulse labels can feel unfinished."
- Add an AI Studio tutorials button modeled on the home page tutorial flow. Source: Trello `Backlog` card "tutorials button in the ai studio -- this will be exactly like the home page tutorial flow" imported 2026-07-07.
- Evaluate whether OmniHuman belongs in the Kie provider/model switch and define the supported workflow before implementation. Source: Trello `Backlog` card "Omnihuman in kie switch??" imported 2026-07-07.
- Add or refine collapsible toolbar behavior for AI Studio/workflow controls. Source: Trello `Backlog` card "Collapsable tool bar" imported 2026-07-07.
- Treat alternate screen sizes and mobile optimization as explicitly approved scope only, because the repo policy remains desktop-first. Source: Trello `Backlog` card "alternate screen size and mobile optimize" imported 2026-07-07.
- Build a developer-facing style and preset library browser. Source: Trello `Backlog` card "Developer's style and preset library browser." imported 2026-07-07.
- Strengthen selected-style application reliability before adding broader visible style controls by adding model-family style-adherence evidence runs and internal adapter/preflight improvements for prompt-applied Styles. Source: Styles panel audit on 2026-07-03 / `docs/sops/sop_ai_studio_style_creator.md` and `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`.
- Make the first media compliance gate feel like one-time creator protection rather than a cold account checkpoint while preserving the requirement. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Compliance gate is necessary but emotionally cold before payoff."
- Translate AI Studio project restore, open, autosave, snapshot, loading, and repair messaging into user-safe continuity language that explains what is saved, what may still be loading, and what action is needed. Sources: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Project restore/loading copy is technically accurate but not emotionally reassuring"; `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P1: Project persistence copy exposes internal machinery when trust is fragile."
- Keep Templates, Workflows, and Community quarantined/sequestered so they do not compete with launch-critical creation paths; `My Generations` is retired rather than deferred. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Dense AI Studio navigation includes unfinished destinations."
- Keep public homepage motion/proof density visible, but do not open an implementation lane without performance evidence, conversion confusion, or review-backed visual overload. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Public homepage motion and proof density can inspire or overwhelm."
- Make auth confirmation, callback waits, signup availability, and launch CTAs explain what happened, what happens next, and where the user will land. Sources: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Auth confirmation and email flows create waiting-room anxiety"; `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P3: Auth/signup fallback can become a closed-door experience."
- Preserve the AI Studio project-name ownership anchor while making edit behavior feel direct and predictable. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - The project name is a good anchor but edit affordance is indirect."
- Add contextual Report Issue paths after repeated or high-trust failures, capture route/generation/project context where available, and make the success state explain response expectations and a path back to work. Sources: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Report issue is good, but failure moments do not consistently route to it"; `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Report Issue confirmation is too black-boxed."
- Simplify the first blank AI Studio Create impression so the prompt/idea path is emotionally dominant and expert controls become confidence aids rather than prerequisite knowledge. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P1: AI Studio first impression is powerful but intimidating."
- Add plain-language pre-generate reassurance for Video so users understand output shape, duration, audio implications, and that credits are not spent until Generate. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Video feels expensive before it feels guided."
- Align public promise language with normal AI friction by preserving confidence while avoiding absolutes that make provider latency, compliance gates, or recoverable failures feel like broken promises. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Public promises overstate normal AI friction."

## Program 5: Release Confidence And Research

- Freshness-gated UX backlog: before using the psychological UX audit for launch sequencing, refresh the current Copperknot/source-of-truth launch authority and reclassify active blockers, deferred watch items, and superseded findings. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Launch-readiness docs already identify human-readiness as underclassified."
