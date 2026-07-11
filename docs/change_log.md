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

- Added launch-week production-operations guidance so ShortPulse work now centers on protecting live customer use, investigating production reports, and shipping small evidence-backed fixes on `production`.
- Added OpenAI internal capacity-admission tracking and related SQL checks so agent/runtime capacity pressure can be audited instead of treated as opaque provider noise.
- Added a generation output media-link API path and tests so persisted generation outputs can expose their media linkage more reliably.
- Added new Maya tester reports for Styles Library application and Tiny Apartment project-home review, plus Hybervees insight summaries for Maya's Quick Slot Inventory findings.
- Added a customer-readable changelog ownership rule to Gear Ball SOPs so every future production batch is recorded here as part of publish readiness.

### Changed

- Updated launch-week branch, runtime, database, and agent-governance wording across the repo from pre-launch readiness language to live production-operations language.
- Refreshed agent contracts, memories, SOPs, and indexes so named agents use the current launch-week trust and production-branch posture.
- Updated Maya tester training, scoring, admin-publish checklists, and report templates to better separate browser evidence, ingest proof, and operator-admin verification.
- Updated planning, docs governance, release checklist, backlog, routes, API references, data dictionary, database migration notes, and security checklist for the latest production-operations and remediation lanes.
- Updated AI Studio Create composer guidance and tests around blocked reference drops and Chat Mode handoff.

### Fixed

- Improved Pulse/Standard agent runtime handling for fast-path turns, vision summaries, capacity admission, and route outcome parity.
- Improved AI Studio media-library persistence handling and generation output media linkage coverage.
- Tightened Kie media admission guardrails and Kling 3.0 documentation so unsupported provider-facing media is caught earlier.
- Hardened OpenAI image description, style extraction, and voiceover enhancement routes with updated route tests and safer runtime behavior.
- Improved dashboard project action coverage and runtime SQL security audit checks.
- Updated Badearsai and admin backlog tooling so admin-error intake and backlog sync flows better match the launch-week operating model.

## 2026-07-10 - Fresh Post-Launch Baseline

### Changed

- Reset the ShortPulse changelog after the July 7, 2026 launch so public patch notes can stay clean, accurate, and easy to maintain going forward.
