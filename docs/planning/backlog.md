# ShortPulse Backlog

Last audited: 2026-06-16
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

- UX psychology backlog: make every billable generate affordance show a known cost, a clear cost-pending state, or a disabled unavailable state before spend. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P0 - Credit cost can become psychologically illegible at the spend moment."
- UX psychology backlog: make post-subscription checkout return feel rewarding and creator-facing rather than operational while AI Studio creates/opens the starter project. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P0 - Paid checkout return can feel operational instead of rewarding."
- Deferred UX note: credit-understanding education across pricing, profile credits, AI Studio header, and insufficient-credit modal is captured in `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` under "P1 - Credit understanding is split across too many places." Keep it discoverable, but do not implement changes from this item until the owner revisits the credit-education posture.
- UX psychology backlog: reframe low-balance recovery from punitive "Insufficient Credits" language toward continuation/top-up framing while preserving exact required and available credit values. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - \"Insufficient Credits\" is accurate but can feel punitive."
- UX psychology backlog: clarify plan/tier fit so subscription language maps to concrete creator outcomes and does not imply unsupported team or multi-seat semantics. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Plan language is mostly creator-focused but has a few expectation mismatches."
- UX psychology backlog: finalize public legal policy pages so payment-adjacent trust surfaces do not expose placeholders, publication-candidate caveats, or unresolved entity/contact language. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P1: Public legal pages currently undermine payment trust."
- UX psychology backlog: translate visible credit balances, plan credits, and credit packages into purchase confidence by connecting credits to likely creative output and sensible top-up paths. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P1: Credits are visible, but not translated into purchase confidence."
- UX psychology backlog: make generation failure, retry, and processing states protect credit trust by naming charge status, retry safety, whether the result may still arrive, and the next best action when known. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Generation failure/retry copy does not fully protect credit trust."
- UX psychology backlog: pair dashboard account meters with creator-value framing so plan, storage, and credit summaries feel like readiness to create instead of monitoring before value. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P3: Account summary can feel like monitoring before creation."
- UX psychology backlog: make Sound disabled credit estimates as reassuring as Create and Video by explaining when estimate data is unavailable or what input is needed before the estimate appears. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P3: Sound credit estimate is less reassuring than Create/Video."

## Program 2: Media And Reference Integrity

- Hybervees highest-ROI backlog: make saved-work destination behavior explicit and findable across the current Reference Grid and Media Library path. The first implementation lane should decide the canonical destination for saved text references, align the save button/confirmation with that destination, and provide a direct "view it" action. Do not reopen `My Generations` from this signal; that surface is already handled/retired in current backlog posture. Source: `docs/records/artifacts/agent/hybervees/reports/2026-07-06-maya-authenticated-orientation-insight-review.md` / Maya stopped before spending credits because `Save to media library` removed the button while Media Library still looked empty.
- UX psychology backlog: make save/autosave state feel durable and legible at the output/card level, including not-saved, saved-to-library, saved-in-project, and could-not-save states. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Save/autosave reassurance is not visible enough for a paid creative tool."
- UX psychology backlog: make project preview loading/no-preview states explicit so temporary blank project cards do not feel like missing creative work. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Project previews are useful but can briefly undercut the \"my work is here\" feeling."
- UX psychology backlog: preserve concrete destructive-action language that distinguishes deleting from library/storage versus removing from folders or other non-destructive scopes. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Destructive actions are mostly protected, but deletion language should stay concrete."
- UX psychology backlog: ensure Media Library empty states always name the active scope, such as folder, tab, filter, search, upload type, or true account-empty state. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Media Library empty states can still feel like data loss if context is ambiguous."
- UX psychology backlog: make every storage-blocked upload, reference save, or media action include a clear recovery path such as managing storage, freeing space, or the relevant account destination. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Storage blocks can feel punitive."
- UX psychology backlog: make Media Library save, move, add, and membership confirmations last long enough or remain inspectable enough to reinforce ownership and persistence. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P3: Media Library success feedback may be too fleeting."

## Program 3: Structural Decomposition

- UX psychology backlog: make global crash recovery reassure the user about project/workspace preservation or the correct recovery path when route/project context is available. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Global app crash recovery does not reassure work preservation."
- UX psychology backlog: add a signed-in report/support bridge to global crash recovery so users can send context from the moment where trust and work-preservation anxiety are highest. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P3: App crash recovery misses the support bridge."

## Program 4: Workflows And Product Surfaces

