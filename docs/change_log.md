# ShortPulse Changelog

Official customer-readable record of ShortPulse patch updates.

ShortPulse launched on July 7, 2026. This changelog starts fresh from the post-launch reset requested on July 10, 2026. Earlier pre-launch and internal engineering history was intentionally retired from this public-facing log so future entries stay readable and useful to customers.

## How To Update This Changelog

- Write entries for users, not as raw commit messages.
- Log every shipped production batch in customer-readable language, including product changes, fixes, pricing/billing changes, support workflow changes, docs/governance changes, agent/tester report updates, internal reliability work, tooling, and known issues.
- Keep sensitive details, secrets, customer-private data, and noisy implementation minutiae out; summarize internal work by outcome instead.
- Add pending entries under `## Unreleased`.
- When a patch is published, move relevant `Unreleased` entries into a dated section using `## YYYY-MM-DD`.
- Keep newest dated sections first.
- Use the categories below when they apply: `Added`, `Changed`, `Fixed`, `Improved`, `Known Issues`.

## Unreleased

### Added

- Added a review-only Seedance pricing migration preview with a five-row composition-neutral candidate, legacy rule diff, provider margin envelopes, and an artifact hash; it does not activate pricing.
- Added compare-and-swap protection for future model-pricing policy applies so stale admin state cannot replace a newer active policy.
- Added an admin-only model-pricing dry-run endpoint so pricing policy publication can be reviewed with deterministic rule changes and an artifact hash before activation.
- Added media-upload intent hardening, generation ownership SQL migrations, GitHub hosted-SQL workflow contract tests, and an architecture-audit handoff packet for follow-up production hardening work.
- Added launch-week production-operations guidance so ShortPulse work now centers on protecting live customer use, investigating production reports, and shipping small evidence-backed fixes on `production`.
- Added OpenAI internal capacity-admission tracking and related SQL checks so agent/runtime capacity pressure can be audited instead of treated as opaque provider noise.
- Added a generation output media-link API path and tests so persisted generation outputs can expose their media linkage more reliably.
- Added new Maya tester reports for Styles Library application and Tiny Apartment project-home review, plus Hybervees insight summaries for Maya's Quick Slot Inventory findings.
- Added a customer-readable changelog ownership rule to Gear Ball SOPs so every future production batch is recorded here as part of publish readiness.

### Changed

- Updated Seedance video-reference billing so customer credits use the requested output duration while provider-cost evidence still accounts for attached reference-video duration.
- Updated Seedance pricing architecture so a reviewed profile-bearing policy can charge one output-duration price per model/resolution regardless of attached image, audio, or video assets, while legacy policy v9 remains unchanged.
- Updated Seedance provider-cost evidence and reference-duration validation so video economics remain input-sensitive and missing or over-limit duration is rejected before credit reservation.
- Updated model-pricing runtime reads so the current legacy v9 policy can use a complete in-memory billing artifact for customer pricing display and server debit while admin authoring reads stay unchanged until the next reviewed policy activation.
- Updated model-pricing billed-credit resolution so published fixed and quantity rules can act as runtime billing authority even when no provider-cost calculator exists for the row.
- Updated model-pricing policy handling so pricing-grid rows, custom row materialization, admin pricing controls, billing reservations, and AI Studio pricing displays share a stricter billed-credit authority path.
- Updated hosted SQL apply workflows, runtime SQL security checks, database docs, and schema snapshots for the latest production migration and control-plane delivery posture.
- Updated AI Studio media/reference handling, audio uploads, adaptive pressure tracking, and provider proxy tests to better preserve safe media authority across upload, staging, reload, and provider-submit paths.
- Updated admin Kanban backlog mirroring and planning docs so backlog-source metadata, board activity, and security-remediation follow-ups stay easier to audit.
- Updated launch-week branch, runtime, database, and agent-governance wording across the repo from pre-launch readiness language to live production-operations language.
- Refreshed agent contracts, memories, SOPs, and indexes so named agents use the current launch-week trust and production-branch posture.
- Updated Maya tester training, scoring, admin-publish checklists, and report templates to better separate browser evidence, ingest proof, and operator-admin verification.
- Updated planning, docs governance, release checklist, backlog, routes, API references, data dictionary, database migration notes, and security checklist for the latest production-operations and remediation lanes.
- Updated AI Studio Create composer guidance and tests around blocked reference drops and Chat Mode handoff.
- Updated AI Studio Create composer drop guidance so blocked media drops make the Chat Mode requirement easier to spot.
- Updated AI Studio Create composer input drop handling so blocked media drops over the prompt box also surface Chat Mode guidance instead of silently falling through.
- Updated AI Studio Create composer Chat Mode guidance styling so the blocked-drop highlight targets the intended prompt-row control more precisely.
- Recorded the latest Gear Ball SOP score and improvement note for this production batch.

### Fixed

- Fixed pricing and generation edge cases so pre-provider pricing rejection does not dispatch a provider request, Kie status aborts remain nonterminal/transient, orphaned optimistic debits are removed after local rejection, and Seedance rerolls require duration evidence when video references are present.
- Fixed Seedance 2 video re-roll billing evidence so restored reference videos keep duration metadata, pricing evidence is verified before re-roll submission, and over-limit reference-video runs are blocked before credits are reserved.
- Fixed prompt-only Seedance 2 billing evidence so production reservations use the explicit no-video-input pricing row instead of conflicting with the displayed pricing variant.
- Improved Pulse/Standard agent runtime handling for fast-path turns, vision summaries, capacity admission, and route outcome parity.
- Improved AI Studio media-library persistence handling and generation output media linkage coverage.
- Tightened Kie media admission guardrails and Kling 3.0 documentation so unsupported provider-facing media is caught earlier.
- Hardened OpenAI image description, style extraction, and voiceover enhancement routes with updated route tests and safer runtime behavior.
- Improved dashboard project action coverage and runtime SQL security audit checks.
- Updated Badearsai and admin backlog tooling so admin-error intake and backlog sync flows better match the launch-week operating model.

## 2026-07-10 - Fresh Post-Launch Baseline

### Changed

- Reset the ShortPulse changelog after the July 7, 2026 launch so public patch notes can stay clean, accurate, and easy to maintain going forward.