- Hybervees highest-ROI backlog: preserve AI Studio Create prompt drafts across natural pre-spend detours, especially checking `/profile?section=credits` and returning with browser history. Treat this as paid-use trust and runtime continuity work, not cosmetic polish, because the first Maya orientation run stopped before generation after a prepared prompt disappeared. Source: `docs/records/artifacts/agent/hybervees/reports/2026-07-06-maya-authenticated-orientation-insight-review.md`.
- UX psychology backlog: keep the media compliance requirement but make first-time compliance feel like one-time creator protection rather than a cold account checkpoint. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Compliance gate is necessary but emotionally cold before payoff."
- UX psychology backlog: replace technical AI Studio project restore/loading language with casual, light waiting copy while preserving durable-work transparency. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Project restore/loading copy is technically accurate but not emotionally reassuring."
- Deferred post-launch UX note: keep Templates, Workflows, and Community quarantined/sequestered so they do not compete with launch-critical creation paths or keep consuming proof/audit attention before those features are ready to build. `My Generations` is retired rather than deferred. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Dense AI Studio navigation includes unfinished destinations."
- UX psychology backlog: standardize generation/provider/save failure recovery around what happened, whether credits were charged or held, and the best next action. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Failure recovery often says \"try again\" without enough agency."
- Watch-only UX note: keep public homepage motion/proof density visible, but do not open an implementation lane without performance evidence, conversion confusion, or review-backed visual overload; preserve primary-action clarity if touched. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Public homepage motion and proof density can inspire or overwhelm."
- UX psychology backlog: make auth confirmation and callback waits clarify what happened, what happens next, and where the user will land after account setup finishes. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Auth confirmation and email flows create waiting-room anxiety."
- UX psychology backlog: preserve the AI Studio project-name ownership anchor while making edit behavior feel direct and predictable. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - The project name is a good anchor but edit affordance is indirect."
- UX psychology backlog: offer contextual "Report this issue" paths after repeated or high-trust failures, with captured route/generation/project context where available. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P2 - Report issue is good, but failure moments do not consistently route to it."
- UX psychology backlog: simplify the first blank AI Studio Create impression so the prompt/idea path is emotionally dominant and expert controls become confidence aids rather than prerequisite knowledge. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P1: AI Studio first impression is powerful but intimidating."
- AI Studio Styles backlog: strengthen selected-style application reliability before adding broader visible style controls by adding model-family style-adherence evidence runs and internal adapter/preflight improvements for prompt-applied Styles. Source: Styles panel audit on 2026-07-03 / `docs/sops/sop_ai_studio_style_creator.md` and `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`.
- UX psychology backlog: translate project restore, open, autosave, snapshot, and repair messaging into user-safe continuity language that explains what is saved, what may still be loading, and what action is needed. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P1: Project persistence copy exposes internal machinery when trust is fragile."
- UX psychology backlog: teach global right-rail behavior as a project-level promise, including "shared across this project" and "hidden, not deleted" language where assets or panels can appear/disappear across workflows. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Right-rail global state is intentional but not self-explaining."
- UX psychology backlog: remove, rename, or clearly separate internal-looking Pulse labels so guided Pulse workflows feel polished rather than like control-plane/testing surfaces. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Pulse labels can feel unfinished."
- UX psychology backlog: add plain-language pre-generate reassurance for Video so users understand output shape, duration, audio implications, and that credits are not spent until Generate. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Video feels expensive before it feels guided."
- UX psychology backlog: add next-step expectations to Report Issue success, including response channel or review expectation when known plus a path back to the interrupted workflow. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Report Issue confirmation is too black-boxed."
- UX psychology backlog: align public promise language with normal AI friction by preserving confidence while avoiding absolutes that make provider latency, compliance gates, or recoverable failures feel like broken promises. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P2: Public promises overstate normal AI friction."
- UX psychology backlog: keep public signup and launch CTAs synchronized with auth availability so disabled signup never feels like an invitation followed by rejection. Source: `docs/records/evidence/ux/2026-06-28-customer-psychological-experience-audit.md` / "P3: Auth/signup fallback can become a closed-door experience."

## Program 5: Release Confidence And Research

- Freshness-gated UX backlog: before using the psychological UX audit for launch sequencing, refresh the current Copperknot/source-of-truth launch authority and reclassify active blockers, deferred watch items, and superseded findings. Source: `docs/records/evidence/ux/2026-06-28-psychological-user-experience-audit.md` / "P1 - Launch-readiness docs already identify human-readiness as underclassified."
