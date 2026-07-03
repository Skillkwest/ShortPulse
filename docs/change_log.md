# ShortPulse Change Log

Add new work under `## Unreleased` at the top of this file. When promoting released work into dated sections, keep active dated headings in descending UTC order (newest first). Legacy imported entries below the legacy marker are preserved as historical notes and are not part of the enforced active chronology contract.

## Unreleased

- AI Studio navigation:
  - retired the hidden `My Generations` toolbar entry and removed its stale coming-soon/snapshot allow-list wiring, leaving generated work discovery owned by the active Reference Grid and Media Library surfaces.
- AI Studio Styles Library:
  - added a Restore built-ins action that clears only the per-user built-in Style deletion denylist, preserving custom Styles, custom order, and admin-managed built-in definitions,
  - and clarified built-in Style delete copy so account-local removal is not described as permanent deletion.
- Documentation cleanup:
  - archived the dormant inpaint reference-contract packet, the dormant inpaint live-preview packet, and the unreferenced create-character-mode hardening plan under `docs/archive/planning/`,
  - retargeted the archived packet cross-links to their archive paths,
  - and kept those dormant draft packets out of the active planning reading path.
- Documentation cleanup:
  - archived the dormant AI Studio project-persistence phase packet and the unreferenced Media Library redesign plan under `docs/archive/planning/`,
  - retargeted the surviving active project-persistence inventory and archived master plan to the archived phase-plan paths,
  - and kept the active planning surface focused on the newer workspace-isolation execution lane instead of future migration packet history.
- Documentation cleanup:
  - archived four dormant/completed planning docs out of `docs/planning/` into `docs/archive/planning/`,
  - trimmed the top-level docs index so planning navigation now points readers to the curated active index instead of a giant historical file list,
  - and updated the active/archive planning indexes to reflect the narrower current reading path.
- AI Studio generate concurrency hardening:
  - removed the remaining active generate-button click locks in Music and Expert Edit so users can trigger repeated generations without waiting for prior renders to settle,
  - converted AI Studio lane/audio busy tracking to concurrent-aware counting and replaced the old boolean-shaped lane API with explicit begin/end generation markers,
  - removed the remaining shared credit, Character Mode preflight/loading, and reservation/admission submit gates that still blocked rapid repeat generate clicks across create, edit, video, audio, and agent-output surfaces,
  - and closed the lane with focused Vitest coverage for Music, Sound Effects, Voices, PromptStep actions, AI Studio view-model/controller flows, generation billing reservations, and Fal submit proxy behavior.
- Staging/working-development Supabase parity hardening:
  - applied `sql/migrations/123_add_audio_companion_art_projection_fields.sql` to the staging Supabase project so `generation_projection` now matches working-development on the companion-art columns and pending index,
  - expanded `scripts/ops/supabase_public_schema_parity.sh` to compare columns and indexes in addition to tables, routines, and policies,
  - and fixed `scripts/check_vercel_env_contract.mjs` so development-only Vercel env audits no longer false-fail by carrying a preview branch default into non-preview checks.
- Working-development continuity seeding:
  - added `scripts/ops/supabase_seed_single_user_staging_to_dev.mjs` to seed one staging user's owned relational rows into the dedicated working-development Supabase project,
  - added optional `--storage-scope continuity` and `--skip-db` modes so project/character continuity media can be hydrated without rerunning the full relational seed,
  - and hardened the seed against legacy staging contamination by skipping `character_quick_swap_items` rows whose linked `character_media_assets.asset_kind` is not `quickswap`.
- Working-development first-run hardening:
  - restored the missing `auth.users.on_auth_user_created_billing_setup` attachment on the dedicated dev Supabase project using the canonical billing bootstrap SQL,
  - backfilled the already-created dev user so billing/credit baseline rows match the repaired signup contract,
  - documented that hosted dev bootstrap needs auth-side trigger parity in addition to `public` schema parity and ACL sync,
  - and improved AI Studio zero-project recovery by exposing `Open projects` from the gated error shell and wiring dashboard `ProjectsModal` with its create-project callback.
- Working-development bootstrap hardening:
  - added `scripts/ops/supabase_public_acl_sync.sh` to sync hosted `public` grants/revokes after schema-only Supabase bootstrap,
  - documented the grant-sync requirement for development bootstrap and SQL operator workflows,
  - and fixed the dedicated working-development runtime so the local generation control-plane worker now runs against the new dev database without `worker_instances` permission failures.
- Working-development environment split:
  - bootstrapped the dedicated `working-development` Supabase project to staging parity for `public` schema, routines, and policies without cloning staging user-owned runtime data,
  - rewired Vercel `development` and local `frontend/.env.local` to the dedicated development project while keeping preview on staging and production on production,
  - and tightened the Vercel env-contract audit so `development` must now differ from `preview` on the critical Supabase/base-URL keys.
- Local operator credential handling:
  - expanded `.env.agent.local.example` and local-development guidance to include dedicated working-development, staging, and production Supabase credential blocks,
  - and standardized the gitignored root `.env.agent.local` file as the local operator home for environment credentials instead of a repo-tracked secret note.
- Nuclo operator surface hardening:
  - added standing SOPs for hosted Supabase migration apply/validation, Vercel env repair, production smoke testing, and the destructive-data guard,
  - added `sql/README.md` as the SQL operator index for migrations, checks, configure scripts, and safety notes,
  - and linked the new operator surfaces through the docs and Nuclo retained SOP indexes.
- Vercel contract cleanup closeout:
  - verified the stale warning-only Vercel env rows are no longer present,
  - confirmed only the canonical Supabase runtime keys remain across development, preview, and production,
  - and closed the last pending env-contract warning lane with a clean `scripts/ops/vercel_env_audit.sh` pass.
- Nuclo Supabase manager hardening:
  - made the standing Nuclo contract explicit for future Supabase work,
  - granted full-access posture for schema, migration, parity, and hosted environment operations,
  - and codified the safety boundary that Nuclo must not delete auth users or user-owned data during normal operations.
- Secret-exposure response hardening:
  - added `docs/sops/sop_secret_exposure_rotation.md` as the canonical operator workflow for post-exposure credential replacement, validation, and revocation,
  - published the ShortPulse-specific post-cutover rotation packet for the Supabase and Vercel secrets exposed during the production cutover lane,
  - and linked the security checklist plus Nuclo retained operator surfaces to the new rotation authority.
- Current-branch canonical runtime convergence:
  - froze the live branch runtime contract in `docs/planning/current-branch-canonical-runtime-convergence-2026-05-07.md`,
  - removed dead rollout posture from active env, deployment, local-development, SOP, and operator guidance,
  - demoted legacy queue/shadow/webhook-toggle framing to historical-only context in the runtime ADR/planning surfaces,
  - and removed the last active `NEXT_PUBLIC_AGENT_V2` test-support residue without changing the live runtime path.
- Pulse contract cleanup:
  - aligned the live docs and reference SOPs around the shipped Pulse split: custom Pulses are saved-instruction presets, while built-in admin-owned records remain guided workflows on the `workflow_gpt` compatibility path,
  - corrected route, monitoring, data-dictionary, security, and AI Studio SOP language so user-owned Pulse persistence no longer claims hidden workflow metadata as the active contract,
  - and clarified that built-in workflow instructions are server-resolved from the admin control plane rather than authored from user Pulse surfaces.
- Runtime V2 closeout evidence:
  - added `docs/planning/evidence/runtime-v2/` as an active Program 1 evidence namespace,
  - published the Seedream shadow parity packet with current repo-backed readiness evidence and the explicit staging-shadow evidence gap,
  - recorded the first staging preflight env-inventory note for the Seedream shadow lane,
  - added a concise operator-ready handoff checklist for the live Seedream staging shadow execution,
  - and marked the shadow parity report backlog/deliverable items complete without claiming the 72-hour canary gate.
- Documentation governance:
  - corrected the `docs/routes.md` auth vocabulary so handler-authenticated GPT Image 2 routes no longer falsely claim shared runtime auth-guard coverage,
  - updated the semantic-drift checker to distinguish shared runtime-protected routes from route-level bearer-authenticated routes,
  - reclassified `ai-studio-expert-edit`, `reference-grid-modularization`, and `unified-buildout` as explicit active exceptions in the planning-evidence and records governance docs,
  - and refreshed the docs-cleanup done-state audit so it reflects the current green validation baseline and the lane's stop condition truthfully.
- Documentation cleanup:
  - moved the `generation-reliability-hardening` evidence namespace from `docs/planning/evidence/` into `docs/records/evidence/`,
  - retargeted the linked reliability planning docs to the records path,
  - and narrowed the remaining strict evidence-migration blocker set again.
- Documentation cleanup:
  - moved the `naming-canonicalization` evidence namespace from `docs/planning/evidence/` into `docs/records/evidence/`,
  - added a records README for that retained evidence family,
  - and narrowed the remaining strict evidence-migration blocker set again.
- Documentation cleanup:
  - moved the `ai-studio-reference-grid-reliability`, `lane-c`, and `media-rendering-hardening-v2` evidence namespaces from `docs/planning/evidence/` into `docs/records/evidence/`,
  - retargeted the remaining planning references to the records paths,
  - and narrowed the remaining strict evidence-migration blocker set again while leaving `unified-buildout` as the only intentional active-program exception.
- Documentation governance:
  - locked `docs/planning/evidence/unified-buildout/` as an explicit active-program exception while the unified build-out tracker still uses phase evidence as live execution gating,
  - updated the records policy, planning-evidence index, migration classification note, and done-state audit so `unified-buildout` is no longer treated as the default next records migration target.
- Documentation cleanup:
  - archived the paused Supabase production cutover handoff, the paused Reference Grid runtime simplification checkpoint, and the deferred Wave H webhook canary closeout plan/tracker out of `docs/planning/`,
  - updated active/archive indexes and continuation-plan references to point at the archived locations,
  - and narrowed the remaining done-state audit blocker set to full evidence migration plus the optional governance-doc compression judgment call.
- Documentation governance:
  - added `docs/records/docs-cleanup-done-state-audit-2026-04-27.md` as the repo-backed stop/go audit for the docs cleanup lane,
  - recorded the remaining strict blockers as full evidence migration and a smaller set of mixed-purpose resumable planning docs,
  - and made the practical stop posture explicit so follow-on work requires a better reason than adjacency cleanup.
- Documentation cleanup:
  - archived the completed pricing-audit, pricing-recalibration, foundational-hardening-v2, and expert-workflow CSS-reorg planning packets out of the active planning surface,
  - normalized the remaining top-level missing-status planning docs onto canonical `active` or `draft` statuses where they still serve as live or resumable planning context,
  - and reduced the top-level planning metadata debt without reopening broad historical migration work.
- Documentation cleanup:
  - archived the partially superseded `generation-settlement-control-plane-hardening-execution-plan-2026-03-23.md` out of active planning,
  - normalized the remaining live governance docs onto canonical `active`/`draft` statuses,
  - and removed the contradictory active-planning index entries for the superseded settlement hardening plan.
- Documentation sync:
  - added `docs/api/api-elevenlabs-audio-models.md` as the canonical API reference for the shared ElevenLabs audio model ids,
  - mapped `gpt-image-2` and the five ElevenLabs runtime ids into the model-catalog parity checker,
  - and restored model-catalog docs coverage for the OpenAI image and ElevenLabs audio lanes.
- Documentation cleanup:
  - migrated the retained `lane-b` evidence namespace into `docs/records/evidence/lane-b/`,
  - retargeted the archived Lane B closeout references plus the active foundation tracker to the records path,
  - and removed that namespace from the active planning-evidence index.
- Documentation cleanup:
  - migrated the retained `generation-pipeline-hardening` evidence namespace into `docs/records/evidence/generation-pipeline-hardening/`,
  - retargeted the archived P1 execution references plus the active foundation tracker to the records path,
  - and removed that namespace from the active planning-evidence index.
- Documentation cleanup:
  - migrated the retained `lane-e` evidence namespace into `docs/records/evidence/lane-e/`,
  - retargeted the surviving foundation tracker and archived Lane E plan references to the records path,
  - and removed that namespace from the active planning-evidence index.
- Documentation cleanup:
  - migrated the retained `lane-d` evidence namespace into `docs/records/evidence/lane-d/`,
  - retargeted the surviving foundation tracker references to the records path,
  - and removed that namespace from the active planning-evidence index.
- Documentation cleanup:
  - migrated the retained `sql` evidence namespace into `docs/records/evidence/sql/`,
  - retargeted the surviving STG-02 planning references to the records path,
  - and removed that namespace from the active planning-evidence index.
- Documentation sync:
  - added `/api/openai/image-generate` to `docs/api/api-internal-routes.md`,
  - documented its route-level bearer auth posture and canonical GPT Image 2 generation/persistence contract,
  - and cleared the semantic-drift docs mismatch for the newly added internal OpenAI image route.
- Documentation cleanup:
  - migrated the retained `architecture` evidence namespace into `docs/records/evidence/architecture/`,
  - retargeted the surviving modularization planning references to the records path,
  - and removed that namespace from the active planning-evidence index.
- Documentation cleanup:
  - migrated the retained `style-adherence` evidence namespace into `docs/records/evidence/style-adherence/`,
  - retargeted the style-creator SOP to the records path,
  - and removed that namespace from the active planning-evidence index.
- Documentation cleanup:
  - migrated the retained `docs` governance-evidence namespace into `docs/records/evidence/docs/`,
  - retargeted the surviving planning, SOP, and records references to the records path,
  - and removed that namespace from the active planning-evidence index.
- Documentation cleanup:
  - executed the second retained-records split-namespace migration by moving the `agent-pipeline-remediation` evidence family into `docs/records/evidence/agent-pipeline-remediation/`,
  - introduced `docs/records/artifacts/agent-pipeline-remediation/` for the remediation program's retained raw payloads and generated outputs,
  - and retargeted the surviving planning, SOP, evidence, and artifact references to the new records paths.
- Documentation cleanup:
  - executed the first retained-records split-namespace migration by moving the `agent` evidence packet family into `docs/records/evidence/agent/`,
  - introduced `docs/records/artifacts/README.md` plus `docs/records/artifacts/agent/` for the retained raw rollout-template payload,
  - and retargeted the surviving planning and evidence references to the new records paths.
- Documentation cleanup:
  - migrated the completed `kei` evidence packet family into `docs/records/evidence/kei/`,
  - retargeted the STG-04 planning and validation references to the retained-records paths,
  - and extended the evidence-migration follow-up so later namespace moves can treat completed stage packets as first-class records.
- Documentation cleanup:
  - executed the next markdown-only records migration by moving the closed `lane-f` evidence family into `docs/records/evidence/lane-f/`,
  - updated the foundation tracker and evidence indexes to point at the retained-records paths,
  - and extended the migration-classification follow-up so the next records move can continue from another proven closed markdown-only namespace.
- Documentation cleanup:
  - executed the second markdown-only records migration pilot by moving the closed `lane-a` evidence family into `docs/records/evidence/lane-a/`,
  - updated the foundation tracker and evidence indexes to point at the retained-records paths,
  - and marked the migration classification follow-up so the next namespace move can build on the proven markdown-only pattern.
- Documentation cleanup:
  - executed the first records migration pilot by moving the closed `media-library-runtime-rebuild` evidence family into `docs/records/evidence/media-library-runtime-rebuild/`,
  - updated the planning-evidence index to remove that namespace from the active physical list,
  - and added a records-evidence index so migrated namespaces have a stable retained-records entrypoint.
- Documentation cleanup:
  - added a no-move evidence migration classification under `docs/records/`,
  - bucketed the current planning-evidence namespaces into summary/index, future records/evidence, and future records/artifacts,
  - and selected the closed `media-library-runtime-rebuild` evidence family as the recommended first physical migration pilot.
- Documentation cleanup:
  - introduced `docs/records/README.md` as the retained-records policy entrypoint and target namespace contract for future evidence migration,
  - updated docs governance to distinguish current truth from retained records,
  - and trimmed the top-level docs/planning indexes so evidence discoverability now routes through records and namespace indexes instead of raw packet inventories.
- Documentation cleanup:
  - archived the completed properties-panels modularization program and tracker under `docs/archive/planning/`,
  - removed that closed packet from the active planning indexes,
  - and retargeted the surviving ADR reference to the archive path.
- Documentation cleanup:
  - archived the implementation-complete Runtime V2 audit snapshot under `docs/archive/planning/`,
  - retargeted the surviving SOP, backlog, and index references to the archive path,
  - and normalized the still-live runtime/admission planning docs onto the canonical `active` status vocabulary.
- Documentation cleanup:
  - normalized the active Reference Grid modularization packet onto the canonical status vocabulary,
  - lowercasing the program status to `active`,
  - and adding the missing `Status: active` header to the tracker because the packet still carries open governance dependencies and remains in active planning.
- Documentation cleanup:
  - normalized the media-planning packet onto the canonical status vocabulary,
  - marking the media optimization proposal/spec docs and the Media Library redesign lane as `draft`,
  - so those retained planning docs no longer depend on legacy `Proposed` or `Ready to implement` labels.
- Documentation cleanup:
  - normalized the active naming-canonicalization planning packet onto the canonical status vocabulary,
  - lowercasing the live program/map/Phase 7 statuses to `active`,
  - and adding the missing `Status: active` headers to the naming tracker and immutable decision log.
- Documentation cleanup:
  - normalized the paused reference-only session-persistence plan and tracker onto the canonical status vocabulary,
  - marking both docs as `draft` because the packet is documentation-only and intentionally paused pending a future re-enable lane.
- Documentation cleanup:
  - normalized the remaining active coordinate-parity roadmap, tracker, and unfinished phase docs onto the canonical status vocabulary,
  - marking the roadmap/tracker plus active rollout phase as `active`,
  - and marking the pending Phase 1 and Phase 2 execution plans as `draft`.
- Documentation cleanup:
  - corrected the `/dashboard` route contract across `README.md`, `docs/routes.md`, `docs/security-checklist.md`, and `docs/agent-playbook.md` so it matches the live public-home runtime instead of claiming auth-required protection.
- Documentation cleanup:
  - archived the completed coordinate-parity Phase 0, Phase 3, and Phase 4 execution plans under `docs/archive/planning/`,
  - kept the mixed-state master/tracker plus unfinished Phase 1, Phase 2, and Phase 5 docs active in `docs/planning/`,
  - and retargeted the surviving roadmap, tracker, and Phase 5 references to the archive paths.
- Documentation cleanup:
  - archived the completed AI Studio generation-queue hardening plan/tracker packet and the completed Expert Edit properties-panel rollout plan/tracker packet under `docs/archive/planning/`,
  - removed those completed execution-history docs from the active planning indexes,
  - and retargeted the surviving fresh-start properties-panel plan to the archive paths.
- Documentation cleanup:
  - archived six checkpoint-complete `generation-pipeline-rebuild` execution plans under `docs/archive/planning/`,
  - removed those execution-history docs from the active planning indexes while keeping the surviving contract docs active in `docs/planning/`,
  - and retargeted the surviving ADR and archive-internal references to the archive paths.
- Documentation cleanup:
  - archived the checkpoint-complete generation-pipeline rebuild master roadmap and Lane 1 request/attempt plan under `docs/archive/planning/`,
  - removed those checkpoint docs from the active planning indexes,
  - and retargeted the surviving continuation and revisit references to the archive paths.
- Documentation cleanup:
  - archived the completed generation-pipeline rebuild Phase 1 and Phase 2 docs under `docs/archive/planning/`,
  - removed those completed checkpoint docs from the active planning indexes,
  - and retargeted the surviving ADR and planning references to the archive paths.
- Documentation cleanup:
  - normalized the full `generation-pipeline-rebuild-*` planning family onto the canonical status vocabulary,
  - kept the packet active in place and preserved checkpoint-complete semantics in the body text rather than reclassifying the family mid-slice,
  - and deferred any archive split for those checkpoint docs to a separate active-vs-historical pass.
- Documentation cleanup:
  - normalized the full `media-rendering-hardening-v2-*` planning family onto the canonical status vocabulary,
  - mapped the accepted pre-implementation stop/go checklist onto `active` because it still governs the live planning path,
  - and kept the entire packet active without changing scope or rollout intent.
- Documentation cleanup:
  - normalized the full `ai-studio-reference-grid-reliability-*` planning family onto the canonical status vocabulary,
  - marked the gated `P0` through `P4` execution plans as `draft` while keeping the program/control docs `active`,
  - and added the missing status header on the family evidence-packet template.
- Documentation cleanup:
  - normalized the entire `generation-reliability-hardening-*` planning family onto the canonical status vocabulary,
  - added the missing status header on the family evidence-packet template,
  - and kept the packet active without changing its planning scope or rollout meaning.
- Documentation cleanup:
  - archived the completed governance-baseline packet (`_inventory`, `overlap-audit`, and `feasibility-report`) under `docs/archive/planning/`,
  - removed those completed baseline docs from the active planning indexes,
  - and retargeted the remaining active governance docs and stage docs to the archive paths.
- Documentation cleanup:
  - normalized the older planning governance/control entrypoint docs onto the canonical status vocabulary,
  - marked the completed baseline artifacts explicitly as `complete`,
  - and marked the still-live governance surfaces as `active` with the unfinished final signoff summary as `draft`.
- Documentation cleanup:
  - kept the master-stage rebuild spec active in `docs/planning/` as the canonical stage authority,
  - archived the completed master-stage tracker and phase packet under `docs/archive/planning/`,
  - and retargeted ADR/spec/index references so the active-vs-historical split is explicit.
- Documentation cleanup:
  - archived the completed Media Library runtime rebuild packet under `docs/archive/planning/`,
  - removed those closeout docs from the active planning indexes,
  - and retargeted the surviving evidence/history references to the new archive paths.
- Documentation cleanup:
  - archived the closed staging-preview consolidation packet under `docs/archive/planning/`,
  - removed those completed branch-integration docs from the active planning indexes,
  - and kept the archive navigation aligned with the new historical locations.
- Documentation cleanup:
  - archived the completed generation fundamental hardening planning family under `docs/archive/planning/`,
  - removed that closed packet from the active planning indexes,
  - and kept the archived family internally linkable by retargeting its self-references to the archive paths.
- Documentation cleanup:
  - archived the completed Pulse runtime planning family under `docs/archive/planning/`,
  - removed that closed packet from the active planning indexes,
  - and retargeted the surviving ADR/archive references to the new historical paths.
- Documentation cleanup:
  - normalized the April 2026 active-planning families onto the canonical status vocabulary (`draft`, `active`, `complete`),
  - marked completed April planning families explicitly as `complete` so later archive work is visible in metadata instead of hidden behind custom status phrases,
  - and filled the missing status headers on the current staging-preview and Pulse decision-log planning docs.
- Documentation cleanup:
  - archived the completed Elements decoupling packet plus the compact right-rail scope/tracker/readiness packet,
  - moved those closeout docs out of `docs/planning/` into `docs/archive/planning/`,
  - and refreshed archive indexes/descriptions so the archive surface matches the current repo state.
- Documentation cleanup:
  - locked the docs-governance cleanup contract so `docs/planning/` is treated as active-working space and archived planning docs no longer belong in active indexes,
  - archived the first wave of self-declared historical planning docs for Elements, Projects, and right-rail execution history,
  - removed obvious junk artifacts from canonical docs space,
  - and updated the archive/index surfaces plus active cross-links to match the new locations.
- Documentation cleanup:
  - removed dead `/api/ai/generate-prompt` and `/api/ai/describe-image` claims from active authority docs,
  - aligned the AI Studio Media Library root-tab contract with the shipped `All Media` / `Images` / `Videos` / `Prompts` surface,
  - archived dormant or temporary planning artifacts that no longer belong in `docs/planning/`,
  - and trimmed active indexes/backlog entries that were still surfacing archived-pointer or historical planning docs.
- Normalized legacy Pulse metadata to the guided runtime contract:
  - active runtime boundaries now upgrade legacy `prompt_editor`, `activate_only`, and `apply_prompt` Pulse metadata to `workflow_gpt`, `activate_and_start`, and `chat_reply`,
  - malformed or partial saved Pulse records now fall back to guided GPT-style defaults instead of prompt-editor defaults,
  - authoritative Pulse docs now describe legacy metadata as compatibility input only rather than an active product mode.
- `workflow_gpt` Pulse sessions now get explicit runtime-owned transition updates during active use:
  - starting a workflow Pulse seeds an immediate pending session snapshot before the first assistant reply returns,
  - sending a user reply through an active workflow Pulse now marks the session as `running` and appends the collected input before the next server step arrives,
  - runtime/session updates now prefer named workflow stage labels such as `Plot Seed` and `Runtime` whenever the Pulse definition provides stage hints,
  - reducing reliance on transcript-only inference for in-flight workflow progression.
- Completed workflow Pulse sessions now expose durable banner actions:
  - finished workflow banners can apply the persisted `lastArtifact` back into the Create prompt flow,
  - and they can restart the active workflow Pulse through the canonical clear-chat + pulse-start path instead of a separate reset implementation.
- Clearing AI Studio agent chat now also clears the authoritative `pulseWorkflowSession` state so workflow banners, session persistence, and restart behavior stay aligned.
- Promoted the built-in `story_builder` Pulse from a prompt-editor stub to a real `workflow_gpt` starter:
  - it now runs as `activate_and_start`,
  - it uses the guided Story Circle scene-prompt workflow contract,
  - and it carries built-in stage labels for `Upload Characters`, `Plot Seed`, `Runtime`, `Scene Review`, `Image Prompts`, and `Dialogue Story`.
- Added optional persisted workflow stage labels to Pulse definitions:
  - `workflow_gpt` Pulses can now save `Workflow Stage Labels` from both Pulse editors,
  - the Create workflow session banner falls back to those labels when assistant replies do not use explicit `Step N` formatting.
- Added a second built-in Create Pulse workflow starter:
  - the stable `multi_shot` Pulse id now resolves to the built-in `Multi Sequence Video Prompt` preset,
  - it runs as `workflow_gpt` with `activate_and_start`,
  - clicking it in Expert Create `Pulse` mode immediately kicks off the guided multi-shot storyboard workflow.
- Added workflow starter templates to Pulse authoring:
  - both the Pulse Presets Library and Create `More Presets` editor now expose `Blank Workflow GPT`, `Single-shot Video Workflow`, and `Multi Sequence Video Workflow` template actions,
  - applying a template preloads runtime mode, activation mode, system instructions, starter assistant message, and starter description guidance for user-created workflow Pulses.
- Tightened workflow Pulse authoring UX:
  - `workflow_gpt` Pulses now switch the editor labels to `Workflow Instructions` and `Exact First Assistant Message`,
  - workflow editor surfaces now show a visible checklist reminding authors to define first message, one-step-at-a-time flow, and final output shape explicitly.
- Seeded the first built-in Create Pulse as a real workflow starter:
  - the stable `image` Pulse id now resolves to the built-in `Video Prompt Magic` preset,
  - it runs as `workflow_gpt` with `activate_and_start`,
  - clicking it in Expert Create `Pulse` mode immediately kicks off the guided single-shot video workflow.
- Pulse presets now support first-class runtime behavior instead of a prompt string only:
  - saved Pulse definitions persist `systemInstructions`, `runtimeMode`, `activationMode`, optional `starterAssistantMessage`, `outputMode`, and `memoryPolicy`,
  - the Pulse Presets Library and Create `More Presets` editor both author those fields,
  - built-in starter Pulses and custom Pulses now resolve to the guided GPT-style Pulse contract at runtime.
- Expert Create Pulse activation now supports custom-GPT-style workflow starts:
  - clicking a pinned `workflow_gpt` Pulse with `activate_and_start` immediately sends a hidden activation seed through `/api/ai/studio-agent`,
  - workflow Pulse turns are now allowed to return message-only assistant steps before a final prompt artifact,
  - legacy `applyPrompt`-style Pulse metadata is treated as compatibility input rather than the active Pulse contract.
- Pulse Presets Library built-in starter tiles are no longer the editing authority. Built-in Pulse authoring now lives under `/admin/agent-instructions`, while user Pulse surfaces are limited to custom Pulse editing.
- Built-in Pulse definitions now persist in the shared `create_pulse_builtin_runtime` control plane and flow through `/api/ai/create-pulse-builtins` plus `/api/ai/studio-agent-pulse`, so admin-updated defaults show up consistently in the library, `More Presets`, the pinned Create Pulse rail, and runtime execution.
- Per-user deleted built-in Prompt Preset and Pulse IDs now have dedicated `user_preferences` columns, preserving admin-owned built-in control planes while making account-level restore possible without touching custom records.
- Persisted AI Studio Create Pulse runtime shell state in session snapshots:
  - page-owned Expert Create mode and active pinned Pulse preset id now flow through session snapshot build/hydrate,
  - restoring a saved AI Studio session returns Create to the prior `Standard` or `Pulse` shell mode and reapplies the active pinned Pulse id,
  - clicking a pinned Pulse preset now marks that preset as the active Pulse runtime selection and routes hidden Pulse instructions into `/api/ai/studio-agent` without mutating the visible Create composer.
- Unified AI Studio Pulse preset persistence on `user_preferences`:
  - added `ai_studio_create_pulse_panel_ids` and `ai_studio_saved_pulses` schema/docs contracts,
  - replaced the local-only Pulse library with a shared custom Pulse editor backed by the same saved catalog used in Create `Pulse` mode,
  - migrated Create Pulse local custom-slot fallback into saved Pulse records and added focused hook/component coverage for the new shared contract.
- Published a dedicated AI Studio inpaint-reference contract planning set:
  - master plan, tracker, and five phase plans for locking the inpaint token/payload contract,
  - explicit phase coverage for provider-lane decisions, prompt-link vs payload alignment, mask invariants, effective-model UI authority, and validation/doc closeout,
  - indexed the new planning artifacts in `docs/README.md` and `docs/planning/README.md`.
- Captured staging queue-latency validation outcome for the generation queue/recovery lane:
  - removed queue-resume defer and added wake/telemetry/diagnostic coverage landed in the repo,
  - live staging replay showed queued work advancing only when per-user capacity opened, not being diverted into recovery,
  - active admission telemetry during the run pointed to `per_user global_limit` on `fal-ai/flux-2/klein/9b`,
  - historical exhausted queue residue remains in staging, but the live blocker observed during validation was concurrency pressure rather than a stuck recovery path.
- Added Vercel env-governance tooling and docs:
  - new shared env contract module (`scripts/lib/vercel_env_contract.mjs`),
  - new live Vercel parity audit (`scripts/check_vercel_env_contract.mjs`),
  - extended staged env export validation (`scripts/check_vercel_env_file.mjs`) with environment-aware contract checks,
  - clarified `frontend/.env.local` vs `.env.agent.local` responsibilities in local/deployment/release docs,
  - aligned the default live audit posture with the current preview-only staging deployment model,
  - added missing runtime flag `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED` to `frontend/.env.example`.
- Promoted AI Studio Reference Grid reliability state to `implementation_ready` after closing `RGR-B02` via time-bounded waiver metadata for `KI-AI-RG-STYLES-001`; recorded `P0-S1` kickoff evidence and moved `RGR-M02`..`RGR-M04` to `In Progress`.
- Added AI Studio Reference Grid reliability P0 entry baseline evidence packet (`2026-03-21-p0-entry-baseline-packet.md`) and closed blocker/gate tracking for `RGR-B01` / `RGR-G03`; implementation entry remains blocked on `RGR-B02`.
- Removed an AI Studio reliability implementation-entry deadlock by reclassifying `RGR-M02`..`RGR-M04` as P0 exit gates (not entry prerequisites), added explicit blocker/gate status tracking (`RGR-B01`/`RGR-B02`, `RGR-G01`..`RGR-G05`), and tightened kickoff SLA + adaptive gate requirements across readiness/tracker/checklist/full-recovery governance docs.
- Backfilled documentation index parity for AI Studio Reference Grid reliability governance artifacts:
  - added ADR `0046` and `0047` references to `docs/README.md`,
  - added `RGR-M01` seed evidence packet links to `docs/README.md` and `docs/planning/README.md`,
  - expanded `docs/documentation_overview.md` taxonomy/update-trigger coverage for planning evidence namespaces and readiness-governance updates.
- Defined the AI Studio Reference Grid reliability `implementation_ready` readiness state contract (with immediate implementation-start trigger) and aligned readiness/tracker/entry-checklist/full-recovery docs to that policy.
- Indexed additional governance docs in primary indexes:
  - `docs/agents/change-impact-auditor.md` in `docs/README.md`,
  - `docs/planning/policies/README.md` in both `docs/README.md` and `docs/planning/README.md`,
  - updated `docs/documentation_overview.md` taxonomy/improvement notes for `docs/agents/` and planning policy artifacts.
- Published `P4` execution planning for AI Studio Reference Grid reliability (`docs/planning/ai-studio-reference-grid-reliability-phase-p4-execution-plan-2026-03-21.md`) and linked it across master plan/roadmap/tracker/readiness/full-recovery docs.
- Published `P3` execution planning for AI Studio Reference Grid reliability (`docs/planning/ai-studio-reference-grid-reliability-phase-p3-execution-plan-2026-03-21.md`) and linked it across master plan/roadmap/tracker/readiness/full-recovery docs.
- Published `P2` execution planning for AI Studio Reference Grid reliability (`docs/planning/ai-studio-reference-grid-reliability-phase-p2-execution-plan-2026-03-21.md`) and linked it across master plan/roadmap/tracker/readiness/full-recovery docs.
- Published `P1` execution planning for AI Studio Reference Grid reliability (`docs/planning/ai-studio-reference-grid-reliability-phase-p1-execution-plan-2026-03-21.md`) and linked it across master plan/roadmap/tracker/readiness/full-recovery docs.
- Published `P0` execution planning for AI Studio Reference Grid reliability (`docs/planning/ai-studio-reference-grid-reliability-phase-p0-execution-plan-2026-03-21.md`) and linked it across master plan/roadmap/tracker/readiness/full-recovery docs.
- Added first reliability evidence packet for tracker row `RGR-M01` (`docs/records/evidence/ai-studio-reference-grid-reliability/2026-03-21-rgr-m01-top-priority-defect-inventory.md`) and wired tracker/evidence index references.
- Added a new AI Studio Reference Grid reliability planning-governance doc suite:
  - master plan/roadmap/tracker/tracker-spec,
  - decision log, risk register, readiness-state record, implementation-entry checklist, and evidence packet template,
  - new evidence namespace (`docs/records/evidence/ai-studio-reference-grid-reliability/`) and two proposed ADRs (`0046`, `0047`) for output-visibility authority and recovery-threshold policy.
- Refreshed planning/documentation indexes to include the new reliability governance artifacts and linked them from `docs/planning/ai-studio-full-recovery-program.md`.
- Normalized changelog governance for Lane E:
  - added an explicit `Unreleased` section as the active entry point,
  - split pre-normalization notes behind a legacy marker so chronology/future-date checks can enforce the active timeline without rewriting imported history,
  - activated machine-checkable changelog chronology governance through `scripts/check_docs_semantic_drift.js`.
- Governance cleanup slice (instruction/skill parity):
  - aligned startup command wording across root instructions (`npm run dev` as default; `npm install` as one-time setup),
  - aligned modularization size guidance with core conventions (~500 target with explicit temporary exception policy),
  - restored skill discoverability parity in docs indexes/playbook (`skill-media-storage-deploy-gate`, `palette-normalizer`),
  - enforced Supabase reset policy via guarded `db:reset` script contract in `frontend/package.json`.

## Legacy Imported Entries (pre-2026-03-17 normalization)

## 2025-12-11

- Read all project MD docs (color system, naming log, performance index) to align scope and palette.
- Initialized backend FastAPI service with models, ingestion pipeline (Apify), percentile scoring, and scheduler.
- Added Alembic migration and SQL script for Supabase tables (`reels_raw_events`, `reels_latest_state`).
- Built Next.js frontend with dark palette, scatter visualization (Recharts), highlighting top performers.
- Added setup instructions, env sample with Supabase host, and repo ignores.
- Added API reference, deployment guide, and run visibility docs; added `/ingest/status` endpoint, basic percentile test, and pytest dependency.

## 2025-12-11 (later)

- Pulled `origin/main`, resolved merge artifacts, and cleaned tracked build outputs (`frontend/.next`, `node_modules`, Python `__pycache__`, `.DS_Store`).
- Created project-root `.env` (Supabase connection, Apify token + actor), ensured backend loads env correctly, and standardized on Python 3.11 venv for compatibility.
- Verified backend boots (`uvicorn backend.app.main:app --reload`) and `/health` responds `ok`; confirmed frontend boots via `npm run dev`.
- Updated branding from ShortFlow to ShortPulse across frontend (title, meta, badge), backend app title, docs, schema comments, and package docstring; recorded env + naming changes.

## 2026-02-05

- Rebuilt the frontend into a simplified dashboard hub with three cards (Performance Analytics, Creator Studio placeholder, Media Library placeholder) and quick stats on time ranges/signals/security.
- Added dedicated Performance Analytics page with 7d/30d/90d windows, refresh + sample dataset, preview grid (dummy thumbnails), outlier list, and enhanced scatter empty-state handling.
- Added Creator Studio and Media Library placeholder pages with secure/user-isolation messaging for future wiring to Supabase auth/storage.
- Extended README and documentation overview to reflect new routes and surfaces; added empty-state messaging in scatter.

## 2026-12-12

- Redesigned landing page for conversion (hero clean-up, pricing section matching reference, three-step timeline, feature tiles, refreshed testimonials).
- Removed unused hero snapshot panel, simplified typography to system stack, and reduced rounded-card clutter; pricing cards now float on dark background with teal checks.
- Standardized dark palette (panels at #1c1f20, removed brown/amber gradients), updated docs to note palette rule.
- Updated FAQ, CTA, and button styles; adjusted spacing/radii across landing to improve breathing room.
- Removed the tracked 100MB Next SWC binary from history, force-pushed `main`, and synced `sandbox/playground`; kept `.env.local` untracked.
- Re-ran pricing and steps sections to match reference visuals; thinned typography and set font stack to system UI.

## 2026-12-13

- Created architecture/conventions docs (`frontend-architecture`, `styles-structure`, `backend-architecture`, `conventions`, `sop_new_feature_modularization`) plus testing, contributor, data dictionary, and security checklist; updated documentation overview.
- Refactored auth page to match the reference UI (icons, teal CTA, polished inputs), enabled Supabase session persistence/auto-refresh, added info messaging for sign-up confirmation, and redirect to dashboard after sign-in.
- Removed demo-credentials footer text and cleaned back navigation: media library, saved creators, and performance pages now link back to the dashboard.

## 2026-12-14

- Iterated dashboard UX: reordered tool cards, refreshed card imagery, tuned hover/spacing, added "Searches" status chip, enforced plan-color rules (Free white, Media green, Studio teal, Business amber).
- Added logout confirmation modal to the dashboard profile menu; signing out returns to landing.

## 2027-01-01

- Rebuilt AI Studio canvas: fixed left rail with logo/back link, simplified header bar, and unified panel styling (`rgba(201,205,214,0.08)` card treatment).
- Expanded Create tool panel with Enhance/Image/Video actions, fixed dropdown rows for aspect/model, and added Media library quick actions plus aligned icons and themed selects.
- Rebalanced layout spacing (padding, gutters, equal-height panels) and documented the refreshed toolbar workflow in the AI Studio docs.
- Refined welcome hero: overlapping art with centered Quick Start card; ensured button cards have controllable image sizing.
- Created Profile page with left-nav (profile/account/billing), plan badge, and logout modal; added shared styles for profile layout and modals.
- Applied full-bleed hero art backgrounds to Performance, Media Library, and Saved Creators top cards using the latest PNGs.

## 2026-12-31

- Performance Analytics: rewrote the Top videos cards so the hero score, views, and outlier metrics are more prominent with centered widgets, teal-only rank badges, and grid-aligned platform/niche rows whose pills now shrink to their text.
- Added the floating “Sort” dropdown in the list header so the feed can be reordered by score, views, outlier, velocity, or engagement while keeping the refresh CTA spaced apart; results count now lives beside the primary search bar.
- Introduced a Clear button on the numeric filters row plus teal-framed pill styling updates, and boosted spacing around the sorting control plus the hero helper copy, background, and card border finishes to match the rest of the app.
- Documentation: refreshed the hero helper copy in `performance/constants.ts` to describe the on-page scoring and filtering workflow.

## 2026-12-14 (later)

- Polished hover affordances: header stat cards now show a pointer cursor with teal-outline lift on hover; avatar/profile card mirrors the same motion.
- Restored Quick Start card interactivity while keeping hero art non-interactive; card now shows pointer cursor and retains lift/outline hover effect.
- Kept existing hero image sizing/position intact while adjusting hover states; no visual regression to artwork placement.

## 2026-12-14 (saved-creators polish + TikTok link debugging)

- Saved Creators hero now uses the updated Gray.png at full opacity (removed dark overlays) and spacing harmonized across back link, hero, intake, and list (24px rhythm). Dashboard Saved Creators tool card also points to the refreshed Gray.png.
- Intake/input UX: custom platform dropdown, dark handle input with subdued autofill, thinner text; alignment/spacing adjustments across cards/tables; uniform gaps between stacked panels.
- Saved list table: converted to spreadsheet layout with row-level borders (no bleed under actions), circular avatar badges with teal outline/dark fill/muted teal outline icon, and profile/remove actions right-aligned.
- Header chips: plan card icon changed to circular check; searches and plan chips share hover lift/outline/pointer behavior.
- TikTok profile links hardened: sanitized handles (strip zero-width/nbsp/whitespace, drop leading @, URL-encode), platform normalization, `?lang=en`, `referrerPolicy=no-referrer`; noted persistent failure in ChatGPT Atlas despite working in Chrome. Added known-issues entry for Atlas TikTok link failure.
- Documentation: added `docs/sops/sop_saved_creators.md` describing data flow, layout, link building, avatar rules, spacing, and known TikTok issue; added `docs/known-issues.md` entry for TikTok-in-Atlas error with mitigation attempts listed.
- Assets: updated `frontend/public/Gray.png` from master root and wired it to both Saved Creators hero and dashboard Saved Creators card.

## 2026-12-14 (media library refresh)

- Mirrored Saved Creators hero onto Media Library with new title/lede, plan chip, and a Media Storage header card (using dashboard hover affordance) plus swapped hero art to `media-library-hero.png` copied from the root reference.
- Unified Media Library background to saved-creators dark theme; flattened upload hero and media panels to saved-creator card styling via `media-panel` class and body override.
- Aligned panel spacing (18px rhythm), adjusted upload card padding/gaps, and recolored panel backgrounds to the shared ash-08 tone.
- Refined upgrade (“Need more storage?”) button: brand amber text, warmer/darker glow, hover lift with controlled brightness.
- Added `legacy standalone Media Library UI SOP` covering header composition, media panel styling, upload spacing, upgrade hover rules, and asset locations.

## 2026-12-29

- Removed the backend entirely (FastAPI, Alembic, API docs) and rewrote the repo to be frontend-only with Supabase client usage; updated README, env sample, schemas, security/testing/contributor docs, and documentation overview accordingly.
- Renamed `progress_log.md` to `change_log.md` and updated all references.
- Added user-triggered data actions on the Performance page (refresh/rescore/reset), rebuilt demo scoring logic client-side, and retitled the hero to “Performance Analytics.”
- Reworked dashboard hero visuals: separated cards from art, adjusted image size/position, matched dashboard background to saved creators, tweaked quick-start card hovers, outlines, and plan colors; added workflow lessons card alongside onboarding.
- Updated workflow/onboarding card hover lift and outline styling (amber outline, no glow) for consistency with other tiles.
- Swapped the dashboard header text mark for the new brand logo asset and sized it to fit the app bar.

## 2026-12-29 (later)

- Iterated dashboard hero art positioning (drip image sizing and right-shift) while keeping cards above it; aligned image center with welcome card center.
- Replaced the header logo with the provided `ShortPulse Logo.png`, scaled it up, and repositioned it right within the app bar without resizing the bar.
- Refined quick-start card hover motion to match other tiles and kept the workflow card amber outline thin.
- Set dashboard body background to match Saved Creators; kept performance hero title simplified to “Performance Analytics.”

## 2026-12-29 (performance & dashboard polish)

- Performance page: kept the hero stats row (searches + plan) and relocated the “Refresh videos” CTA into the Top videos card header with right alignment; added live refresh timestamp and action pill support.
- Styling polish: unified filter button outlines for date/platform pills, bumped refresh CTA padding for a larger hit area, and increased spacing above the Top videos grid for better breathing room.
- Dashboard header: reordered stat cards to Media Storage → Searches → AI credits → Plan, with profile remaining last.

## 2026-12-31 (AI Studio rebuild)

- Rebuilt `/ai-studio` into a Photoshop-style workspace: left tool rail, center preview + recent rail, right properties panel; header uses mirrored AI Studio art with inline AI credits (sparkle icon) and Plan (shield icon) cards on a single row and back-to-dashboard above.
- Hero copy simplified to “AI Studio”; removed amber hero overlay in favor of full-image treatment; stat cards now opaque to avoid bleed-through.
- Preview panel gradient switched to a dark charcoal blend (no amber glow); toolbar hover glows removed for calmer idle state.
- Documentation: updated `docs/product/shortpulse_ai_studio.md` with the current UI snapshot and layout description.

## 2027-01-02 (AI Studio create flow & preview polish)

- Refined Create step cards: increased padding/gaps, added numbered “Select mode / Frame & model / Write your prompt” flow with conditional steps (Enhance hides frame/model), dynamic Generate icon per mode, and left-aligned toolbar icon centering.
- Added Reference Canvas/Studio Preview layout tweaks: reference card header now empty by default, and Studio Preview hosts two compact drop zones (file + text) with subdued icon/text, top-left aligned and resizable; drop zones restyled/darkened and resized for better balance.
- Adjusted panel grid widths (wider Reference column, narrower Studio Preview) and multiple drop-zone size reductions; introduced transparent reference-drop surface to remove extra containers.
- Renamed toolbar “Image-to-Image” tool to “AI reGen” and swapped its icon to the swap-style `ArrowFatLinesRight` for clearer regen semantics.

## 2027-01-02 (later, AI Studio drag/drop & cards)

- Reference Canvas now supports draggable previews: generated image cards carry a background image; prompt-mode cards carry text. Both can be dragged into Studio Preview drop zones (images into Image Reference, text into Prompt).
- Studio Preview drop zones hide outlines/content when populated; Image Reference shows the dropped image and Prompt shows dropped text. Added cover/background sizing for image drops.
- Reference Canvas panel made transparent, with its grid in a scrollable container; five-column card grid, zero gaps. Recent grid tightened to 8-wide with smaller gaps.
- Prompt textarea scrollbar restyled to a thin, minimal thumb. Added dummy preview placeholders for generated items to simulate media.

## 2027-01-03 (AI Studio recreate flow + drop targets)

- Replaced the Image Regen edit panel with a two-step Recreate card (Drop Image, Drop prompt) mirroring the Create steps, including numbered badges, carded drop zones, and persistent Save/Regenerate actions.
- Added auto-seeding rules: first generated image/prompt populate the Studio Preview drop zones when empty; Save Prompt captures the current prompt as a text card; external image files can be drag-dropped directly into the Reference Canvas grid and seed previews.
- Added a compact square preview above the drop zones, refined Recreate card spacing, and realigned buttons inside the card; removed the Recreate card from the Studio Preview column to reduce clutter.

## 2027-01-04 (AI Studio create/recreate polish)

- Added subtitles and spacing refinements to the Create and Recreate tool headers; tightened header/subtitle gaps for consistency.

## 2026-03-02 (Phase 13 Wave F Pass 4)

- Added structured safety telemetry fields across `studio-agent` and `describe-image` runtime paths: `policy_version`, `profile_id`, `modality`, `category`, `decision_action`, `decision_source`, `provider_blocked`, `hard_floor_violation`, `rollback_triggered`.
- Added production-gated hard-floor incident auto-rollback seam (`incidentAutoRollback`) driven by `STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED` and bounded cooldown (`STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS`).
- Wired hard-floor auto-rollback trigger path into AI Studio agent and describe-image runtime safety post-process flows with focused regression tests.

## 2026-02-05

- Added MVP stabilization plan and aligned docs to current MVP scope (post‑MVP notes, route map, release checklist, testing guidance, and palette rule placement).
- Expanded doc index coverage and cleaned stale SOP references; clarified file-size guidance as advisory.

## 2026-02-05 (later)

- Phase 1 pricing work: credits now debit for image tool runs and prompt refine/describe flows; video duration/resolution/audio controls are wired into pricing and submissions; model media type supports image-to-video.
- Added Change Impact Auditor agent doc and two maintenance skills (pricing audit + doc index).
- Added `docs:check` script hook and documented maintenance skill usage in the agent playbook.

## 2027-01-05 (AI Studio accent + controls polish)

- Centralized AI Studio accent theming behind a single `--ai-accent-base` variable to drive badges, toolbar icons, hover outlines, and primary/active button gradients; updated borders and hover states to inherit from the shared token.
- Refined badge and toolbar UX: step badges now have fixed square dimensions (no oval deformation on resize) and optional onboarding badges are hidden until the onboarding flow is reintroduced.
- Button polish: Generate button enlarged with inline credit count + sparkle indicator, hover lift increased, text color aligned with active tab styling, and accent gradients applied to mode toggles/primary actions.
- Control affordances: aspect ratio and model selectors now share the accent-hover outline/motion, and drop-zone/selection borders respect the unified accent variable.
- Documentation-only note: placeholder media fetch failures remain known during prototyping; no functional change yet.
- Flattened the Recreate flow: pulled action buttons into Step 3, stacked the drop zones vertically with two extra image slots, and added plus-only placeholders; resized and fine-tuned drop zone spacing and aspect ratios.
- Replaced the prompt drop surface with a typed textarea (scrollable, matching Create textarea sizing/styling) and aligned its height to the Create Step 3 input.
- Show the generated prompt under Studio Preview as a scrollable card (label removed) and styled the Studio Preview column with the same card treatment and spacing as the Create column while leaving the Reference Canvas un-carded.

## 2027-01-19 (AI Studio toolbar + model picker overhaul)

- Simplified the AI Studio toolbar to top-level Create and Pulse actions with nested Image to Image / Image to Video that reveal only when Pulse is selected; default state now hides cards until a tool is chosen.
- Restored the header container in a condensed form (half height), removed the title/helper copy and plan/credit stat cards, and flattened the header/logo borders to blend with their backgrounds.
- Enlarged primary toolbar labels, compacted edit child buttons, and made the Generate button taller with larger text.
- Replaced model dropdowns with a “Select model here” button that opens an anchored modal of nine dummy models; modal now stays aligned to the trigger, includes a left-edge pointer to the trigger, and repositions on resize/scroll.
- Centered the Reference Canvas empty state and right-aligned media actions; darkened UI text and dropzone borders per recent polish.

## 2027-01-05 (AI Studio reference details & cleanup)

- Removed the Recent panel from `/ai-studio` to give more room to the workspace and Reference Canvas.
- Added a reference detail modal: double-clicking a canvas card opens media details; prompt references use a simplified text-first layout with a scrollable prompt body, while image/video references keep the preview + metadata layout. Save-to-Media button is UI-only.
- Added a toggleable reference indicator in Create Step 2 (manual toggle; only visible in Prompt mode) and made reference cards open the new modal on double-click.
- Raised the Reference Canvas scroll height to show more rows without scrolling.

## 2027-01-09

- Added an “Image to Video” tool beside Create/Organize by reusing the existing recreate card layout so the same steps (Add Image, Choose Frame & Model, Add Prompt + Save/Regenerate actions) are available with focused copy.
- Prevented the image-to-image prompt dropzone from auto-filling with generated prompts (it now only displays what the user types or drops) and slightly reduced its height for tighter spacing.
- Swapped the Image-to-Image toolbar icon for `ImageSquare` to better match the image-focused workflow.

## 2027-01-10

- Reorganized the workspace to make `ShortPulse/` the canonical product repo, moved non-runtime artifacts into `assets/`, and archived legacy duplicates under `archive/`.
- Added layered agent instructions and context minimization (`AGENTS.md`, `ShortPulse/AGENTS.md`, scoped `AGENTS.md` files, plus `.codexignore`/`.cursorignore`/`.ignore`).
- Added a docs navigation hub and professional repo references: `docs/README.md`, `docs/repo-structure.md`, ADR system (`docs/adr/`), and new foundational docs (`docs/architecture-overview.md`, `docs/local-development.md`, `docs/release-checklist.md`, `docs/troubleshooting.md`, `docs/glossary.md`).
- Moved brainstorming and design rationale docs into `docs/brainstorming/` and `docs/design/` to keep `docs/` discoverable.
- Added collaboration scaffolding: GitHub CI workflow for frontend lint/build, PR template, issue templates, and CODEOWNERS.
- Added repo meta docs: `LICENSE` (proprietary), `ROADMAP.md`, and `CHANGELOG.md` (wrapper pointing to this log).
- Fixed frontend build issues (ESLint config + TypeScript fixes in `frontend/pages/dashboard.tsx`) and verified `npm run lint` + `npm run build` pass.
- Updated env templates to reflect the client-only architecture and restored the `sop_performance_ai_detection.md` into canonical `docs/`.

## 2026-01-17

- Pruned duplicate changelog wrappers (`CHANGELOG.md` and a legacy docs-level wrapper) to keep `docs/change_log.md` as the single source of truth.
- Updated README and docs index to point to the canonical changelog.

## 2026-01-21

- Modularized `/ai-studio`: moved state/logic into `frontend/features/ai-studio/` (types/constants, state hook, toolbar/create/regen panels, reference canvas, preview, anchored model + detail modals) and kept the page as a slim orchestrator.
- Split the monolithic `workspace-ai-studio.css` into scoped sheets (`ai-studio-layout/canvas/controls/dropzones/panels/modals/responsive.css`) and wired them through `globals.css`.
- Updated docs to reflect the new AI Studio structure and style split (`docs/frontend-architecture.md`, `docs/styles-structure.md`); linted frontend (existing Next `<img>` warnings remain in unrelated pages).

## 2027-01-22 (AI Studio toolbar + regen/footer refresh)

- Rebuilt the AI Studio toolbar into labeled sections (Generate, Shortcuts, Creations) with new shortcut/creation entries (Templates, Workflows, My Generations, Community) and added Pulse child tools (Image, Video, Enhance, Character) plus a conditional child divider; unified icon colors via `--ai-accent` and refreshed active/hover styling.
- Added hide-layout modes for template-like tools: selecting Templates, Workflows, My Generations, or Community now collapses the content columns while keeping the rail visible.
- Updated recreate (image/video) footer to mirror Create: media-library and save-prompt ghost buttons plus a larger Generate CTA; brightened prompt text and tweaked Generate sizing for better alignment.
- Introduced toolbar profile/section spacing tweaks, kept accent-driven iconography (including Globe for Community and Person for Character), and ensured Pulse children render above shortcut sections.

## 2027-01-23 (AI Studio integrations, credits, and UX polish)

- Wired Kie.ai and Fal.ai model integrations through server-side proxies, added model filtering by mode (image vs. video), and mapped aspect ratios to provider-specific size params (Fal Flux Dev uses width/height aligned to the selected aspect).
- Added a Supabase-backed credit system (ledger + hook) with auto-seed, per-generation debit for Fal Flux Dev, and a live credit display embedded in the AI Studio header; Generate buttons show dynamic costs.
- Improved media UX: reference detail modal now renders full images with object-fit contain (no cropping) and matches item aspect; Reference Grid shows animated spinners for in-progress items and ignores non-image drops to prevent blank cards.
- Hardened drag/drop flows: prefer state URLs over blob URLs, filter non-image drops in the grid, and surface status/error chips with clearer overlay behavior.

## 2027-01-24 (AI Studio prompt + describe consolidation)

- Prompts: removed redundant prompt docs (now archived in `docs/archive/ai-studio-prompts.md`) and codified `frontend/lib/agentPromptsConfig.ts` as the single source of truth. Updated the SOP to reflect gpt-4.1-nano defaults and prompt ownership.
- Image-to-Text: when the toggle is on, the describe-image agent (Agent 2) always runs—even if the prompt box has text—so the textarea is populated from the describe result. Imported images dropped into Reference Grid/Studio Preview now seed the describe flow.
- Errors & credits: added a dismissible error banner in AI Studio; Generate buttons show computed credit estimates (or “—” if unknown). Image/video runs debit credits immediately; prompt-refine/describe flows debit after API responses using observed/estimated tokens.
- API defaults: `/api/ai/generate-prompt` and `/api/ai/describe-image` default to `gpt-4.1-nano` when env vars are unset.

## 2027-01-25 (Credit gating + documentation reminder)

- Image/video generation requires a sufficient credit balance before debiting; the Generate CTA disables and the SOP now notes the credit check so the banner can prompt a top-up.
- Added a comment near `modelOptions` reminding maintainers to keep the `docs/sops/sop_image_generation.md` supported-model table in sync when adding providers/models.
- Video pipeline hardening: added routing for text-to-video models and allowed dropped/imported images (blob/data URLs) to be used for image-to-video submissions by normalizing inputs before provider calls.

## 2026-01-24 (AI model references)

- Added a dedicated `docs/api/api-responses.md` guide covering the OpenAI Responses API payloads, tools, and best practices alongside `docs/api/api-chat-completions.md` in the docs index.
- Documented Fal.ai model workflows (`docs/api/api-fal-veo3.md`, `docs/api/api-fal-flux-dev.md`, `docs/api/api-fal-nano-banana-pro.md`, `docs/api/api-fal-seedream-4-5.md`, `docs/api/api-fal-seedance-1-5-pro.md`) so every queue/task/callback path is captured plus the backend `kei/task-status` proxy.
- Added the new API references to `docs/README.md` under the API Reference section for a single navigation surface.

## 2027-01-27 (AI Studio model pricing + integrations)

- Introduced Google Veo 3.1 (Fal) with 8s default, 1080p/audio-on pricing; wired Fal queue submission and per-second cost strategy.
- Updated model order in selectors and ensured env template documents KEI/FAL keys.

## 2026-02-03

- Updated Image-to-Video (Recreate) UI to use two primary reference frames (First frame + Last frame) and hide secondary dropzones for video models; added on-card labels for clarity.
- Added MiniGenerateButton to the Agent Chat input row beside Send for faster prompt generation actions.
- Updated `docs/sops/sop_video_generation.md` to reflect the first/last frame workflow requirement for image-to-video.
- Temporarily hid the AI Studio toolbar “Creations” section (My Generations/Community); the toolbar file still contains the buttons and this note should be the reminder to revert once they need to be visible again.

## 2026-03-09

- Media-library adaptive performance hardening:
  - unified adaptive pressure/watchdog behavior across media surfaces,
  - replaced static pressure wiring (`pressureLevel: 0`) with runtime pressure inputs,
  - strengthened signing runtime with bounded chunk concurrency + in-flight coalescing,
  - tuned route/modal sign budgets and modal cache TTL for faster reopen behavior,
  - added pagination guardrails to stop pinned-bottom auto-load churn,
  - optimized `/api/media/resolve-previews` fallback execution and kept auth/path constraints intact.
- Cross-surface signing telemetry rollout:
  - expanded sign-batch telemetry surface labels (reference-grid, quick-slot, character-grid, detail-modal).
- Reliability fixes discovered during local perf triage:
  - added `images.pexels.com` to Next image trusted host list (`frontend/next.config.js`) to prevent `next/image` host-config runtime failures,
  - cleaned stale Character Manager profile-path metadata rows that referenced missing storage objects.
- Updated operational docs:
  - `docs/sops/sop_media_performance_operations.md` (private-tab sign-latency tuning guidance),
  - `docs/troubleshooting.md` (Next dev lock conflicts, Next image host config, QUIC transport troubleshooting).

## 2026-02-06

- Added Kling 3.0 Pro image-to-video (Fal) with per-second pricing, new Fal proxy routes, and AI Studio wiring for defaults and submissions.
- Documented Kling 3.0 Pro API usage and updated AI Studio pricing + SOP tables to include the new model.

## 2026-02-07

## 2026-02-16

- Hardened `/api/ai/studio-agent` runtime: added flow-aware routing (text fast path + orchestration path), refusal-safe behavior (no synthetic `applyPrompt` on refusal), request timeouts, and structured stage telemetry.
- Follow-up hardening pass: removed non-text routing dependence on `NEXT_PUBLIC_AGENT_V2`, added bounded timeout parsing for `STUDIO_AGENT_TIMEOUT_MS`, and added runtime API tests for mixed-flow orchestration, timeout fallback, refusal canonical preservation, and text fast-path behavior.
- Replaced in-memory canonical prompt continuity with Supabase-backed persistence via migration `018_add_ai_agent_conversation_state.sql` and server adapter `frontend/lib/server/api/agentConversationState.ts` (TTL + per-user cap pruning).
- Consolidated chat image handling to one client request + server-owned vision summary stage; removed client-side chat attachment describe fan-out.
- Removed question-action surfaces end to end (`AgentActions.questions`, UI question chips/handlers, related tests and wiring).
- Updated agent prompt contracts (`STUDIO_AGENT_SYSTEM`/`THINKER`/`FORMATTER`) to enforce no-question behavior and aligned formatter message/apply-prompt contract.
- Added planning and architecture records for the hardening work (`docs/planning/ai-studio-agent-pipeline-hardening-plan.md`, `docs/adr/0012-ai-studio-agent-runtime-hardening.md`) and refreshed SOP/API docs to match runtime behavior.
- Added Kling 3.0 Pro text-to-video (Fal) with per-second pricing, new Fal proxy submit route, and AI Studio wiring for defaults and submissions.
- Documented the Kling 3.0 Pro text-to-video API and updated AI Studio SOP tables + pricing notes.

## 2026-02-11

- Reorganized docs into category folders: `docs/api/`, `docs/sops/`, `docs/product/`, `docs/planning/`, and `docs/archive/`; added section indexes for each folder.
- Updated repo-wide doc links and refreshed `docs/README.md`, `docs/documentation_overview.md`, and `docs/repo-structure.md` to match the new information architecture.
- Resolved ADR numbering collision by renaming the AI Studio agent ADR to `docs/adr/0006-ai-studio-agent-api.md` and updating references.
- Added missing operational baseline docs: `docs/monitoring.md`, `docs/disaster-recovery.md`, and `docs/performance.md`.
- Updated docs validation script (`scripts/check_docs_links.js`) to validate API references from `docs/api/`.

## 2026-02-11 (later)

- Added `docs/adr/0007-ai-studio-agent-tooling-strategy.md` to codify the product decision: ship media analysis and prompt optimization now, run evaluation in shadow mode, and defer MCP until objective adoption gates are met.
- Added `docs/planning/ai-studio-agent-tooling-phased-plan.md` with concrete rollout phases, tool contracts, telemetry requirements, security guardrails, and MCP adoption checklist.
- Updated `docs/sops/sop_ai_studio_agent.md`, `docs/planning/README.md`, and `docs/README.md` so the strategy and plan are discoverable and operationally durable.

## 2026-02-12

- Ran a repo-wide documentation audit against the live route/API/schema surface and identified missing coverage for internal API contracts, provider incident response, and credit reservation schema details.
- Added `docs/api/api-internal-routes.md` to document first-party Next.js API families, auth boundaries (`frontend/proxy.ts` + route-level guards), environment dependencies, and maintenance expectations.
- Added `docs/sops/sop_provider_incident_response.md` with Fal/OpenAI/Stripe triage, diagnostics queries, mitigation steps, and post-incident requirements.
- Updated schema/security/ops docs to include reservation billing lifecycle requirements: `docs/data-dictionary.md`, `docs/security-checklist.md`, `docs/local-development.md`, `docs/database-migrations.md`, `docs/monitoring.md`, and `docs/troubleshooting.md`.

## 2026-02-14

- Updated docs indexes and cross-links so new docs are discoverable from `docs/README.md`, `docs/api/README.md`, `docs/sops/README.md`, and `docs/documentation_overview.md`.

## 2026-02-12 (dashboard hidden tool reminders)

- Removed the dashboard “Temporarily hidden” reminder row and the small Saved Creators/Performance pills from the Tools section so hidden surfaces have no in-app visual footprint.

## 2026-03-07

- AI Studio canvas reliability hardening: restored empty-space double-click text draft creation for the main canvas while preserving pan/zoom behavior and gesture dedupe.

- Added dual-canvas draft/edit ownership controls so mirrored canvas instances no longer clear each other’s active text draft or text edit session.
- Added canvas interaction regression coverage for slight drag-jitter double-tap fallback and dual-canvas draft visibility behavior.
- Updated `docs/sops/sop_ai_studio_index.md` with explicit canvas interaction guardrails for dual-canvas behavior.
- Preserved the actual feature routes; this changelog entry is the documentation reminder that those links are intentionally hidden from the dashboard UI.

## 2026-02-12 (character placeholder navigation)

- Added a temporary `/character-soon` placeholder page and routed the dashboard Character card to it while the full Character workflow remains staged.
- Updated route documentation in `README.md` and `docs/routes.md` so the temporary Character navigation is explicit.

## 2026-02-18

- Implemented AI Studio reference-grid stabilization v4 runtime controls:
  - selector-backed page output decoupling flag path (`NEXT_PUBLIC_AI_STUDIO_PAGE_OUTPUT_DECOUPLE`)
  - strict preview/full URL ladder resolver with safe legacy fallback
  - image hydration/decode inflight budgeting and runtime queue metrics
  - dynamic virtualization windowing with density/pressure-aware overscan and RAF scroll sync
  - dense visual simplify mode for 40+ references
  - perf watchdog + memory guard degrade levels with hysteresis and debug data attributes
- Updated perf harness behavior:
  - `runReferenceGridAudit` default scenarios now include 20/50/60/100/300
  - added grid metrics (`rendered_item_count`, hydration queue, decode inflight)
  - introduced 60-count grid gates and preserved existing shell gates
  - fixed shell section commit sampling so reference and preview commits are measured independently
- Extended save/persistence delivery metadata for AI Studio media saves and threaded the new shape through persistence/task orchestration consumers.
- Added docs for the v4 rollout and architecture decisions:
  - `docs/planning/ai-studio-reference-grid-stabilization-v4-plan.md`
  - `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`
  - updated `docs/sops/sop_media_performance_operations.md`

## 2026-02-13

- Completed Character Manager terminology migration follow-through: standardized app/UI copy on **Character Sheet** and added regression coverage so `/character` keeps the label stable (`frontend/features/character-manager/components/__tests__/CharacterManagerShell.copy.test.tsx`).
- Added backward-compatible schema migration `sql/migrations/012_add_character_sheet_aliases_and_compat.sql` plus rollback script to introduce `character_sheet_*` aliases while keeping legacy `reference_pack_*` fields synchronized.
- Updated Character Manager persistence to use canonical `character_sheet_id`/`active_character_sheet_id` fields and canonical metadata key `character_sheet_assignments`, while dual-writing legacy aliases for compatibility.
- Added ADR `docs/adr/0011-character-sheet-terminology-policy.md` to codify naming policy and migration posture.
- Updated migration/docs inventory to include latest Character Manager migrations and compatibility semantics (`docs/database-migrations.md`, `docs/data-dictionary.md`, `docs/README.md`).

## 2026-02-13 (later)

- Added `sql/check_character_sheet_alias_drift.sql` to provide a reusable diagnostics query for Character Sheet vs legacy Reference Pack alias mismatch detection.
- Expanded operational docs with alias drift troubleshooting/monitoring and post-migration verification guidance (`docs/troubleshooting.md`, `docs/monitoring.md`, `docs/database-migrations.md`).
- Added deprecation-planning backlog items for removing legacy `reference_pack_*` aliases after monitored stability (`docs/planning/backlog.md`).
- Attempted `npm -C frontend run db:migrate`; command failed in this workspace because Supabase CLI is not linked to a project ref.

## 2026-02-13 (planning archive cleanup)

- Archived the 10-slot Character Manager redesign planning doc by moving `docs/planning/character-manager-character-sheet-plan.md` to `docs/archive/character-manager-character-sheet-plan.md`.
- Updated planning/docs indexes to remove active-planning references and list the archived location (`docs/planning/README.md`, `docs/README.md`, `docs/archive/README.md`).
- Updated `docs/adr/0010-character-manager-character-sheet-architecture.md` to remove the fixed 10-slot requirement language and reference the current phased Character Manager contract.

## 2026-02-13 (character sheet assignment persistence)

- Wired Character Manager Character Sheet assignments to persist in Supabase character metadata via `saveCharacterManagerCharacterSheetAssignments`, including canonical + compatibility alias keys.
- Updated `/character` shell state to load and save drop-zone assignments through `useCharacterManagerDraft` so assign/replace/swap survives refresh and character switching.
- Added/updated Character Manager tests to cover persisted assignment behavior, clear/reupload behavior, and 8-reference cap stability.
- Updated docs to reflect persisted Character Sheet assignments (`README.md`, `docs/routes.md`, `docs/sops/sop_character_manager_operations.md`).

## 2026-02-14 (AI Studio Create Character Mode injection)

- Implemented Create-only Character Mode payload wiring in `/ai-studio`: selected Character Manager description + Character Sheet assignments now resolve to best-effort hidden prompt/reference injection for Seedream 4.5 Edit at forced highest resolution.
- Added explicit display-vs-submission prompt separation in task submission so hidden character context is sent to providers without leaking into UI-visible output prompt text.
- Added shared Character Mode payload helpers (`resolveCharacterSheetReferenceUrls`, `composeCharacterModePrompt`, `mergeCharacterAndUserReferences`) and regression tests for ordering, prompt composition, dedupe, and submission behavior.
- Preserved non-blocking fallbacks: missing selected character, missing description, or missing Character Sheet refs no longer block generation and now run prompt-only or partial injection.
- Updated operational docs for the new generation-driving contract (`docs/sops/sop_image_generation.md`, `docs/sops/sop_character_manager_operations.md`) and added implementation plan artifact (`docs/planning/ai-studio-character-mode-injection-plan.md`, now archived at `docs/archive/planning/ai-studio-character-mode-injection-plan.md`).

## 2026-02-14 (AI Studio Character Mode hardening)

- Added stale Character Mode bundle refresh before Create submit/regenerate so Character Sheet signed URLs are reloaded when bundle age exceeds threshold, reducing expiry-related submission failures.
- Added client breadcrumbs for Character Mode fallback telemetry (`character_mode_injection_fallback`) and refresh lifecycle (`character_mode_bundle_refresh_before_submit`, `character_mode_bundle_refresh_failed`) to improve ops/debug visibility.
- Added page-level integration coverage for `/ai-studio` Create submission wiring (`frontend/pages/__tests__/ai-studio.character-mode.test.tsx`) to verify hidden prompt/reference injection and stale-refresh behavior.

## 2026-02-14 (Character pipeline audit follow-through)

- Added migration `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql` and documented it as required in `docs/database-migrations.md` to prevent reservation RPC failures (`column reference "source_ref" is ambiguous`) in Fal submit paths.
- Hardened billing API error exposure so generation credit failures now return a safe user-facing message while preserving server-side diagnostic logs (`frontend/lib/server/api/generationBilling.ts` + `frontend/tests/api/generation-billing.reservations.test.ts`).
- Added Playwright-backed E2E audit baseline for auth -> Character Manager -> AI Studio character mode submit (`frontend/tests/e2e/character-pipeline.audit.js`) and wired `npm run test:e2e:character`.
- Updated operations/testing docs to include the new migration + audit command (`docs/sops/sop_billing_credits_operations.md`, `docs/testing-guide.md`, `docs/archive/planning/audit-progress.md`).

## 2026-02-14 (MVP pre-tester full audit remediation plan)

- Added `docs/planning/mvp-pretester-full-audit-remediation-plan.md` as the execution runbook for security hardening, reliability gates, modularization, performance, and docs/SOP alignment before external tester rollout.
- Updated planning and docs indexes so the plan is discoverable from `docs/planning/README.md` and `docs/README.md`.
- Verified docs integrity via `cd frontend && npm run docs:check`.

## 2026-02-14 (MVP audit skills)

- Added three execution skills for repeated audit/remediation work: `skills/skill-mvp-security-audit/`, `skills/skill-mvp-modularization-pass/`, and `skills/skill-mvp-docs-sop-governance/`.
- Added skill metadata files (`agents/openai.yaml`) for each new skill to support skill picker usage.
- Updated skill discoverability in `docs/README.md` and `docs/agent-playbook.md`.

## 2026-02-14 (stabilization plan archived)

- Archived `docs/planning/mvp-stabilization-plan.md` to `docs/archive/mvp-stabilization-plan.md` and marked it superseded.
- Updated planning/docs/archive indexes and agent references to point to `docs/planning/mvp-pretester-full-audit-remediation-plan.md` as the active pre-tester execution source.

## 2026-02-14 (Phase 1 security hardening start)

- Hardened generation reservation RPCs with caller-binding checks and explicit execute grants in `sql/migrations/002_add_generation_credit_reservations.sql` and `sql/migrations/013_fix_generation_reservation_rpc_ambiguity.sql`; added upgrade migration `sql/migrations/014_harden_generation_reservation_rpc_security.sql`.
- Hardened Stripe billing routes to use canonical `APP_BASE_URL` for checkout/portal redirects and added webhook timestamp tolerance checks (`frontend/lib/server/api/stripe.ts`, `frontend/pages/api/billing/stripe/checkout.ts`, `frontend/pages/api/billing/stripe/portal.ts`).
- Added server-side magic-byte validation for image/video uploads via `frontend/lib/server/uploadSignature.ts` and wired it into `frontend/pages/api/upload-image.ts` and `frontend/pages/api/upload-video.ts`.
- Relocated internal API helper modules from `frontend/pages/api/_utils/` to `frontend/lib/server/api/` and added a middleware denylist for `/api/_utils/*` in `frontend/proxy.ts` as a fail-closed guard.
- Added targeted tests for new hardening behavior (`frontend/tests/api/stripe-utils.test.ts`, `frontend/tests/api/upload-signature.test.ts`, `frontend/tests/api/proxy-internal-utils.test.ts`) and updated env/migration docs.

## 2026-02-14 (UI/UX remediation planning separation)

- Added `docs/planning/mvp-ui-ux-stabilization-remediation-plan.md` as a dedicated UI/UX remediation execution track separate from `mvp-pretester-full-audit-remediation-plan.md`.
- Updated `docs/planning/README.md` to index the standalone UI/UX stabilization plan.

## 2026-02-14 (Phase 2 reliability gates complete)

- Updated lint scope to ignore generated Playwright artifacts in `frontend/eslint.config.mjs` (`playwright-report/**`, `test-results/**`) and removed CI lint soft-fail from `.github/workflows/ci.yml`.
- Added missing API handler coverage for Phase 2: `frontend/tests/api/stripe-checkout.test.ts`, `frontend/tests/api/stripe-portal.test.ts`, `frontend/tests/api/stripe-webhook.test.ts`, `frontend/tests/api/upload-image-route.test.ts`, `frontend/tests/api/upload-video-route.test.ts`, `frontend/tests/api/admin-users.test.ts`, `frontend/tests/api/admin-errors.test.ts`, `frontend/tests/api/admin-errors-status.test.ts`, and `frontend/tests/api/admin-credits-adjust.test.ts`.
- Verified reliability gate with `cd frontend && npm run validate` passing (`lint`, `type-check`, `test`).

## 2026-02-14 (UI/UX sprint tickets + UX-0 baseline kit)

- Added `docs/planning/mvp-ui-ux-sprint-ticket-breakdown.md` with one sprint-ready ticket per UI/UX checklist item, including owner role, estimate, and dependency.
- Added UX-0 execution artifacts: `docs/planning/mvp-ui-ux-phase0-baseline-qa-checklist.md` and `docs/planning/mvp-ui-ux-phase0-baseline-capture-template.md`.
- Updated indexes and source plan references so the new ticket/QA artifacts are discoverable from `docs/planning/README.md`, `docs/README.md`, and `docs/planning/mvp-ui-ux-stabilization-remediation-plan.md`.

## 2026-02-14 (UI/UX owner assignment kickoff)

- Added `docs/planning/mvp-ui-ux-issue-board.md` as the execution board of record with current assignee mappings, UX-0 status, and acceptance evidence links.
- Updated the source UI/UX stabilization plan to mark UX-0 board mapping + ownership confirmation checklist items complete.
- Updated planning/doc indexes and sprint-ticket metadata to point to the owner-assigned issue board.

## 2026-02-14 (UI/UX baseline capture run: dashboard + ai-studio)

- Executed a real UX-0 baseline capture pass against local app routes `/dashboard` and `/ai-studio` at `1440`, `1024`, `768`, and `390` widths.
- Added filled baseline evidence report `docs/archive/mvp-ui-ux-phase0-baseline-report-2026-02-14-dashboard-ai-studio.md` with artifact paths and initial findings.
- Updated UI/UX plan + issue board to reflect partial completion of `UX0-01` and linked the report as current acceptance evidence.

## 2026-02-14 (UI/UX baseline completion + keyboard pass kickoff)

- Completed UX-0 screenshot matrix across all priority routes (`/dashboard`, `/ai-studio`, `historical implementation`, `/profile`, `/performance`) at `1440`, `1024`, `768`, and `390`.
- Added consolidated report `docs/planning/mvp-ui-ux-phase0-baseline-report-2026-02-14-full.md` with full artifact table and first-pass keyboard baseline findings.
- Updated UI/UX issue board and source plan status: `UX0-01` marked done; `UX0-02` moved to in-progress with blockers logged (no media cards present, no visible downgrade action in billing section for cancel-modal path).

## 2026-02-14 (UI/UX keyboard baseline rerun with seeded media)

- Re-ran UX-0 keyboard baseline with forced media upload seeding and subscription-section targeting to reduce false blockers in modal checks.
- Updated full baseline report findings: AI Studio generate keypath exercised, Media Library modal opened but did not close on Escape in this run, and profile subscription modal path remained blocked by account-state controls not being visible.
- Updated UI/UX source plan and issue board notes to reflect narrowed blocker scope and latest keyboard evidence.

## 2026-02-14 (AI Studio state seam: reference selection + modal wiring)

- Extracted reference input state and modal/selection orchestration from `frontend/features/ai-studio/hooks/useAiStudioState.ts` into `frontend/features/ai-studio/hooks/useAiStudioReferenceSelectionState.ts`.
- Added focused hook coverage in `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceSelectionState.test.ts` for tool-routed reference updates, indicator toggling guardrails, and model modal open/close behavior.
- Updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md` to mark the seam complete and set the next `useAiStudioState` split target.

## 2026-02-14 (AI Studio state seam: generation prompt/reference composition)

- Extracted generate/regenerate prompt + reference input composition from `frontend/features/ai-studio/hooks/useAiStudioState.ts` into `frontend/features/ai-studio/hooks/useAiStudioGenerationPromptComposer.ts`.
- Added focused hook coverage in `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationPromptComposer.test.ts` for override precedence, video reference-mode behavior, regenerate empty-prompt guardrails, and reference-pool ordering.
- Updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md` to mark this seam complete and move the next `useAiStudioState` target to task polling/submission orchestration.

## 2026-02-14 (AI Studio state seam: task polling/submission orchestration)

- Extracted polling lifecycle, deferred autosave finalization, status retry handling, and submission wiring from `frontend/features/ai-studio/hooks/useAiStudioState.ts` into `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`.
- Added focused hook coverage in `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskOrchestration.test.ts` for deferred autosave completion, missing-task retry guardrail, and retry poll restart behavior.
- Updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md` to mark the `useAiStudioState` concern split complete for this pass and move the next target to `frontend/pages/ai-studio.tsx` controller decomposition.

## 2026-02-14 (AI Studio page seam: panel props composition)

- Extracted text/image/video properties-panel prop composition from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`.
- Added focused hook coverage in `frontend/features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts` for derived generation flags, nullable preview resolution, and Kling voice slot update behavior.
- Aligned `AiStudioPageContent` text-panel prop typing with `TextPropertiesPanel` props to prevent type drift and verified quality gates with `cd frontend && npm run validate` and `cd frontend && npm run build`.

## 2026-02-14 (AI Studio page seam: character panel props composition)

- Extracted Character tool properties-panel prop composition from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioCharacterPanelProps.ts`.
- Added focused hook coverage in `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterPanelProps.test.ts` for identity-build eligibility derivation and action handler routing.
- Verified quality gates with `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (AI Studio page seams: reference canvas + preview/detail wiring)

- Extracted reference-canvas prop composition from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts`.
- Extracted studio-preview prop composition + detail-modal action wiring from `frontend/pages/ai-studio.tsx` into `frontend/features/ai-studio/hooks/useAiStudioPreviewDetailProps.ts`.
- Added focused hook tests in `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceCanvasProps.test.ts` and `frontend/features/ai-studio/hooks/__tests__/useAiStudioPreviewDetailProps.test.ts` and re-ran targeted AI Studio seam coverage.

## 2026-02-14 (P0 docs alignment + plan status sync)

- Updated architecture/local-dev docs to remove stale client-only wording and reflect internal API-route architecture (`docs/architecture-overview.md`, `docs/local-development.md`).
- Updated frontend architecture guidance to remove stale "thin orchestrator" wording for AI Studio and reflect ongoing seam extraction (`docs/frontend-architecture.md`).
- Added missing `/api/media/resolve-previews` coverage to internal API route docs (`docs/api/api-internal-routes.md`).
- Segregated legacy Character SOPs from active SOPs in the SOP index (`docs/sops/README.md`).
- Re-synced remediation tracking docs: updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md`, `docs/planning/mvp-ui-ux-stabilization-remediation-plan.md`, and `docs/planning/mvp-ui-ux-issue-board.md` to match completed reliability/doc-governance status and current seam progress.
- Confirmed `P0` staging migration verification remains blocked in this workspace pending Supabase CLI environment readiness (`supabase status` failed: Docker daemon unavailable).

## 2026-02-14 (staging migration 014 applied + verified)

- Applied `sql/migrations/014_harden_generation_reservation_rpc_security.sql` to staging project `jwmcytzyhcvacjwqtynn` via Supabase CLI using a temporary workdir migration push.
- Verified remote migration history includes `014` with `supabase migration list --workdir /tmp/sp-supabase-run --debug`.
- Pulled remote migration statements (`supabase migration fetch --workdir /tmp/sp-supabase-run --yes --debug`) and decoded the stored SQL payload, confirming all five reservation RPCs include `auth.uid()` caller-binding checks and explicit grant hardening (`revoke ... from public, anon, authenticated` + `grant execute ... to service_role`).

## 2026-02-14 (P0 UX tooling closure + plan refresh)

- Expanded `.github/pull_request_template.md` with a UI accessibility checklist and explicit before/after screenshot requirement for `P0` UX layout/navigation fixes, completing `UX6-03` and `UX6-04`.
- Updated `docs/planning/mvp-ui-ux-stabilization-remediation-plan.md` to mark UX-6 tooling cleanup complete and logged the completion milestone.
- Updated `docs/planning/mvp-ui-ux-issue-board.md` to mark `UX6-01` through `UX6-04` complete with consolidated evidence references.
- Removed remaining stale `client-only` wording in active contributor/testing guidance (`docs/agent-playbook.md`, `docs/testing-guide.md`).
- Refreshed `docs/planning/mvp-pretester-full-audit-remediation-plan.md` current sprint focus to the next `P1` modularization targets (`media-library.tsx`, `generationBilling.ts`, `falClient.ts`) and marked active-scope `P0` documentation alignment complete.

## 2026-02-14 (Media Library modularization seam: move-cache reconciliation)

- Extracted moved-row cache reconciliation logic from `historical implementation` into `frontend/features/media-library/logic/mediaMoveCache.ts`.
- Added focused unit coverage in `frontend/features/media-library/logic/__tests__/mediaMoveCache.test.ts` for destination-query matching behavior, cross-tab row removal, and cache no-op guardrails.
- Re-ran quality gates: `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Media Library modularization seam: modal image zoom/pan controller)

- Extracted modal image zoom/pan state and interaction handlers from `historical implementation` into `frontend/features/media-library/hooks/useMediaModalImageZoom.ts`.
- Added focused hook coverage in `frontend/features/media-library/hooks/__tests__/useMediaModalImageZoom.test.ts` for keyboard zoom toggles, non-image guardrails, and pointer pan/capture lifecycle behavior.
- Updated `historical implementation` to consume the new hook and reduced page length to `2871` lines.
- Re-ran quality gates: `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Media Library modularization seam: file-modal CRUD controller)

- Extracted file-modal CRUD handlers (open/close, rename, single-delete) from `historical implementation` into `frontend/features/media-library/hooks/useMediaFileModalCrud.ts`.
- Added focused hook coverage in `frontend/features/media-library/hooks/__tests__/useMediaFileModalCrud.test.ts` for modal lifecycle, rename update flow, and single-delete state reconciliation.
- Updated `historical implementation` to consume the new hook and reduced page length to `2820` lines.
- Re-ran quality gates: `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Media Library modularization seam: bulk move controller)

- Extracted bulk-selection move orchestration (eligible-row derivation, destination option gating, move-batch request handling, cache reconciliation, and feedback state) from the historical implementation into a dedicated hook.
- Added focused hook coverage for selection filtering, success-path cache/state updates, and request-failure error surfacing.
- Updated `historical implementation` to consume the new hook and reduced page length to `2634` lines.
- Re-ran quality gates: `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Media Library modularization seam: preview signing/hydration controller)

- Extracted preview signing/hydration pass orchestration (row prioritization, batch signing, resolver fallback, and failure telemetry) from `historical implementation` into `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`.
- Added focused hook coverage in `frontend/features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts` for successful signing application, unresolved fallback behavior, and in-flight guardrails.
- Updated `historical implementation` to consume the new hook and reduced page length to `2473` lines.
- Re-ran quality gates: `cd frontend && npm run validate`, `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Generation billing modularization split)

- Split `frontend/lib/server/api/generationBilling.ts` into focused modules under `frontend/lib/server/api/generationBilling/`: `pricingParams.ts`, `reservationRpcAdapter.ts`, `ownershipResolver.ts`, `settlementService.ts`, plus shared `types.ts`/`utils.ts`/`errorGuards.ts`.
- Kept `frontend/lib/server/api/generationBilling.ts` as the route-facing orchestrator and public export surface (`chargeGenerationRequest`, ownership resolver, settlement/capture entry points), reducing it to `249` lines.
- Re-ran targeted API tests for reservation fallback + ownership enforcement (`frontend/tests/api/generation-billing.reservations.test.ts`, `frontend/tests/api/fal-status.ownership.test.ts`, `frontend/tests/api/kei-task-status.ownership.test.ts`) and full quality gates (`cd frontend && npm run validate`, `cd frontend && npm run build`, `cd frontend && npm run docs:check`).

## 2026-02-14 (Fal client registry-driven conversion)

- Reworked `frontend/lib/falClient.ts` from many repeated submit/status wrappers into a registry-driven endpoint client with shared generic submit/status handlers and per-endpoint route/validation metadata.
- Preserved existing exported helper API names used by the app (`submitFal*` and `fetchFal*Status`) so no call-site changes were required; retained Veo image-to-video status `405 -> GET` fallback behavior inside registry config.
- Reduced `frontend/lib/falClient.ts` to `523` lines and verified compatibility via targeted Fal/UI tests plus full quality gates (`cd frontend && npm run validate`, `cd frontend && npm run build`, `cd frontend && npm run docs:check`).

## 2026-02-14 (Media Library modularization seam: tab-data/cache + upload pipeline controllers)

- Extracted media-tab fetch/cache orchestration from `historical implementation` into `frontend/features/media-library/hooks/useMediaTabDataController.ts` (prompt loading, tab-page fetch/cursor handling, stale-cache policy, and load-more observer wiring).
- Extracted upload pipeline controllers from `historical implementation` into `frontend/features/media-library/hooks/useMediaUploadController.ts` (drag/drop and picker intake, optimistic placeholders, storage upload + row insert + preview-sign reconciliation).
- Added focused hook coverage in `frontend/features/media-library/hooks/__tests__/useMediaTabDataController.test.ts` and `frontend/features/media-library/hooks/__tests__/useMediaUploadController.test.ts`.
- Updated `historical implementation` to consume both hooks and reduced page length to `2093` lines (from `2473`).
- Re-ran quality gates: `cd frontend && npm run validate` (`78` files, `273` tests), `cd frontend && npm run build`, and `cd frontend && npm run docs:check`.

## 2026-02-14 (Admin error telemetry hardening: immutable events + generation route coverage)

- Added immutable per-occurrence storage via `sql/migrations/015_add_app_error_events.sql` (plus rollback), and updated bootstrap SQL (`sql/create_app_error_logs_table.sql`) so operator telemetry now has both grouped incidents (`app_error_logs`) and raw events (`app_error_events`).
- Hardened shared error logging (`frontend/lib/server/api/appErrorLogs.ts`) to write events first, link events to incidents, tolerate missing request headers, and degrade safely when Supabase admin clients are unavailable in test/nonconfigured environments.
- Expanded generation-scope server logging coverage across billing + provider routes (`frontend/lib/server/api/generationBilling.ts`, `frontend/lib/server/api/falSubmitProxy.ts`, `frontend/lib/server/api/falStatusProxy.ts`, `frontend/pages/api/ai/*`, `frontend/pages/api/kei/*`, `frontend/pages/api/fal/veo-image-to-video-*.ts`) so handled `4xx/5xx`, upstream failures, transport exceptions, and ownership denials are all recorded.
- Updated admin/API/docs surfaces for the new scope and storage model (`frontend/pages/api/admin/errors.ts`, `frontend/features/admin/components/ErrorIncidentsPanel.tsx`, `frontend/pages/admin/index.tsx`, `docs/monitoring.md`, `docs/data-dictionary.md`, `docs/api/api-internal-routes.md`, `docs/database-migrations.md`, `docs/local-development.md`, `README.md`).
- Validation pass: `npm -C frontend run type-check`; targeted `vitest` suites for admin errors, AI/KEI auth+ownership, generation billing reservations, Fal status ownership, and AI Studio lifecycle hook; targeted `eslint` on touched telemetry/admin files; `npm -C frontend run docs:check`.

## 2026-02-14 (Admin synthetic incident trigger for UI visibility checks)

- Added admin-only route `frontend/pages/api/admin/errors-test.ts` to generate synthetic app/generation incidents (tagged in metadata) for smoke-testing telemetry ingestion and admin UI visibility.
- Added Errors-tab controls in `frontend/features/admin/components/ErrorIncidentsPanel.tsx` and wiring in `frontend/pages/admin/index.tsx` to trigger synthetic incidents and auto-refresh open incident results.
- Added API coverage in `frontend/tests/api/admin-errors-test.test.ts` and updated operator docs (`docs/monitoring.md`, `docs/api/api-internal-routes.md`, `README.md`).

## 2026-02-14 (Admin Errors V2: raw event stream + synthetic controls)

- Added admin-only event-stream API `frontend/pages/api/admin/error-events.ts` backed by `app_error_events` with filters (`scope`, `severity`, `source`, `search`, `synthetic`), pagination, and operational summaries (`lastHour`, `last24h`, app/generation split, high-severity 24h).
- Expanded Admin Errors UI (`frontend/pages/admin/index.tsx`, `frontend/features/admin/components/ErrorIncidentsPanel.tsx`) to include:
  - grouped incident table (`app_error_logs`) and
  - raw per-occurrence event stream (`app_error_events`) with independent pagination and copyable event payloads.
- Added synthetic-event operator controls in the shared filter bar (`real + synthetic`, `real only`, `synthetic only`) and unified refresh/test-trigger behavior so smoke-test incidents are immediately visible.
- Added incident-aware event enrichment and operator detail workflow: event rows now include linked incident status, event detail modal exposes stack/metadata, and incident status can be resolved/ignored/reopened directly from event context.
- Added 15-minute event-spike thresholding to `/api/admin/error-events` (total/high/generation breach flags), surfaced with Admin alert cards and configurable env vars in `frontend/.env.example`.
- Hardened operator reliability: `/api/admin/error-events` alert summaries now always use real (non-synthetic) traffic regardless UI filters, and Admin Errors tab auto-refreshes telemetry on a 30-second interval while active.
- Added route test coverage in `frontend/tests/api/admin-error-events.test.ts` and re-ran targeted admin API tests, type-check, lint, and docs index checks.

## 2026-02-14 (Phase 4 auth-boundary consolidation + verification)

- Centralized protected API routing rules in `frontend/lib/server/api/protectedApiPaths.ts` and reused them across middleware (`frontend/proxy.ts`) and API auth helpers (`frontend/lib/server/api/auth.ts`) to prevent boundary-rule drift.
- Eliminated duplicate protected-route Supabase user lookups by reusing middleware-authenticated context headers in `requireApiUser/getOptionalApiUser/requireAdminUser`, while preserving fallback token verification for non-protected routes.
- Added coverage for middleware context behavior and spoof-resistance boundaries in `frontend/tests/api/auth-helper.test.ts` and `frontend/tests/api/proxy-internal-utils.test.ts`.
- Added synthetic latency benchmark evidence in `frontend/tests/api/auth-latency-benchmark.test.ts` showing middleware-context auth path `p50=0.07ms/p95=0.25ms` vs fallback verification `p50=13.28ms/p95=13.42ms` (40 samples, 12ms mocked upstream delay), and documented it in `docs/monitoring.md`.
- Added middleware-auth-context ownership regression coverage for KEI status polling in `frontend/tests/api/kei-task-status.auth-context.test.ts`; ownership checks continue to block non-owned task IDs.
- Added middleware-auth-context ownership regression coverage for Fal status polling in `frontend/tests/api/fal-status.auth-context.test.ts`; Fal status polling still blocks non-owned request IDs.

## 2026-02-14 (Docs cleanup pass: legacy character docs archived)

- Moved legacy Character SOPs from active operations into archive folders: `docs/archive/sops/sop_character_generation.md` and `docs/archive/sops/sop_character_identity.md`.
- Moved legacy Character product build guide into archive: `docs/archive/product/character_workflow_build_guide.md`.
- Updated docs indexes and references to keep active docs clean and links intact (`docs/README.md`, `docs/sops/README.md`, `docs/archive/README.md`, `docs/sops/sop_character_manager_operations.md`, and `docs/planning/mvp-pretester-full-audit-remediation-plan.md`).
- Added archive-status notes inside moved docs and documented archive subfolder structure (`docs/archive/sops/`, `docs/archive/product/`).

## 2026-02-14 (Plan follow-through: auth-regression CI lane + pause criteria)

- Added a fast auth-regression lane to frontend CI (`.github/workflows/ci.yml`) that runs `auth-helper`, `proxy-internal-utils`, `kei-task-status.auth-context`, `fal-status.auth-context`, and `auth-latency-benchmark` before the full suite.
- Re-ran the targeted auth regression suite (`11` tests) and confirmed pass.
- Updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md` with explicit Stripe/subscription pause-lift resume criteria and synced non-blocking recommendation status.

## 2026-02-14 (Staging latency capture workflow for auth-boundary release evidence)

- Added `scripts/capture_protected_route_latency.mjs` to capture real protected-route latency samples (`p50`/`p95`, status distribution, success rate) from staging with a real bearer token.
- Updated `docs/monitoring.md` with a staging latency capture runbook, default route (`/api/billing/credit-packages`), env requirements, example commands, and evidence-recording instructions.
- Updated `docs/planning/mvp-pretester-full-audit-remediation-plan.md` to track recommendation #2 as pending execution with tooling complete and explicit evidence paths.

## 2026-02-14 (Protected-route runtime latency sample captured with real auth)

- Executed `scripts/capture_protected_route_latency.mjs` against the running app (`http://127.0.0.1:3000`) on `/api/billing/credit-packages` using a real Supabase bearer token from a short-lived, email-confirmed test user.
- Sample result (`30` measured requests, `5` warmup): `p50=222.99ms`, `p95=291.78ms`, `min=204.88ms`, `max=294.34ms`, `success_rate=100.0%`, `statuses=200:30`.
- Cleaned up the temporary Supabase test user immediately after the run and recorded evidence/status updates in `docs/monitoring.md` and `docs/planning/mvp-pretester-full-audit-remediation-plan.md`.

## 2026-02-14 (Latency probe hardening: auto token bootstrap + env alignment)

- Enhanced `scripts/capture_protected_route_latency.mjs` with optional `--bootstrap-token-from-supabase` mode that creates a short-lived confirmed user via Supabase admin API, signs in for a bearer token, and auto-deletes the user after sampling.
- Added base URL fallback support (`APP_BASE_URL`) and documented the bootstrap path in `docs/monitoring.md`.
- Updated `docs/local-development.md` and `frontend/.env.example` to include staging-latency helper env vars (`SHORTPULSE_STAGING_BASE_URL`, `SHORTPULSE_STAGING_BEARER_TOKEN`) for repeatable operator runs.
- Synced remediation-plan status to reflect that staging capture now only depends on resolving the staging app host URL.

## 2026-02-14 (Latency probe bootstrap-mode verification)

- Ran `scripts/capture_protected_route_latency.mjs` with `--bootstrap-token-from-supabase` against `http://127.0.0.1:3000` to validate the new automated token flow end to end.
- Result (`8` measured requests, `2` warmup) on `/api/billing/credit-packages`: `p50=246.50ms`, `p95=274.55ms`, `success_rate=100.0%`, `statuses=200:8`.
- Confirmed temporary-user cleanup via emitted probe log `supabase_bootstrap_user_deleted=true`.

## 2026-02-14 (Latency probe operator handoff hardening)

- Added `frontend` script shortcut `npm run latency:protected-route` that wraps `scripts/capture_protected_route_latency.mjs` for repeatable operator runs.
- Updated `docs/monitoring.md`, `docs/local-development.md`, and `docs/planning/mvp-pretester-full-audit-remediation-plan.md` with a copy/paste staging capture command that uses `SHORTPULSE_STAGING_BASE_URL` plus `--bootstrap-token-from-supabase`.
- Attempted automatic staging-host discovery against common domains; no resolvable staging host was found in current workspace context, so the final staging p50/p95 capture remains pending URL confirmation.
- Validated the npm handoff command end to end against the running app (`5` measured requests, `1` warmup) with result `p50=228.38ms`, `p95=248.98ms`, `success_rate=100.0%`, and confirmed temp-user cleanup.

## 2026-02-14 (Docs governance hardening: link + legacy placement checks)

- Replaced `scripts/check_docs_links.js` with a broader docs integrity checker that now validates:
  - API docs are indexed in `docs/README.md`.
  - Markdown links resolve across repository markdown files.
  - `Status: Legacy` markers exist only under `docs/archive/`.
- Added `npm run docs:check` to CI in `.github/workflows/ci.yml` so docs integrity and archive-governance checks run on PRs/pushes.
- Updated `docs/documentation_overview.md` with explicit lifecycle states (`Active`, `Working`, `Archived`) and concrete archive requirements.

## 2026-02-15 (Credit-pricing guardrails + reservation metadata audit follow-up)

- Preserved reservation metadata on capture across all generation reservation migrations (`002`, `013`, `014`) and added SQL regression coverage in `frontend/tests/sql/generation-reservation-metadata.test.ts`.
- Expanded generation billing tests to assert debit/reservation metadata includes a full pricing breakdown (`usd_raw`, `raw_credits`, `billed_credits`, `billed_usd`) and remains in parity with `computeCostForModel`.
- Added UI guidance in AI Studio generation surfaces that estimates are billed in 5-credit increments (model modal, text/reference generate controls, prompt-reference card).
- Added pricing guardrail tests to enforce MVP model-option policy (no KEI-backed model options) and 5-credit rounding invariants across registered model defaults; updated `docs/product/ai-studio-pricing.md` to document `rawCredits`/`usdRaw` contract and KEI MVP exclusion.
- Added admin ledger audit support: new route `GET /api/admin/credits/ledger` with optional `source` filtering (for example, `source=generation_charge`), `/admin` UI table for selected-user recent credit transactions, visibility for generation `pricing_breakdown` metadata (raw vs billed credits/USD), and legacy-schema fallback reads for pre-v2 `ai_credit_ledger` deployments.

## 2026-02-15 (AI Studio media-library modal flicker/stutter fix)

- Removed a state feedback loop in `MediaLibraryModal` where `files` updates wrote back into tab cache on every render, causing repeated rerenders and visible modal instability under uploaded-image hydration.
- Added a hard retry cap for unresolved signed-preview batches (max 3 attempts per media item) to stop continuous re-sign churn on broken/unresolvable rows.
- Stabilized packed media-grid rendering by removing `content-visibility` intrinsic-size collapsing on modal cards, reducing column collapse/reflow flicker while previews load.
- Added regression coverage in `frontend/features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx` to assert unresolved signing retries stop after the cap.
- Expanded regression coverage to verify the same signing retry cap behavior across all media tabs (`Uploaded Images`, `Uploaded Videos`, `AI Studio Generations`, `Private`).
- Added regression coverage for `Saved Prompts` to ensure prompt-only tab navigation does not trigger media signing work.

## 2026-02-15 (character-mode telemetry promotion + video URL freshness hardening)

- Promoted Character Mode refresh/fallback signals to first-class event telemetry by emitting `telemetry.character_mode` occurrences through `reportAppError` from `useAiStudioCharacterModeController`; to keep volume lean, fallback events are emitted for `bundle_unavailable` only.
- Updated server error logging to store `telemetry.*` occurrences in `app_error_events` without creating grouped `app_error_logs` incidents, preventing admin open-incident noise while keeping per-occurrence visibility.
- Extended `/api/admin/error-events` with signal filtering (`signal` query param), Character Mode frequency counters (1h/24h for refresh-empty and bundle-unavailable fallback), and operational-summary hygiene to exclude telemetry sources from threshold breach metrics.
- Added an Admin Event Stream Character Mode telemetry panel with one-click stream filters for `character_mode_reference_refresh_empty` and `bundle_unavailable` fallback frequency.
- Hardened video reference submit prep by refreshing Kling element video URLs pre-submit (not only motion-control video URLs), with expanded `videoHandlers` coverage for refresh success/failure.
- Character Mode submission now degrades to description-only injection when reference URL refresh returns empty, instead of forcing `bundle_unavailable` for that path.

## 2026-02-15

- Completed a focused media-library isolation security audit (RLS, storage policies, media API routes, and client preview/signing paths) with hardening changes for fail-closed behavior.
- Added migration `sql/migrations/017_harden_media_storage_path_shape.sql` (+ rollback) to enforce shape-safe user-scoped media paths (`no ../`, no backslashes, no leading slash) for `media_files` and derivative path hints/rows where present.
- Tightened preview fallback behavior to only allow direct URLs that resolve to the authenticated user namespace by threading user-scoped filtering through `resolveMediaDirectPreviewUrls` and `/api/media/resolve-previews`.
- Added explicit user filter on Media Library prompt reads (`media_prompts`) and refreshed security/ops docs (`docs/security-checklist.md`, `docs/database-migrations.md`, `docs/monitoring.md`, `docs/troubleshooting.md`, `docs/api/api-internal-routes.md`).

## 2026-02-15

- Added `docs/sops/sop_sql_migration_operations.md` as the canonical SQL operations runbook (SQL file taxonomy, migration intent, safe re-run/idempotency guidance, media-isolation hardening loop, verification queries, common error handling for `42501` and `23514`, and staging->production promotion checklist).
- Updated SOP/doc indexes to include the new runbook: `docs/sops/README.md` and `docs/README.md`.

## 2026-02-15

- Audited SQL docs/SOP linkage and tightened cross-references to the canonical SQL runbook (`docs/sops/sop_sql_migration_operations.md`) from `docs/database-migrations.md`, `docs/security-checklist.md`, `docs/monitoring.md`, and `README.md`.
- Fixed `docs/troubleshooting.md` media scope triage SQL snippet to match current drift criteria and valid SQL syntax (`empty`, `leading slash`, non-user-scoped, traversal, backslash).
- Added SQL-folder entry pointers to the canonical runbook from `sql/migrations/README.md`, `sql/check_media_storage_scope_drift.sql`, and `sql/storage_policies.sql` to reduce operator drift when starting from SQL files.

## 2026-02-15 (Character Sheet preset tabs in Character Manager + AI Studio)

- Added persistent Character Sheet preset tabs (`1..4`) to the shared Character Manager workflow used by both `/character` and AI Studio Character panel.
- Introduced `characters.metadata.character_sheet_presets_v1` contract with active preset tracking plus per-zone media references (`portrait`, `close_up`, `front_shot`, `back_shot`), including legacy initialization from `character_sheet_assignments`.
- Updated Character Manager persistence/hook/UI to support preset switching, per-preset zone assignment, direct zone uploads, and media cleanup safeguards so QuickSwap Deck removals do not orphan preset references.
- Updated AI Studio Character Mode injection to prefer active preset references, keep legacy fallback behavior, and always reload the selected character snapshot before Create/Text generate.
- Added/updated tests for preset metadata normalization, Character Manager preset tab behavior, Character Mode payload resolution, lifecycle/controller refresh behavior, and AI Studio page integration.
- Updated SOP/data docs (`docs/sops/sop_character_manager_operations.md`, `docs/sops/sop_image_generation.md`, `docs/data-dictionary.md`) for the new preset contract and generation path.

## 2026-02-17 (AI Studio expert workflow hardening + expert CSS reorganization)

- Hardened expert generation orchestration in `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts` and `frontend/features/ai-studio/hooks/useAiStudioOptimisticDebitReconciliation.ts`: removed output-generate guardrail bypass, aligned busy/lock checks, added optimistic-debit timestamp metadata, and prevented stale orphan debit assignment.
- Added and updated AI Studio regression coverage for guardrail parity, stale debit cleanup, feature-flag behavior, output-generate eligibility parity, and character-mode picker close/reset paths across:
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioOptimisticDebitReconciliation.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts`,
  `frontend/features/ai-studio/components/__tests__/TextPropertiesPanel.test.tsx`,
  and `frontend/tests/pages/ai-studio.character-mode.test.tsx`.
- Replaced dev-only expert gating with `NEXT_PUBLIC_ENABLE_EXPERT_CREATE_UI` runtime parsing defaults in `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts` and added the variable to `frontend/.env.example`.
- Reorganized expert styling into focused modules and rewired global imports:
  `frontend/styles/ai-studio-create-expert.tokens.css`,
  `frontend/styles/ai-studio-create-expert-chat.css`,
  `frontend/styles/ai-studio-create-expert-output-generate.css`,
  `frontend/styles/ai-studio-create-expert-composer.css`,
  `frontend/styles/ai-studio-create-expert-controls.css`,
  `frontend/styles/ai-studio-create-expert-motion.css`,
  `frontend/styles/ai-studio-create-expert-responsive.css`,
  and `frontend/styles/globals.css`.
- Verification gates passed:
  `cd frontend && npm run type-check`,
  `cd frontend && npm run test -- features/ai-studio`,
  `cd frontend && npm run test -- tests/pages/ai-studio.character-mode.test.tsx`.

## 2026-02-17 (describe-image reliability + security hardening)

- Hardened `POST /api/ai/describe-image` with URL preflight safeguards: HTTPS-only enforcement, localhost/private-IP blocking, DNS private-address resolution blocking, redirect-chain validation, and image content-type verification prior to OpenAI vision requests.
- Added configurable trusted host enforcement for describe-image via `OPENAI_DESCRIBE_ALLOWED_HOSTS` and `OPENAI_DESCRIBE_REQUIRE_ALLOWED_HOSTS`, with `NEXT_PUBLIC_SUPABASE_URL` host auto-trusted to support signed media URLs.
- Improved OpenAI resilience with transient upstream retry (429/5xx/network-style errors), model-capability fallback retry to `OPENAI_VISION_FALLBACK_MODEL`, and clearer upstream source classification (`rate_limited`, `upstream_unavailable`, `upstream_error`).
- Reduced generation false-failure risk by extending terminal-state detection in polling (`done`, `complete`, `finished`, cancellation variants) in `useAiStudioTasks`.
- Added regression coverage in:
  `frontend/tests/api/describe-image.route.test.ts` and
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioTasks.test.ts`.
- Updated env/docs references for new describe-image hardening controls in:
  `frontend/.env.example`,
  `docs/deployment.md`,
  `docs/api/api-internal-routes.md`,
  and `docs/sops/sop_text_generation.md`.

## 2026-02-17 (documentation governance + backlog recovery)

- Completed a docs-only governance pass and added `docs/archive/planning/documentation-audit-2026-02-17.md` as the audit artifact (planning classification matrix, contradiction-detection method, and strict backlog evidence matrix).
- Created `docs/archive/planning/` and moved completed/superseded plans out of active planning:
  `docs/archive/planning/ai-studio-character-mode-injection-plan.md`,
  `docs/archive/planning/media-library-move-tabs-plan.md`,
  and `docs/archive/planning/mvp-pre-tester-anchor-plan.md`.
- Updated planning/archive indexes to reflect active vs archived locations (`docs/planning/README.md`, `docs/README.md`, `docs/archive/README.md`, `docs/archive/planning/README.md`).
- Reconciled stale route/scope wording in `README.md`, `docs/routes.md`, and `docs/release-checklist.md` (performance staged visibility wording, current performance-demo behavior, and Character Manager reference-limit wording).
- Audited backlog with strict evidence and checked off verifiable completions:
  Stripe billing-portal flow and auth/media-library API test coverage updates in `docs/planning/backlog.md`; also classified remaining items as open, blocked external dependency, or paused policy scope.

## 2026-02-17 (AI Studio character panel open behavior)

- Updated AI Studio shell collapse policy so selecting Character (`canvas`/`character`) now collapses the left properties panel to its minimum width immediately on tool switch (`frontend/features/ai-studio/logic/shellResize.ts`).
- Removed shell column easing while Character is open by disabling `grid-template-columns` transition under `.ai-shell-character-open` (`frontend/styles/ai-studio-layout.css`).
- Expanded shell-resize regression coverage for Character collapse behavior (`frontend/features/ai-studio/logic/__tests__/shellResize.test.ts`), and verified with:
  `cd frontend && npm run test -- features/ai-studio/logic/__tests__/shellResize.test.ts`.

## 2026-02-17 (AI Studio reference grid performance run)

- Replaced AI Studio local upload preview ingestion from full base64 payloads to object-URL-first handling in `frontend/features/ai-studio/logic/stateParsers.ts`, with deterministic object URL cleanup in `frontend/features/ai-studio/hooks/useAiStudioState.ts`.
- Added bounded-session soft archive behavior for Reference Grid outputs (default active cap: 500) with restore controls and archive telemetry (`media.grid.archive.transition`) via `frontend/features/ai-studio/hooks/useAiStudioState.ts` and `frontend/features/ai-studio/components/ReferenceCanvas.tsx`.
- Tightened Reference Grid rendering/autoplay budgets and adaptive preview routing (preview vs full path fields) in `frontend/features/ai-studio/components/ReferenceCanvas.tsx`, plus high-density CSS cost controls in `frontend/styles/ai-studio-canvas.css`.
- Added reference-grid telemetry events (`media.grid.render.commit`, `media.grid.longtask.sample`, `media.grid.memory.sample`, `media.grid.archive.transition`) in `frontend/lib/mediaPerfTelemetry.ts` and logging call sites in `ReferenceCanvas`/state archive transitions.
- Added explicit adaptive-preview rollback control (`NEXT_PUBLIC_REFERENCE_GRID_ADAPTIVE_PREVIEW`) and wired archive restore transitions into `media.grid.archive.transition` telemetry in `frontend/features/ai-studio/components/ReferenceCanvas.tsx` and `frontend/features/ai-studio/hooks/useAiStudioState.ts`.
- Added normalized output lookup/update fast-path wiring (`NEXT_PUBLIC_REFERENCE_GRID_NORMALIZED_STATE`) and selector helpers in `frontend/features/ai-studio/hooks/useAiStudioState.ts` + `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts`, and added per-tick batching for poll-driven output patches in `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`.
- Migrated AI Studio output storage to canonical normalized collections (`outputOrder` + `outputById`, plus archived equivalents) as the primary in-memory state in `frontend/features/ai-studio/hooks/useAiStudioState.ts`, with array views retained as derived compatibility outputs.
- Added a browser-native reference-grid performance harness with explicit 100/300/500 gates exposed via `window.__shortpulseAiStudioPerf.runReferenceGridAudit()` (with `seedReferenceGrid`/`clearReferenceGrid` helpers) in `frontend/pages/ai-studio.tsx`, removing Playwright dependence for this audit flow.
- Reduced output update churn by improving `updateOutputById` to targeted index replacement in `frontend/features/ai-studio/hooks/useAiStudioOutputLifecycle.ts` and adding progress-update backpressure/deduplication in `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`.
- Extended output metadata/types for performance-aware behavior (`mediaSource`, `previewTier`, preview/full storage paths, archive metadata) in `frontend/features/ai-studio/types.ts` and wired through relevant output creation/update flows.
- Updated operational docs for triage and tuning in `docs/troubleshooting.md` and `docs/sops/sop_media_performance_operations.md`.
- Added/updated targeted tests: `frontend/features/ai-studio/logic/__tests__/stateParsers.uploads.test.ts`, `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceCanvasProps.test.ts`.

## 2026-02-18 (AI Studio shell decoupling + DnD backpressure)

- Added a dedicated shell DnD controller hook with RAF-throttled drop-mode updates to reduce dragover churn in `frontend/features/ai-studio/hooks/useAiStudioShellDndController.ts`, and wired it into `frontend/features/ai-studio/components/AiStudioPageContent.tsx`.
- Added selector-style output access hook `frontend/features/ai-studio/hooks/useAiStudioSelectors.ts` and used it in `frontend/pages/ai-studio.tsx` to provide stable non-grid output lookups.
- Reduced non-grid prop churn by memoizing/stabilizing panel and preview/reference prop composition in `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`, `frontend/features/ai-studio/hooks/useAiStudioReferenceCanvasProps.ts`, and `frontend/features/ai-studio/hooks/useAiStudioPreviewDetailProps.ts`.
- Added browser-native shell interaction perf auditing via `window.__shortpulseAiStudioPerf.runStudioShellAudit()` in `frontend/pages/ai-studio.tsx` with explicit toolbar/panel/drop gates.
- Added shell high-density cost controls and feature-flag documentation updates in `frontend/styles/ai-studio-layout.css`, `docs/sops/sop_media_performance_operations.md`, and `docs/troubleshooting.md`.
- Added ADR `docs/adr/0014-ai-studio-shell-decoupling-and-event-backpressure.md` and regression coverage for new hooks in:
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioShellDndController.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioSelectors.test.ts`.

## 2026-02-18 (AI Studio selector-subscribed shell isolation v3)

- Added selector-subscribed output state in `frontend/features/ai-studio/hooks/aiStudioOutputStore.ts` (`useSyncExternalStore`) with output indexes, targeted selectors, and visible-window helpers.
- Integrated output-store snapshot publishing into `frontend/features/ai-studio/hooks/useAiStudioState.ts`, and added state APIs (`getOutputById`, `subscribeOutputs`, `getOutputSnapshot`) for non-grid consumers.
- Removed broad output-array coupling from key non-grid hooks by migrating to id lookups:
  `frontend/features/ai-studio/hooks/useAiStudioReferenceAssetActions.ts`,
  `frontend/features/ai-studio/hooks/useAiStudioAgentComposer.ts`,
  `frontend/features/ai-studio/hooks/useAiStudioAgentOrchestration.ts`,
  and page orchestration updates in `frontend/pages/ai-studio.tsx`.
- Split shell rendering into isolated boundaries:
  `frontend/features/ai-studio/components/AiStudioShellFrame.tsx`,
  `frontend/features/ai-studio/components/AiStudioToolbarRail.tsx`,
  `frontend/features/ai-studio/components/AiStudioPropertiesRail.tsx`,
  `frontend/features/ai-studio/components/AiStudioReferenceRail.tsx`,
  `frontend/features/ai-studio/components/AiStudioPreviewRail.tsx`,
  and refactored `frontend/features/ai-studio/components/AiStudioPageContent.tsx` to use them.
- Upgraded shell perf auditing in `frontend/pages/ai-studio.tsx` and `frontend/features/ai-studio/logic/perfAuditGates.ts`:
  scenarios now include `20/50/60/100/300`,
  section render/commit fields,
  non-grid rerender-per-status-tick metrics,
  and 60-reference shell gates.
- Added shell section render counter instrumentation in `frontend/features/ai-studio/logic/shellRenderCounters.ts`.
- Added RAF-based status flush + transition scheduling for non-urgent poll churn in `frontend/features/ai-studio/hooks/useAiStudioTasks.ts` behind `NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH`.
- Tuned dense-shell CSS cost controls in `frontend/styles/ai-studio-layout.css`.
- Added rollout flags to `frontend/.env.example`:
  `NEXT_PUBLIC_AI_STUDIO_OUTPUT_SELECTOR_STORE`,
  `NEXT_PUBLIC_AI_STUDIO_SHELL_BOUNDARY_SPLIT`,
  `NEXT_PUBLIC_AI_STUDIO_SELECTOR_CALLBACKS`,
  `NEXT_PUBLIC_AI_STUDIO_RAF_STATUS_FLUSH`.
- Added planning/architecture docs:
  `docs/archive/planning/ai-studio-shell-render-isolation-v3-plan.md`,
  `docs/adr/0015-ai-studio-selector-subscribed-shell-isolation.md`,
  and updated `docs/sops/sop_media_performance_operations.md`.
- Added and updated regression tests:
  `frontend/features/ai-studio/hooks/__tests__/aiStudioOutputStore.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentComposer.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceAssetActions.test.ts`,
  `frontend/features/ai-studio/hooks/__tests__/useAiStudioAgentOrchestration.test.ts`,
  `frontend/features/ai-studio/logic/__tests__/perfAuditGates.test.ts`.

## 2026-02-18 (AI Studio reference-grid performance profile freeze)

- Stabilized virtualization behavior for 40-60 reference sessions by tightening overscan at 40-59 and adding high-density max-column clamping in:
  `frontend/features/ai-studio/logic/referenceGridVirtualization.ts` and `frontend/features/ai-studio/components/ReferenceCanvas.tsx`.
- Fixed perf gate handling so missing reference-grid long-task samples (`null`) are treated as pass-with-note instead of false failure in:
  `frontend/features/ai-studio/logic/perfAuditGates.ts` and `frontend/features/ai-studio/logic/__tests__/perfAuditGates.test.ts`.
- Reduced audit contamination by switching long-task observers to live-only sampling (removed buffered history) in `frontend/pages/ai-studio.tsx`.
- Added production-opt-in perf harness runtime control (`NEXT_PUBLIC_AI_STUDIO_PERF_AUDIT_RUNTIME`) so release-mode audits can run intentionally while default production exposure remains off (`frontend/pages/ai-studio.tsx`, `frontend/.env.example`).
- Promoted the current reference-grid/shell stability profile to repo defaults in `frontend/.env.example`.
- Updated operational docs and ADR references for stable profile, production audit procedure, and rollback-safe runtime toggles:
  `docs/sops/sop_media_performance_operations.md`,
  `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`.

## 2026-02-18 (AI Studio perf gate automation + profile centralization)

- Added centralized AI Studio perf-profile flag resolver (`stable`/`legacy`) with explicit override support in:
  `frontend/features/ai-studio/logic/perfProfileFlags.ts`.
- Migrated performance-sensitive flag reads to shared profile constants across:
  `frontend/features/ai-studio/components/ReferenceCanvas.tsx`,
  `frontend/features/ai-studio/components/AiStudioPageContent.tsx`,
  `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`,
  `frontend/pages/ai-studio.tsx`.
- Added regression coverage for profile fallback/override behavior in:
  `frontend/features/ai-studio/logic/__tests__/perfProfileFlags.test.ts`.
- Added authenticated production-mode AI Studio perf audit runner:
  `frontend/tests/e2e/ai-studio-perf.audit.js`,
  npm script `test:perf:ai-studio`,
  and CI workflow job `ai_studio_perf_gate` in `.github/workflows/ci.yml`.
- Added CI skip-notice job `ai_studio_perf_gate_notice` so missing audit secrets are explicit in workflow summaries instead of silent skips.
- Updated env and SOP/ADR docs for profile-driven defaults and CI perf gating:
  `frontend/.env.example`,
  `docs/sops/sop_media_performance_operations.md`,
  `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`.

## 2026-02-18 (AI Studio perf governance polish)

- Added PR template perf-gate checklist items for AI Studio-impacting changes in `.github/pull_request_template.md`.
- Added invalid profile warning + stable fallback hardening for `NEXT_PUBLIC_AI_STUDIO_PERF_PROFILE` in `frontend/features/ai-studio/logic/perfProfileFlags.ts`.
- Added fallback behavior test coverage in `frontend/features/ai-studio/logic/__tests__/perfProfileFlags.test.ts`.

## 2026-02-18 (AI Studio perf gate staged enforcement hardening)

- Hardened CI perf gating in `.github/workflows/ci.yml` with PR change-scoping for AI Studio perf-impacting files, plus staged gate mode control via repository variable `AI_STUDIO_PERF_GATE_MODE` (`warn` or `enforce`).
- Updated operations guidance for CI gate scoping and staged enforcement rollout in `docs/sops/sop_media_performance_operations.md`.
- Updated ADR operational notes to document PR change-scoped perf gating and repository-variable enforcement mode in `docs/adr/0016-ai-studio-reference-grid-adaptive-delivery-and-watchdog.md`.

## 2026-02-18 (AI Studio perf release-check command)

- Added a single-command production perf release check script in `frontend/scripts/ai-studio-perf-release-check.mjs` that runs build/start/audit/teardown with explicit guardrails.
- Added npm script `perf:ai-studio:release-check` in `frontend/package.json`.
- Updated runbook docs to standardize usage and optional fast rerun/port overrides:
  `docs/sops/sop_media_performance_operations.md`,
  `docs/testing-guide.md`,
  `docs/local-development.md`.

## 2026-02-19 (Adaptive Media V2 phase verification checkpoint)

- Fixed adaptive hydration fallback/source matching in `frontend/features/ai-studio/components/ReferenceCanvas.tsx` so storage-key candidates are no longer treated as renderable URLs during hydration fallback resolution, eliminating stuck `loading preview...`/`generating...` cards in Quick Slot and Reference Grid drag/drop scenarios.
- Hardened optimized preview equivalence matching for `/_next/image` sources so hydration state remains stable across quick-slot and all-refs surfaces.
- Completed current regression gate run for this checkpoint:
  - `npm -C frontend run lint`
  - `npm -C frontend run type-check`
  - `npm -C frontend run test -- ReferenceCanvas.curated.test.tsx`
  - `npm -C frontend run test -- referenceGridMedia.test.ts referenceGridMedia.parity.test.ts`
  - `npm -C frontend run test -- MediaLibraryModal.test.tsx`
  - `npm -C frontend run test -- CharacterManagerShell.behavior.test.tsx`
- Updated rollout tracking artifacts:
  - `docs/planning/adaptive-media-v2-migration-checklist.md` (Phase 3 and Phase 5 verification marked complete + current QA status notes)
  - `docs/planning/backlog.md` (added non-blocking follow-up for rare one-off grid flash stabilization pass).

## 2026-02-19 (Adaptive Media V2 regression guardrails)

- Added dedicated adaptive regression gate script in `frontend/package.json`:
  - `test:adaptive-v2-gate`
  - runs lint/type-check plus targeted adaptive suites for Reference Grid, Media Library modal, Character Manager, parity, and policy.
- Added path-scoped CI job `adaptive_media_gate` in `.github/workflows/ci.yml`:
  - runs `test:adaptive-v2-gate` for PRs touching adaptive-critical paths
  - auto-skips with summary note when no adaptive-impacting files changed.
- Updated ownership/review policy in `.github/CODEOWNERS` with explicit Adaptive Media V2 critical path entries.
- Updated PR process in `.github/pull_request_template.md` with an Adaptive Media V2 gate checklist section.
- Added adaptive change-control SOP:
  - `docs/sops/sop_adaptive_media_change_control.md`
  - linked from `docs/sops/README.md` and referenced by `docs/sops/sop_media_performance_operations.md`.
- Added adaptive merge-gate skill:
  - `skills/adaptive-change-gate/SKILL.md`
  - documented in `docs/README.md` and `docs/agent-playbook.md`.

## 2026-02-19 (AI Studio Fal reliability rollout documentation kickoff)

- Added execution tracker `docs/planning/ai-studio-fal-reliability-rollout.md` with phase gates, acceptance criteria, rollout controls, kill switch, and test strategy for modular submit/retrieval rollout.
- Added ADR `docs/adr/0019-fal-modular-submit-retrieval-reliability.md` to lock architecture, alternatives, rollout constraints, and reversal criteria.
- Added migration artifacts for reliability state hardening:
  - `sql/migrations/019_add_generation_recovery_fields.sql`
  - `sql/migrations/rollback/019_add_generation_recovery_fields_rollback.sql`
- Updated operational docs for recovery/replay/rebuild route governance and incident runbook coverage:
  - `docs/api/api-internal-routes.md`
  - `docs/sops/sop_provider_incident_response.md`
  - `docs/sops/sop_ai_studio_index.md`
- Updated planning/schema/index docs for execution tracking and migration governance:
  - `docs/planning/backlog.md`
  - `docs/data-dictionary.md`
  - `docs/database-migrations.md`
  - `docs/planning/README.md`
  - `docs/README.md`
- Rollout phase completion status: no implementation phases are marked completed yet; per-phase gate outcomes and rollback decisions will be appended here as each phase closes.

## 2026-02-19 (AI Studio Fal reliability rollout Phase 1 + Phase 2 implementation)

- Implemented deterministic alias-sweep selection and retrieval hardening in the shared status proxy:
  - migrated payload parsing helpers into `frontend/lib/server/falIntegration/falAdapter.ts`
  - added deterministic status/result candidate ranking in `frontend/lib/server/falIntegration/retrievalEngine.ts`
  - updated `frontend/lib/server/api/falStatusProxy.ts` to complete alias sweeps before no-media settlement and prefer best media-bearing candidates.
- Implemented shared submit fallback chain support:
  - added submit target contracts in `frontend/lib/server/falIntegration/contracts.ts`
  - added submit fallback engine in `frontend/lib/server/falIntegration/submitEngine.ts`
  - extended `frontend/lib/server/api/falSubmitProxy.ts` to support ordered `submitTargets` with deterministic fallback semantics.
- Removed bespoke Veo image-to-video route logic and migrated both routes to shared proxies:
  - `frontend/pages/api/fal/veo-image-to-video-submit.ts`
  - `frontend/pages/api/fal/veo-image-to-video-status.ts`
  - added shared Veo profile/alias registry entry in `frontend/lib/server/falIntegration/modelProfiles.ts`.
- Added/updated regression tests:
  - `frontend/tests/api/fal-status-proxy.test.ts` (alias conflict + media precedence case)
  - `frontend/tests/api/fal-submit-proxy.test.ts` (submit fallback chain behavior).
- Validation evidence:
  - `npm -C frontend run test -- tests/api/fal-status-proxy.test.ts tests/api/fal-submit-proxy.test.ts`
  - `npm -C frontend run lint`
  - `npm -C frontend run type-check`

## 2026-02-19 (AI Studio generation runtime stabilization pivot documentation)

- Added stabilization execution addendum:
  - `docs/planning/ai-studio-generation-runtime-stabilization.md`
- Updated primary reliability rollout tracker with explicit pivot section and execution constraints:
  - `docs/planning/ai-studio-fal-reliability-rollout.md`
- Updated AI Studio backlog with stabilization tasks S0-S4:
  - `docs/planning/backlog.md`
- Purpose of this pivot:
  - stop ad-hoc generation patching,
  - enforce one runtime boundary for submit/retrieve/persist/billing flow,
  - gate further phase expansion until golden-path reliability is proven.

## 2026-02-19 (AI Studio generation runtime stabilization S0 traceability implementation)

- Added submission/generation trace identifiers to AI Studio output lifecycle and persistence metadata:
  - `frontend/features/ai-studio/types.ts`
  - `frontend/features/ai-studio/logic/ids.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioTaskSubmission.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioTaskOrchestration.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`
- Added admin generation trace API endpoint for stitched timeline debugging by `generationId`, `requestId`, or `traceId`:
  - `frontend/pages/api/admin/generation-trace.ts`
  - `frontend/tests/api/admin-generation-trace.test.ts`
- Added a local operator UI surface for trace inspection:
  - `frontend/pages/admin/generation-trace.tsx`
  - linked from `frontend/pages/admin/index.tsx`
- Updated internal API docs:
  - `docs/api/api-internal-routes.md`
- Validation evidence:
  - `npm -C frontend run test -- admin-generation-trace useAiStudioTaskSubmission useAiStudioTaskOrchestration useAiStudioTasks`
  - `npm -C frontend run type-check`
  - `npm -C frontend run lint`

## 2026-02-19 (AI Studio generation runtime stabilization S1 persistence + replay recovery)

- Added server-authoritative generation persistence at submit time so successful Fal submits always create/attach an `ai_generations` row:
  - `frontend/lib/server/api/generationSubmitPersistence.ts`
  - wired via `frontend/lib/server/api/falSubmitProxy.ts`
  - regression coverage in `frontend/tests/api/fal-submit-proxy.test.ts`.
- Hardened client generation-linking to avoid duplicate generation rows by reusing existing records by `request_id`:
  - `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPersistenceActions.ts`.
- Improved admin generation trace resilience and discoverability:
  - fallback when `ai_generations` recovery columns are missing (legacy schema compatibility),
  - trace lookup by `metadata.source_ref`,
  - coverage updates in `frontend/tests/api/admin-generation-trace.test.ts`.
- Added operator replay route for stuck Fal generations:
  - `POST /api/admin/generation-recovery/replay`
  - source: `frontend/pages/api/admin/generation-recovery/replay.ts`
  - behavior: resolve generation by `generationId`/`requestId`, re-poll provider aliases, persist recovered media to storage + `media_files`, and repair `ai_generations` status/recovery metadata.
  - tests: `frontend/tests/api/admin-generation-recovery-replay.test.ts`.
- Updated migration 019 for safe rollout on dirty historical data:
  - `sql/migrations/019_add_generation_recovery_fields.sql`
  - now deduplicates `(user_id, request_id)` rows deterministically before creating unique index.
- Updated internal route docs:
  - `docs/api/api-internal-routes.md` (moved replay route from planned to implemented).
- Validation evidence:
  - `npm -C frontend run test -- admin-generation-recovery-replay admin-generation-trace fal-submit-proxy useAiStudioTaskSubmission useAiStudioTaskOrchestration useAiStudioTasks`
  - `npm -C frontend run type-check`
  - `npm -C frontend run lint`

## 2026-02-19 (AI Studio stabilization scope note: runtime admission control + rate-limit protection)

- Updated stabilization addendum to explicitly mark generation capacity/rate-limit resilience as in-scope:
  - `docs/planning/ai-studio-generation-runtime-stabilization.md`
  - added `Capacity and Rate-limit Protection (In Scope)` section with:
    - runtime per-user/per-model submit caps,
    - provider `429`/`5xx` retry/backoff with jitter and `Retry-After`,
    - lightweight per-model circuit-breaker behavior,
    - explicit deferral of full durable internal queue architecture until after S1/S2 gates.
- Updated backlog tracking so rate-limit protection is a visible pre-canary requirement:
  - `docs/planning/backlog.md`

## 2026-02-20

- Locked AI Studio generation runtime v2 execution and governance: added ADR `0020` plus authoritative planning/audit docs (`docs/planning/ai-studio-generation-runtime-v2-locked-execution.md`, `docs/planning/ai-studio-generation-runtime-audit-2026-02-20.md`) and archived superseded planning docs.
- Implemented server runtime flag wiring (`frontend/lib/server/api/falRuntimeFlags.ts`) and documented rollout flags in `frontend/.env.example`, `docs/deployment.md`, and API/SOP references.
- Unified Fal terminal billing settlement to one API (`settleGenerationOutcome`) and switched status proxy settlement to the unified path; direct-debit fallback is now emergency-only via `SHORTPULSE_FAL_DIRECT_DEBIT_FALLBACK_ENABLED`.
- Added webhook-first Fal ingestion route (`POST /api/fal/webhook`) with signature verification helper (`frontend/lib/server/api/falWebhook.ts`) and explicit proxy webhook exception.
- Added protected internal reconciler trigger route (`POST /api/internal/generation-recovery/run`) with `x-shortpulse-cron-secret` auth and runtime-flag-gated claim/requeue/exhaust logic.
- Removed runtime missing-column fallback behavior in generation persistence paths (`generationSubmitPersistence` and admin replay update path) to align with schema convergence requirements.
- Added SQL migrations `020`-`023` for recovery convergence, status transition enforcement, persistence idempotency index, and `SKIP LOCKED` reconciler claim function.
- Expanded test coverage for new auth boundaries/routes and updated status-proxy settlement tests to the unified settlement API.

## 2026-02-20 (runtime v2 audit-corrected implementation)

- Implemented Fal webhook verification cutover controls with JWKS/Ed25519 support and dual-mode fallback (`SHORTPULSE_FAL_WEBHOOK_VERIFY_MODE`, `SHORTPULSE_FAL_WEBHOOK_JWKS_URL`), plus callback-base wiring (`SHORTPULSE_PUBLIC_API_BASE_URL`) and submit-time `fal_webhook` registration.
- Added durable webhook inbox/idempotency pipeline and migrations `024_fal_webhook_inbox.sql` (+ rollback), and rewired `/api/fal/webhook` to ingest event records before terminal side effects.
- Added shared runtime recovery execution engine (`frontend/lib/server/falIntegration/recoveryExecution.ts`) and wired webhook, status proxy terminal sync, internal reconciler, and admin replay to the same execution path.
- Added lease-based reconciler claims migration `025_generation_recovery_leases.sql` (+ rollback) and guarded recovery transition migration `026_generation_recovery_transition_guards.sql` (+ rollback).
- Completed thin-client lifecycle cutover by removing client-side generation lifecycle writes from AI Studio orchestration hooks/persistence flow.
- Added/updated tests for Fal webhook signature verification, webhook route ingestion path, reconciler execution route, status proxy integration, submit proxy behavior, and orchestration hook behavior; lint + type-check passing.
- Updated runtime docs/indices (planning, ADR, API/internal routes, deployment, data dictionary, migration docs, schema snapshot, and env example) to reflect the new source of truth.

## 2026-02-20 (governance realignment foundation)

- Added governance rollout artifacts under `docs/planning/` for inventory, overlap audit, feasibility, master rollout proposal, stage execution docs, CI policy checks, implementation tracker, and final validation summary.
- Added forward SQL hardening migration `sql/migrations/028_harden_ai_agent_conversation_state_security.sql` plus rollback pair for conversation-state retention clamps, deterministic pruning, service-role execute posture, and cleanup helper function.
- Updated migration/security/data-dictionary/runbook docs to include `018` + `028` conversation-state contracts and bounded retention policy.
- Introduced docs governance automation scripts: `scripts/check_docs_semantic_drift.js`, `scripts/check_migration_doc_parity.js`, and `scripts/check_archive_manifest.js`; wired into `npm -C frontend run docs:check`.
- Added CI jobs `docs_semantic_drift`, `migration_parity`, `archive_manifest_check`, and `sql_lint` with warn/enforce mode toggles.
- Aligned active architecture guidance by removing stale client-only wording from `README.md` and `frontend/AGENTS.md`.

## 2026-02-23

- Added the documentation-first Reference Grid Foundation Program package:
  - `docs/planning/ai-studio-reference-grid-modularization-program.md`
  - `docs/planning/ai-studio-reference-grid-modularization-tracker.md`
  - `docs/planning/evidence/reference-grid-modularization/README.md`
  - `docs/planning/evidence/reference-grid-modularization/phase-report-template.md`
  - phase evidence folders `phase-0` through `phase-6`
- Added `docs/adr/0022-reference-grid-domain-modular-architecture.md` to formalize modular domain boundaries and strangler migration contracts.
- Updated SOP governance for reference-grid modularization controls:
  - `docs/sops/sop_media_performance_operations.md`
  - `docs/sops/sop_adaptive_media_change_control.md`
  - `docs/sops/sop_ai_studio_index.md`
- Updated documentation indexes for discoverability:
  - `docs/planning/README.md`
  - `docs/README.md`
  - `docs/adr/README.md`
- Expanded guardrail scripts for reference-grid modularization rollout lanes:
  - `scripts/check_architecture_boundaries.js`
  - `scripts/check_size_budgets.js`
- Added CI env wiring for staged reference-grid guardrail modes in `.github/workflows/ci.yml`:
  - `REFERENCE_GRID_BOUNDARY_MODE`
  - `REFERENCE_GRID_SIZE_BUDGET_MODE`
- Began Reference Grid Foundation Program Phase 1 implementation:
  - Added canonical reference-domain modules under `frontend/features/ai-studio/reference-domain/` (`types`, `reducer`, `selectors`, `adapters`, `index`).
  - Added domain unit coverage: `referenceDomain.reducer.test.ts` and `referenceDomain.adapters.test.ts`.
  - Adopted shared output collection normalization helpers in `frontend/features/ai-studio/hooks/useAiStudioState.ts` to start runtime-safe migration with behavior parity.
- Added phase evidence artifact: `docs/planning/evidence/reference-grid-modularization/phase-1/2026-02-23-phase-01-domain-core-foundation.md`.
- Updated tracker state to reflect Phase 0 completion and Phase 1 progress in `docs/planning/ai-studio-reference-grid-modularization-tracker.md`.
- Implemented Reference Grid Foundation Program Phase 2 ingestion unification:
  - Added canonical ingestion module `frontend/features/ai-studio/reference-ingestion/` with source-tagged `ReferenceIngestionInput` contracts and unified builder (`buildStudioOutputsFromReferenceInput`).
  - Routed ingestion entrypoints in `frontend/features/ai-studio/hooks/useAiStudioState.ts` (file add, paste prompt/media, library media/prompt, agent prompt) through the canonical ingestion adapter.
  - Added ingestion acceptance-matrix tests in `frontend/features/ai-studio/reference-ingestion/__tests__/buildFromInput.test.ts` and validated no-regression targeted suites.
- Added phase evidence artifact: `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-ingestion-unification-foundation.md`.
- Updated tracker progress for phase alignment in `docs/planning/ai-studio-reference-grid-modularization-tracker.md`.
- Added phase-2 post-implementation audit + external benchmark artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-post-implementation-audit-and-external-benchmark.md`
  - Captures residual ingress/projection deltas and official best-practice comparison links before Phase 3 promotion.
- Applied Phase 2 ingestion hardening before Phase 3 kickoff:
  - preserved library-media full-vs-preview URL intent in canonical ingestion (`resultUrls` carries full URL hint while `previewUrl` remains preview contract).
  - propagated picker/drop source through file ingestion mapping and added source parity coverage.
  - normalized duplicate file handling across picker/drop uploads in `mapUploadsFromFiles`.
  - corrected media-library selection payload to preserve `previewStoragePath` and `fullStoragePath` separation.
- Added hardening evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-hardening-ingestion-contract-parity.md`
- Closed remaining Phase 2 kickoff-hold deltas:
  - added keyboard quick-slot reorder path on curated cards (`ArrowUp` / `ArrowDown`) with curated interaction tests.
  - added integration coverage for media-library add -> quick-slot reorder/remove -> archive overflow -> restore lifecycle.
- Added hold-closure evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-2/2026-02-23-phase-02-hold-closure-integration-and-keyboard-parity.md`
- Started Phase 3 projection-semantics foundation:
  - added `frontend/features/ai-studio/reference-projections/` module (state contracts, transitions, selectors, compatibility adapter, unit tests).
  - rewired curated delete suppression in `useAiStudioState` to explicit projection-state transitions with legacy hidden-flag compatibility mirroring.
  - updated output-store bridge tests for projection-based suppression behavior.
- Added phase-3 foundation evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-3/2026-02-23-phase-03-projection-semantics-foundation.md`
- Closed Phase 3 projection semantics:
  - wired explicit `removedFromAllRefsIds` projection state through `useAiStudioState` -> page wiring -> `ReferenceCanvas`.
  - switched all-refs visibility computation in `ReferenceCanvas` to projection selector contracts with legacy fallback compatibility.
  - removed implicit hidden-delete cleanup coupling and finalized suppressed deletions on quick-slot detach via lifecycle path.
  - expanded parity coverage for explicit suppression behavior in projection, canvas curated, and state output-store bridge suites.
- Added phase-3 closeout evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-3/2026-02-23-phase-03-projection-semantics-closeout.md`
- Started Phase 4 media runtime unification with shared runtime policy foundation:
  - added `frontend/lib/mediaPreviewRuntimePolicy.ts` for centralized sign-budget resolution and retry-cap helpers.
  - rewired `frontend/features/media-library/logic/mediaLibraryPageHelpers.ts` route budget resolution to the shared policy module.
  - rewired modal/route preview-error retry gates and modal sign-batch cap checks to shared policy helpers:
    - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
    - `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`
  - added dedicated policy unit tests:
    - `frontend/features/media-library/logic/__tests__/mediaPreviewRuntimePolicy.test.ts`
- Added phase-4 foundation evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-runtime-unification-foundation.md`
- Continued Phase 4 media runtime unification (slice 2 controller parity):
  - generalized `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts` with configurable surface/relevance/enabled/cap options.
  - removed duplicated sign-pass runtime effect from `frontend/features/ai-studio/components/MediaLibraryModal.tsx` and routed modal signing passes through the shared controller hook.
  - preserved modal no-regression sign-attempt cap via shared controller option (`maxSignAttemptsPerItem`) and shared policy constant.
  - added controller test coverage for signing-pass enable gating in `frontend/features/media-library/hooks/__tests__/useMediaPreviewSigningController.test.ts`.
- Added phase-4 slice-2 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-runtime-controller-parity-slice-2.md`
- Continued Phase 4 media runtime unification (slice 3 preview-recovery parity):
  - added shared recovery controller `frontend/features/media-library/hooks/useMediaPreviewRecoveryController.ts` for signed-url refresh, retry-cap handling, and hydrate fallback.
  - rewired route runtime (`frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`) and modal runtime (`frontend/features/ai-studio/components/MediaLibraryModal.tsx`) to shared recovery callbacks.
  - preserved modal optimizer fallback behavior using controller `beforeRetry` callback seam.
  - added shared recovery controller tests in `frontend/features/media-library/hooks/__tests__/useMediaPreviewRecoveryController.test.ts`.
- Added phase-4 slice-3 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-preview-recovery-controller-slice-3.md`
- Continued Phase 4 media runtime unification (slice 4 preview-resolver API parity):
  - added shared preview resolver module `frontend/features/media-library/logic/mediaPreviewResolver.ts` for `/api/media/resolve-previews` request/response normalization.
  - rewired route and modal unresolved-preview resolver callbacks to shared helper:
    - `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`
    - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
  - added shared resolver unit tests in `frontend/features/media-library/logic/__tests__/mediaPreviewResolver.test.ts`.
- Added phase-4 slice-4 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-preview-resolver-api-parity-slice-4.md`
- Continued Phase 4 media runtime unification (slice 5 selection-url resolver parity):
  - rewired modal media selection URL signing in `frontend/features/ai-studio/components/MediaLibraryModal.tsx` to shared helper `resolveSignedSelectionUrl` from `frontend/features/media-library/logic/mediaPreviewResolver.ts`.
  - removed duplicated modal selection signing candidate logic while preserving canonical `storage_path` priority and fallback behavior.
  - expanded shared resolver tests for canonical-first ordering, fallback signing, and deduped candidate resolution in `frontend/features/media-library/logic/__tests__/mediaPreviewResolver.test.ts`.
- Added phase-4 slice-5 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-selection-url-resolver-parity-slice-5.md`
- Continued Phase 4 media runtime unification (slice 6 shared runtime helper parity):
  - added `frontend/features/media-library/logic/mediaPreviewRuntimeShared.ts` for shared sign-path resolution, resolve-previews application, and storage-download hydration helpers.
  - rewired both modal and route runtime callbacks to shared helpers:
    - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
    - `frontend/features/media-library/hooks/useMediaPreviewRuntime.ts`
  - added shared helper tests in `frontend/features/media-library/logic/__tests__/mediaPreviewRuntimeShared.test.ts`.
- Closed Phase 4 media runtime unification:
  - marked phase checklist + exit validation complete and resolved runtime parity blocker (`RG-DEP-03`) in `docs/planning/ai-studio-reference-grid-modularization-tracker.md`.
  - aligned tracker risk state by marking modal/route runtime divergence (`Risk #4`) as `Mitigated`.
  - added closeout evidence artifact:
    - `docs/planning/evidence/reference-grid-modularization/phase-4/2026-02-23-phase-04-media-runtime-unification-closeout.md`
- Started Phase 5 canvas + state decomposition (slice 1 foundation):
  - extracted reference-card rendering from `frontend/features/ai-studio/components/ReferenceCanvas.tsx` into `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasCard.tsx`.
  - extracted clipboard/paste parsing and media normalization into `frontend/features/ai-studio/reference-grid/controllers/referenceGridClipboard.ts`.
  - added controller unit coverage at `frontend/features/ai-studio/reference-grid/controllers/__tests__/referenceGridClipboard.test.ts`.
  - reduced `ReferenceCanvas.tsx` from 3489 lines to 2902 lines while preserving behavior parity in existing ReferenceCanvas suites.
- Added phase-5 slice-1 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-foundation-slice-1.md`
- Continued Phase 5 canvas decomposition (slice 2 controller extraction):
  - extracted document-level paste capture and pointer priming controller into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridClipboardController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume controller hook callbacks and removed in-component document listener orchestration for clipboard/pointer handling.
  - preserved no-regression behavior in existing ReferenceCanvas paste/curated/selector suites.
- Added phase-5 slice-2 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-controller-slice-2.md`
- Continued Phase 5 canvas decomposition (slice 3 drop-controller extraction):
  - extracted canvas drag/drop orchestration and document drag cleanup listeners into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCanvasDropController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed drop handlers.
  - preserved no-regression behavior in ReferenceCanvas and AI Studio page drop-path suites.
- Added phase-5 slice-3 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-drop-controller-slice-3.md`
- Continued Phase 5 canvas decomposition (slice 4 curated-controller extraction):
  - extracted curated quick-slot drag/drop and keyboard reorder orchestration into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCuratedDndController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume curated controller hook callbacks.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites and AI Studio drop-path suite.
- Added phase-5 slice-4 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-curated-controller-slice-4.md`
- Continued Phase 5 canvas decomposition (slice 5 scroll-controller extraction):
  - extracted all-refs/curated scroll orchestration (RAF-throttled virtual metrics updates + scroll telemetry sampling) into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridScrollController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed `handleAllRefsScroll` and `handleCuratedScroll` callbacks.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-5 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-scroll-controller-slice-5.md`
- Continued Phase 5 canvas decomposition (slice 6 virtual-metrics controller extraction):
  - extracted virtual grid measurement and resize-observer orchestration into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVirtualMetricsController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed virtual-metrics orchestration for all-refs and quick-slot surfaces.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-6 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-virtual-metrics-controller-slice-6.md`
- Continued Phase 5 canvas decomposition (slice 7 video-lifecycle controller extraction):
  - extracted video node registration, visibility observer lifecycle, stale-node pruning, and autoplay detach cleanup into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridVideoLifecycleController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed `registerVideoNode` and lifecycle orchestration.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-7 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-video-lifecycle-controller-slice-7.md`
- Continued Phase 5 canvas decomposition (slice 8 autoplay-budget controller extraction):
  - extracted responsive/network/device autoplay budget policy orchestration into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplayBudgetController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed autoplay budget runtime policy.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-8 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-autoplay-budget-controller-slice-8.md`
- Continued Phase 5 canvas decomposition (slice 9 telemetry controller extraction):
  - extracted render-commit, longtask observer, and telemetry-backpressure policy effects into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridTelemetryController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed telemetry orchestration.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-9 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-telemetry-controller-slice-9.md`
- Continued Phase 5 canvas decomposition (slice 10 autoplay-events controller extraction):
  - extracted autoplay started/stopped telemetry handlers into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplayEventController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed autoplay event callbacks.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-10 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-autoplay-events-controller-slice-10.md`
- Continued Phase 5 canvas decomposition (slice 11 archive-controls component extraction):
  - extracted header/archive inline/archive panel presentation into `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasArchiveControls.tsx`.
  - rewired split and non-split `ReferenceCanvas` surfaces to consume shared archive controls component.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-11 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-archive-controls-component-slice-11.md`
- Continued Phase 5 canvas decomposition (slice 12 card-drag controller extraction):
  - extracted card drag start/end protocol handlers into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardDragController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed card drag handlers.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-12 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-card-drag-controller-slice-12.md`
- Continued Phase 5 canvas decomposition (slice 13 loaded-media controller extraction):
  - extracted loaded-media callback bookkeeping and notification fan-out into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridLoadedMediaController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed `markLoaded` callback.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-13 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-loaded-media-controller-slice-13.md`
- Continued Phase 5 canvas decomposition (slice 14 sections component extraction):
  - extracted split/non-split quick-slot/all-refs layout rendering into `frontend/features/ai-studio/reference-grid/components/ReferenceCanvasSections.tsx`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to pass section view-model props and rendered card nodes into shared sections component.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-14 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-sections-component-slice-14.md`
- Continued Phase 5 canvas decomposition (slice 15 card-render controller extraction):
  - extracted per-card action wiring and curated/all-refs card-node mapping into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed `curatedCardNodes` and `allRefsCardNodes`.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-15 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-card-render-controller-slice-15.md`
- Continued Phase 5 canvas decomposition (slice 16 preview-swap telemetry controller extraction):
  - extracted preview swap metric tracking/reset effects into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridPreviewSwapTelemetryController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed preview swap telemetry orchestration.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-16 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-preview-swap-telemetry-controller-slice-16.md`
- Continued Phase 5 canvas decomposition (slice 17 loading-visual controller extraction):
  - extracted loading/spinner derivation into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridLoadingVisualController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed loading/spinner sets and loading count.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-17 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-loading-visual-controller-slice-17.md`
- Continued Phase 5 canvas decomposition (slice 18 autoplay-selection controller extraction):
  - extracted visible-video prioritization, autoplay-enabled id selection, and related runtime ref-sync effects into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridAutoplaySelectionController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed autoplay selection orchestration.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-18 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-autoplay-selection-controller-slice-18.md`
- Continued Phase 5 canvas decomposition (slice 19 drop-helpers controller extraction):
  - extracted media-file normalization, drop-mode detection, and FileList helper primitives into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridDropHelpersController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed drop helper callbacks.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites.
- Added phase-5 slice-19 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-drop-helpers-controller-slice-19.md`
- Continued Phase 5 canvas decomposition (slice 20 image-hydration controller extraction):
  - extracted hydration queue/decode runtime, adaptive local transcode path, stale-id pruning, and hydration object URL cleanup into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed `imageHydrationState`, `enqueueImageHydration`, and queue-prune API.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites, AI Studio drop-path suite, and adaptive v2 gate.
- Added phase-5 slice-20 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-image-hydration-controller-slice-20.md`
- Continued Phase 5 canvas decomposition (slice 21 viewport-projection controller extraction):
  - extracted virtual-window derivation, hard viewport cap projection, visible slices, spacer heights, and near-viewport derivation into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridViewportProjectionController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed projection outputs.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites and AI Studio drop-path suite.
- Added phase-5 slice-21 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-viewport-projection-controller-slice-21.md`
- Continued Phase 5 canvas decomposition (slice 22 card-items controller extraction):
  - extracted visible card-item URL/preview derivation, hydration-source matching, and transformed adaptive preview counting into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardItemsController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed card-item derivations.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites and AI Studio drop-path suite.
- Added phase-5 slice-22 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-card-items-controller-slice-22.md`
- Continued Phase 5 canvas decomposition (slice 23 hydration-queue controller extraction):
  - extracted active/visible/near-viewport hydration enqueue scheduling and queue-prune orchestration into `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridHydrationQueueController.ts`.
  - rewired `frontend/features/ai-studio/components/ReferenceCanvas.tsx` to consume hook-managed hydration queue scheduling.
  - preserved no-regression behavior in ReferenceCanvas curated/paste/selector suites and AI Studio drop-path suite.
- Added phase-5 slice-23 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-decomposition-hydration-queue-controller-slice-23.md`
- Continued Phase 5 decomposition (slice 24 media-library-modal extraction):
  - extracted Media Library modal model/types/constants/helpers into `frontend/features/ai-studio/logic/mediaLibraryModalModel.ts`.
  - extracted prompt/media grid rendering and modal chrome controls into:
    - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryPromptGrid.tsx`
    - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryMediaGrid.tsx`
    - `frontend/features/ai-studio/components/media-library-modal/MediaLibraryModalControls.tsx`
  - rewired `frontend/features/ai-studio/components/MediaLibraryModal.tsx` to consume extracted modules while preserving behavior.
  - reduced `MediaLibraryModal.tsx` to 796 lines (under the 800-line size target).
- Added phase-5 slice-24 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-media-library-modal-decomposition-slice-24.md`
- Continued Phase 5 decomposition (slice 25 ai-studio-state reference-ingestion actions extraction):
  - extracted agent/paste/library/file ingestion callbacks and agent-context projection into `frontend/features/ai-studio/hooks/useAiStudioReferenceIngestionActions.ts`.
  - rewired `frontend/features/ai-studio/hooks/useAiStudioState.ts` to consume hook-managed ingestion actions.
- Added phase-5 slice-25 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-ai-studio-state-reference-ingestion-actions-slice-25.md`
- Continued Phase 5 decomposition (slice 26 ai-studio-state reference-grid actions extraction):
  - extracted soft-archive/restore + curated projection action bundle into `frontend/features/ai-studio/hooks/useAiStudioReferenceGridStateActions.ts`.
  - rewired `frontend/features/ai-studio/hooks/useAiStudioState.ts` to consume hook-managed archive/projection actions.
- Added phase-5 slice-26 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-ai-studio-state-reference-grid-actions-slice-26.md`
- Continued Phase 5 decomposition (slice 27 ai-studio-state object-url lifecycle extraction):
  - extracted output blob URL tracking and revocation lifecycle into `frontend/features/ai-studio/hooks/useAiStudioOutputObjectUrlLifecycle.ts`.
  - rewired `frontend/features/ai-studio/hooks/useAiStudioState.ts` to consume hook-managed object URL lifecycle.
  - reduced `useAiStudioState.ts` to 872 lines.
- Added phase-5 slice-27 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-ai-studio-state-object-url-lifecycle-slice-27.md`

## 2026-02-23 (reference-grid phase 5 slice 28 + closeout)

- Continued Phase 5 decomposition by extracting `useAiStudioState` output/store bridge, projection lifecycle effects, model-option derivation, optimistic placeholder actions, and output-store selector wrappers into dedicated hooks.
- Rewired `frontend/features/ai-studio/hooks/useAiStudioState.ts` to consume extracted hooks while preserving no-regression behavior and selector-store compatibility.
- Closed target hotspot size budgets: `ReferenceCanvas.tsx` 834 (<=900), `MediaLibraryModal.tsx` 796 (<=800), and `useAiStudioState.ts` 641 (<=650).
- Added Phase 5 slice-28 evidence and Phase 5 closeout artifacts:
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-ai-studio-state-output-collection-and-projection-effects-slice-28.md`
  - `docs/planning/evidence/reference-grid-modularization/phase-5/2026-02-23-phase-05-canvas-and-state-decomposition-closeout.md`
- Updated tracker to mark Phase 5 complete and link new evidence artifacts.

## 2026-02-23 (reference-grid phase 6 slice 1)

- Started Phase 6 guardrail cleanup by fixing CI wrapper mode resolution for `architecture_boundary` and `size_budget` so reference-grid enforce-mode flags cannot be masked by global warn-mode wrappers.
- Updated `.github/workflows/ci.yml` to derive `EFFECTIVE_MODE` from both global and reference-grid gate variables for boundary and size checks.
- Added Phase 6 slice-1 evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-guardrail-effective-mode-alignment-slice-1.md`

## 2026-02-23 (reference-grid phase 6 slice 2)

- Added Phase 6 enforce-cycle preflight evidence after two consecutive local green cycles under enforce-mode boundary and size settings.
- Captured promotion-ready status for reference-grid guardrails pending CI repository-variable toggle and enforce-cycle capture.
- Added evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-enforce-cycle-preflight-slice-2.md`

## 2026-02-23 (reference-grid phase 6 slice 3)

- Retired temporary compatibility toggle `NEXT_PUBLIC_REFERENCE_GRID_NORMALIZED_STATE` and removed its fallback branch from `useAiStudioState`; normalized output fast-path is now always on.
- Updated operational/env docs to remove the retired flag reference:
  - `frontend/.env.example`
  - `docs/sops/sop_media_performance_operations.md`
  - `docs/troubleshooting.md`
- Added evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-dead-flag-retirement-normalized-state-slice-3.md`

## 2026-02-23 (reference-grid phase 6 slice 4)

- Promoted repository guardrail variables to enforce mode for `sleepyseamonster/ShortPulse`:
  - `REFERENCE_GRID_BOUNDARY_MODE=enforce`
  - `REFERENCE_GRID_SIZE_BUDGET_MODE=enforce`
- Captured enforcement promotion evidence:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-repo-variable-enforce-promotion-slice-4.md`

## 2026-02-23 (reference-grid phase 6 slice 5)

- Added `workflow_dispatch` trigger to `.github/workflows/ci.yml` as a temporary CI control-plane unblock to capture required Phase 6 enforce-cycle evidence on `reference-grid-audit`.
- Added evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-ci-dispatch-unblock-slice-5.md`

## 2026-02-23 (reference-grid phase 6 slice 6)

- Fixed CI deadcode failure by removing obsolete legacy adapter and orphan test:
  - deleted `frontend/features/ai-studio/hooks/stateAdapters/agentReferenceOutputs.ts`
  - deleted `frontend/features/ai-studio/hooks/stateAdapters/__tests__/agentReferenceOutputs.test.ts`
- Added evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-deadcode-remediation-agent-reference-adapter-slice-6.md`

## 2026-02-23 (reference-grid phase 6 closeout)

- Completed Phase 6 guardrails/cleanup and marked the reference-grid modularization program complete.
- Captured two successful CI enforce cycles on `reference-grid-audit` after promotion and cleanup:
  - run `22314518609` (success)
  - run `22314737402` (success)
- Added Phase 6 closeout evidence artifact:
  - `docs/planning/evidence/reference-grid-modularization/phase-6/2026-02-23-phase-06-guardrails-and-cleanup-closeout.md`

## 2026-02-24 (AI Studio agent failure-path hardening)

- Added shared failure-policy module `frontend/features/agent-runtime/studioAgentFailurePolicy.ts` to centralize failure classification (`safety_refusal`, `infra_transient`, `infra_runtime`, `auth_config`, `invalid_request`), user-lane resolution, and bounded retry backoff+jitter helpers.
- Hardened `/api/ai/studio-agent` coordinator to:
  - apply bounded retries for transient upstream failures,
  - keep safety refusal + SFW rewrite behavior,
  - return assistant fallback success payloads (`200`) for runtime/provider failure lanes,
  - preserve explicit non-200 errors for auth/config/invalid-request lanes,
  - emit telemetry for fallback outcomes (`outcome_class: fallback_infra`) with retry metadata.
- Hardened `/api/ai/describe-image` legacy service to mirror the same user-lane policy: safety refusal/rewrite as success, runtime/provider failures as safe fallback description (`200`), explicit non-200 for validation/auth/config errors.
- Expanded regression coverage:
  - `frontend/features/agent-runtime/__tests__/studioAgentFailurePolicy.test.ts`
  - `frontend/tests/api/studio-agent.runtime.test.ts`
  - `frontend/tests/api/describe-image.route.test.ts`
  - `frontend/features/ai-agent/__tests__/useAiAgent.test.ts`
- Updated ops docs to reflect the new failure contract:
  - `docs/sops/sop_ai_studio_agent.md`
  - `docs/sops/sop_ai_studio_agent_chat_ops.md`

## 2026-02-24 (AI Studio reliability hardening follow-up)

- Normalized fast-path transport throws into classified failure objects in `frontend/features/agent-runtime/studioAgentFastPathTurn.ts` so coordinator retries/fallback policy handles throw and non-throw failures consistently.
- Split runtime timeout budgets in `frontend/features/agent-runtime/studioAgentOpenAiGateway.ts` and `/api/ai/studio-agent` wiring:
  - added `STUDIO_AGENT_VISION_TIMEOUT_MS`
  - added `STUDIO_AGENT_TURN_TIMEOUT_MS`
  - preserved backward compatibility by inheriting `STUDIO_AGENT_TIMEOUT_MS` when split values are unset.
- Updated coordinator turn execution to use dedicated turn budget (`turnTimeoutMs`) for fast-path and v2 generation lanes (`frontend/features/agent-runtime/studioAgentCoordinator.ts`).
- Hardened reference-grid optimizer failover in `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridImageHydrationController.ts` by adding session-level source fail cache and failover telemetry counters; emitted through existing telemetry controller path.
- Replaced drag ghost clone-and-strip with a dedicated ghost builder in `frontend/features/ai-studio/utils/dragDrop.ts` and added defensive dragging CSS suppression for action overlays in `frontend/styles/ai-studio-canvas.css`.
- Added provider-download timeout/abort handling in `frontend/features/ai-studio/logic/referenceDownload.ts` and kept hook orchestration focused in `frontend/features/ai-studio/hooks/useAiStudioReferenceAssetActions.ts`.
- Expanded regression coverage:
  - `frontend/features/agent-runtime/__tests__/studioAgentFastPathTurn.test.ts`
  - `frontend/features/agent-runtime/__tests__/studioAgentOpenAiGateway.test.ts`
  - `frontend/tests/api/studio-agent.runtime.test.ts`
  - `frontend/features/ai-studio/utils/__tests__/dragDrop.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceAssetActions.test.ts`
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
- Added evidence note:
  - `docs/records/evidence/agent/phase-5/2026-02-24-phase-5-runtime-timeout-split-and-failover-hardening.md`

## 2026-02-24 (AI Studio default-model foundation + reliability delta closeout)

- Added canonical Create model-selection policy module:
  - `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`
  - centralizes Create/Image filtering and startup default precedence.
- Wired shared policy into AI Studio hooks:
  - `frontend/features/ai-studio/hooks/useAiStudioAllowedModelOptions.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPageDerivations.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts`
- Locked Create startup restore precedence:
  - preserve valid saved model
  - fallback to `fal-ai/bytedance/seedream/v4.5/text-to-image` when saved model is missing/invalid for Create + Image.
- Hardened residual parse/body exception paths:
  - `frontend/features/agent-runtime/studioAgentFastPathTurn.ts`
  - `frontend/features/ai-agent/logic/studioAgentThinkerFormatter.ts`
  - parse/body-read failures now normalize to typed stage failures instead of bubbling to route-level exceptions.
- Expanded regression coverage:
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageDerivations.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioTaskSubmission.test.ts`
  - `frontend/features/agent-runtime/__tests__/studioAgentFastPathTurn.test.ts`
  - `frontend/features/ai-agent/logic/__tests__/studioAgentThinkerFormatter.test.ts`
  - `frontend/tests/api/studio-agent.runtime.test.ts`
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
- Added ADR:
  - `docs/adr/0025-ai-studio-create-startup-model-precedence.md`
- Added evidence note:
  - `docs/records/evidence/agent/phase-5/2026-02-24-phase-5-default-model-foundation-and-reliability-delta-closeout.md`

## 2026-02-25 (AI Studio safety-policy track: image payload minimum-restriction alignment)

- Centralized image generation safety payload defaults in:
  - `frontend/features/ai-studio/hooks/taskSubmission/safetyPolicy.ts`
- Updated image submit handlers to use shared policy-driven safety payloads:
  - `frontend/features/ai-studio/hooks/taskSubmission/defaultHandlers.ts`
  - `frontend/features/ai-studio/hooks/taskSubmission/imageHandlers.ts`
- Aligned runtime defaults to minimum-restriction payload settings for supported image models:
  - FLUX.2 + FLUX.2 Lite + FLUX.2 Edit: `enable_safety_checker: false`
  - FLUX.2 Pro + FLUX.2 Pro Edit: `enable_safety_checker: false`, `safety_tolerance: "5"`
  - Seedream 4.5 text/edit: `enable_safety_checker: false`
- Expanded regression coverage:
  - `frontend/features/ai-studio/hooks/taskSubmission/__tests__/safetyPolicy.test.ts`
  - `frontend/features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts`
- Synced docs with runtime behavior:
  - `docs/sops/sop_ai_studio_index.md`
  - `docs/sops/sop_image_generation.md`
  - `docs/api/api-fal-flux-2.md`
  - `docs/api/api-fal-flux-2-klein-9b.md`
  - `docs/api/api-fal-seedream-4-5.md`

## 2026-02-25 (AI Studio safety-policy track closeout verification)

- Completed Workstream C closeout for Foundational Hardening Program v2 with official fal.ai verification across image models.
- Added formal verification evidence and full-gate results:
  - `docs/records/evidence/agent/phase-5/2026-02-25-phase-5-safety-policy-verification-closeout.md`
- Corrected Seedream text model catalog doc source to fal canonical endpoint:
  - `frontend/lib/model-runtime/modelCatalog.ts`
  - updated from `.../seedream/v4.5/api` to `.../seedream/v4.5/text-to-image/api`
- Executed full regression gates (all pass):
  - `npm -C frontend run type-check`
  - `npm -C frontend run lint`
  - `npm -C frontend run test`
  - `npm -C frontend run build`

## 2026-02-25 (AI Studio reference-grid prompt card generation decoupling)

- Removed the reference-card Generate pill from the Reference Grid prompt cards and deleted its render-path wiring:
  - `frontend/features/ai-studio/reference-grid/components/ReferenceGridCard.tsx`
  - `frontend/features/ai-studio/reference-grid/controllers/useReferenceGridCardRenderController.tsx`
  - `frontend/features/ai-studio/components/ReferenceGrid.tsx`
- Unwired prompt-card generation plumbing from page orchestration and reference-grid prop composition:
  - `frontend/features/ai-studio/hooks/useAiStudioReferenceGridProps.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioWorkspaceActions.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioReferenceAssetActions.ts`
  - `frontend/pages/ai-studio.tsx`
- Removed dead reference-card generate styling and retained agent-output generate styling on chat surfaces:
  - `frontend/styles/ai-studio-canvas.css`
- Updated regression tests for the new contract (no per-card generate callbacks/flags):
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.paste.test.tsx`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceGridProps.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkspaceActions.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioReferenceAssetActions.test.ts`
- Updated SOPs to document prompt-card reuse behavior and primary-generate-only workflow:
  - `docs/sops/sop_text_generation.md`
  - `docs/sops/sop_ai_studio_agent_chat_ops.md`

## 2026-02-25 (AI Studio Create Character Mode model picker filtering)

- Updated the shared create/image model-selection policy so Character Mode hides `FLUX.2 Lite` in the Create model picker while preserving existing startup/default precedence:
  - `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPageDerivations.ts`
  - `frontend/pages/ai-studio.tsx`
- Added regression coverage for policy-level Character Mode filtering and page-level derived model options:
  - `frontend/features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioPageDerivations.test.ts`
- Synced Character Mode behavior documentation:
  - `docs/sops/sop_image_generation.md`

## 2026-02-25 (Character selection persistence across Character Manager and AI Studio)

- Added shared selected-character persistence helpers with local-storage backing:
  - `frontend/features/character-manager/logic/selectedCharacterPersistence.ts`
- Updated Character Manager draft bootstrap to prefer persisted selection and keep persistence current after character switches:
  - `frontend/features/character-manager/logic/characterManagerPersistence.ts`
  - `frontend/features/character-manager/hooks/useCharacterManagerDraft.ts`
- Updated AI Studio Create Character Mode lifecycle to hydrate and persist `selectedCharacterId` using the same shared persistence key:
  - `frontend/features/ai-studio/hooks/useAiStudioCharacterModeLifecycle.ts`
- Added/updated regression coverage:
  - `frontend/features/character-manager/logic/__tests__/selectedCharacterPersistence.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioCharacterModeLifecycle.test.ts`
  - `frontend/tests/pages/ai-studio.character-mode.test.tsx`
- Updated docs/runbooks:
  - `docs/sops/sop_character_manager_operations.md`
  - `docs/sops/sop_image_generation.md`
  - `docs/planning/backlog.md`

## 2026-02-25 (AI Studio prompt output structure tuning for Create Properties)

- Tuned active prompt policy definitions to enforce data-backed ordering for generation-ready output:
  - `style+subject -> action/pose -> environment -> lighting -> composition/camera -> texture/color`
  - default style anchor `photorealistic editorial` when user style is unspecified
  - concise, cohesive paragraph target (`~40-90 words` unless explicitly requested longer)
  - explicit ban on label-style fragments and recap/meta phrasing (`Colors:`, `Textures visible:`, `Summary:`, `The prompt now includes...`)
- Applied policy updates across all active text-producing paths:
  - `frontend/lib/agentPromptsConfig.ts`
    - `OPENAI_PROMPT_SYSTEM`
    - `STUDIO_AGENT_SYSTEM`
    - `STUDIO_AGENT_THINKER`
- Added regression assertions for prompt policy integrity and refusal invariants:
  - `frontend/lib/__tests__/agentPromptsConfig.test.ts`
- Added runtime contract guards to ensure tuned prompts preserve prompt-only envelope behavior:
  - `frontend/tests/api/studio-agent.runtime.test.ts`
    - semantic-ready fast path keeps `message` + `actions.applyPrompt` only
    - single-stage semantic refusal remains actionless and preserves canonical prompt
- No API schema/interface changes; refusal text and action contract remain unchanged.

## 2026-02-27 (unified build-out baseline)

- Fixed a baseline TypeScript blocker in `frontend/tests/api/fal-webhook-signature.test.ts` by setting `queueMaxWaitSeconds` in the `FalRuntimeFlags` test fixture.
- Added unified build-out planning artifacts:
  - `docs/planning/shortpulse-unified-buildout-master-plan.md`
  - `docs/planning/shortpulse-unified-buildout-tracker.md`
  - `docs/planning/shortpulse-unified-overlap-matrix.md`
  - `docs/planning/shortpulse-unified-decision-log.md`
  - `docs/planning/stages/unified-phase-00-...` through `unified-phase-12-...`
  - `docs/planning/evidence/unified-buildout/` with per-phase evidence placeholders and Phase 00 baseline note.
- Updated documentation indexes (`docs/README.md`, `docs/planning/README.md`) to include unified build-out artifacts.
- Added a secret-exposure response control note in `docs/security-checklist.md` to require immediate key rotation/revocation and evidence capture.

## 2026-02-27 (unified buildout phase-01 slice-a-b)

- Repaired stale guardrail targeting by replacing legacy `ReferenceCanvas.tsx` paths with canonical `ReferenceGrid.tsx` in CI adaptive filters, size-budget checks, and CODEOWNERS critical-path ownership.
- Tightened naming guard configuration by removing missing-file allowlist entries from `scripts/check_naming_legacy_usage.js` while keeping compatibility-token detection active for live bridge paths.
- Added dedicated CI `type_check` lane and new `secret_scan` lane (`SECRET_SCAN_MODE=warn|enforce`) in `.github/workflows/ci.yml`.
- Added repository-level high-confidence secret exposure scanner at `scripts/check_secret_exposure.js` and documented policy updates in `docs/planning/ci-policy-checks.md`.
- Captured Phase 01 evidence and tracker status updates under `docs/planning/evidence/unified-buildout/phase-01/` and `docs/planning/shortpulse-unified-buildout-tracker.md`.

## 2026-02-27 (unified buildout phase-02 auth slice-a-b)

- Implemented token-first auth hardening by splitting API auth internals into `authTokenVerifier.ts` (bearer parsing + Supabase `/auth/v1/user` verification) and `authProxyContext.ts` (advisory proxy header extraction/merge only).
- Reworked `requireApiUser`/`getOptionalApiUser` orchestration in `frontend/lib/server/api/auth.ts` so proxy headers cannot authorize protected routes without bearer verification under normal mode.
- Added emergency-only proxy fallback switch `SHORTPULSE_TRUST_PROXY_AUTH_HEADERS` (default `false`) and documented it in API/security docs and `.env.example`.
- Expanded protected API path coverage to include `/api/log/` for middleware-route alignment.
- Updated auth boundary tests to cover fail-closed behavior, mismatch handling, and emergency override behavior.

## 2026-02-27 (unified buildout phase-02 admin access slice-c-d)

- Added `GET /api/admin/access` for lightweight server-authoritative admin gating, including explicit `accessVia` source (`role|allowlist|none`) and stable 403 denied payload.
- Added shared admin gate hook `frontend/features/admin/logic/useAdminAccess.ts` and rewired `/admin` and `/admin/generation-trace` to use it, removing authorization coupling to `/api/admin/users` list-fetch success.
- Added `resolveAdminAccessVia` to auth helpers and retained token-first fail-closed auth semantics from phase-02 slice-a-b.
- Added API route coverage for `/api/admin/access` in `frontend/tests/api/admin-access.test.ts` and updated auth helper coverage for allowlist access resolution.
- Updated docs/tracker/evidence for Phase 02 completion (`docs/api/api-internal-routes.md`, `README.md`, unified tracker/stage/evidence artifacts).

## 2026-02-27

- Phase 03 queue/recovery integrity hardening (in progress): added checked queue mutation result contracts in `generationQueue/service.ts`, added transition-guard enforcement in `generationQueue/dispatch.ts`, and tightened fallback recovery claiming in `/api/internal/generation-recovery/run` with compare-and-set predicates.
- Added targeted fault-path tests for transition safeguards: `generationQueue.dispatch.integrity.test.ts`, extended `generationQueue.service.test.ts`, and extended `internal-generation-recovery-run.test.ts` fallback-CAS coverage.
- Updated unified phase docs/tracker/evidence and provider incident SOP with queue transition guard diagnostics.
- Phase 03 follow-up: closed the existing-`request_id` queue reconciliation gap by requiring reservation submit confirmation before queue-row removal, with guarded retry/exhaust fallback and new integrity tests for the branch.

## 2026-02-27 (unified buildout phase-04 slice-a-b)

- Added `providerTrustPolicy` runtime guard module to centralize trusted Fal outbound URL validation and host allowlisting (`SHORTPULSE_FAL_TRUSTED_HOSTS`).
- Enforced trusted URL checks in Fal submit/status/recovery paths:
  - submit target validation in `submitEngine.ts`,
  - trusted queue-base filtering in `falStatusProxy.ts`,
  - trusted response probe filtering in `statusProxyRuntime.ts`,
  - trusted status/result/retry base validation in `recoveryProviderProbe.ts`,
  - trusted webhook-target augmentation filtering in `falSubmitTargeting.ts`.
- Added targeted regression coverage for trust-policy behavior:
  - `providerTrustPolicy.test.ts`,
  - `submitEngine.test.ts`,
  - `recoveryProviderProbe.test.ts`,
  - `statusProxyRuntime.test.ts` (untrusted probe skip),
  - `fal-status-proxy.test.ts` (fail-closed untrusted queue base).
- Updated unified plan/tracker/stage/evidence docs for Phase 04 Slice A/B and added provider incident SOP diagnostics for trusted outbound URL guard failures.

## 2026-02-27 (unified buildout phase-04 slice-d)

- Added queue-status read-only rollout control `SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED` (default `true` for compatibility).
- Updated `GET /api/fal/queue-status` to skip dispatch-kick side effects when rollout flag is `false`, while preserving existing response contract and status-read behavior.
- Added targeted compatibility tests:
  - `frontend/tests/api/fal-queue-status.test.ts` (read-only mode + legacy kick mode assertions),
  - `frontend/lib/server/api/__tests__/falRuntimeFlags.test.ts` (new flag default/override parsing),
  - `frontend/tests/api/fal-webhook-signature.test.ts` fixture update for new runtime flag shape.
- Updated rollout docs and runbooks:
  - `frontend/.env.example`,
  - `docs/api/api-internal-routes.md`,
  - `docs/sops/sop_provider_incident_response.md`,
  - `docs/planning/stages/unified-phase-04-video-runtime-hardening-residuals.md`,
  - `docs/planning/evidence/unified-buildout/phase-04/*`,
  - `docs/planning/shortpulse-unified-buildout-tracker.md`.

## 2026-02-27 (unified buildout phase-04 canary readiness packet)

- Added explicit Phase 04 canary-readiness evidence for `/api/fal/queue-status` read-only rollout:
  - `docs/planning/evidence/unified-buildout/phase-04/2026-02-27-fal-queue-status-read-only-canary-readiness.md`.
- Updated Phase 04 stage doc with rollout checklist, rollback triggers, and verification criteria:
  - `docs/planning/stages/unified-phase-04-video-runtime-hardening-residuals.md`.
- Updated evidence index and tracker notes to reflect canary handoff status:
  - `docs/planning/evidence/unified-buildout/phase-04/README.md`,
  - `docs/planning/shortpulse-unified-buildout-tracker.md`.
- Updated deployment env inventory for Phase 04 controls:
  - `docs/deployment.md` (`SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED`, `SHORTPULSE_FAL_TRUSTED_HOSTS`, queue/cleanup env set).

## 2026-02-27 (unified buildout phase-05 slice-a preview trust policy)

- Added centralized media preview trust policy module `frontend/lib/mediaPreviewTrustPolicy.ts` to enforce trusted-host and user-scope checks for direct preview URLs and Next optimizer eligibility.
- Integrated preview trust checks into:
  - `frontend/lib/mediaPreviewPath.ts` (direct fallback filtering),
  - `frontend/lib/adaptive-media/resolver.ts` (optimizer guard),
  - `frontend/features/ai-studio/logic/referenceGridMedia.ts` (optimizer guard),
  - `frontend/next.config.js` (trusted `images.remotePatterns` instead of wildcard hosts).
- Added/updated targeted tests:
  - `frontend/lib/__tests__/mediaPreviewTrustPolicy.test.ts`,
  - `frontend/lib/adaptive-media/__tests__/resolver.test.ts`,
  - `frontend/features/ai-studio/logic/__tests__/referenceGridMedia.test.ts`,
  - `frontend/tests/api/media-resolve-previews.test.ts`.
- Documented new media preview trust env controls in:
  - `frontend/.env.example`,
  - `docs/api/api-internal-routes.md`,
  - `docs/security-checklist.md`,
  - `docs/deployment.md`.
- Added phase evidence artifact:
  - `docs/planning/evidence/unified-buildout/phase-05/2026-02-27-phase-05-slice-a-media-preview-trust-policy.md`.

## 2026-02-27 (unified buildout phase-05 slice-b media upload service route)

- Added server-authoritative Media Library upload service `frontend/lib/server/mediaUploadService.ts` with:
  - multipart/raw parsing,
  - destination tab validation (`uploaded_images`, `uploaded_videos`, `private`),
  - magic-byte MIME detection + declared MIME compatibility checks,
  - destination-specific size/type enforcement,
  - scoped storage path generation + storage upload + `media_files` insert + signed preview URL response mapping.
- Added authenticated upload route `POST /api/media/upload` in `frontend/pages/api/media/upload.ts` with rollout flag gate `SHORTPULSE_MEDIA_UPLOAD_API_ENABLED`.
- Added targeted route coverage in `frontend/tests/api/media-upload.route.test.ts`.
- Updated documentation for the new route + env controls:
  - `README.md`,
  - `docs/api/api-internal-routes.md`,
  - `docs/security-checklist.md`,
  - `docs/deployment.md`,
  - `legacy standalone Media Library UI SOP`,
  - `frontend/.env.example`.
- Added phase evidence artifact:
  - `docs/planning/evidence/unified-buildout/phase-05/2026-02-27-phase-05-slice-b-media-upload-service-route.md`.

## 2026-02-27 (unified buildout phase-05 slice-c media upload hook migration)

- Migrated Media Library upload controller to server-authoritative upload route by default:
  - updated `frontend/features/media-library/hooks/useMediaUploadController.ts` to call `fetchWithAuth('/api/media/upload')` with per-file destination tab routing.
- Preserved temporary rollback path:
  - legacy direct Supabase upload branch retained behind `NEXT_PUBLIC_MEDIA_UPLOAD_API_ENABLED=false`.
- Added/updated upload-controller tests:
  - `frontend/features/media-library/hooks/__tests__/useMediaUploadController.test.ts` now covers API mode and legacy fallback mode.
- Added phase evidence artifact:
  - `docs/planning/evidence/unified-buildout/phase-05/2026-02-27-phase-05-slice-c-media-upload-hook-migration.md`.

## 2026-02-27 (unified buildout phase-05 slice-d shared query model + modal prompt scope)

- Added shared media query model module:
  - `frontend/features/media-library/logic/mediaQueryModel.ts` centralizes tab filters, search clause building, and user-scoped prompt query construction.
- Migrated duplicate query logic to the shared model in:
  - `frontend/features/media-library/logic/mediaLibraryPageHelpers.ts`,
  - `frontend/features/ai-studio/logic/mediaLibraryModalModel.ts`,
  - `frontend/features/media-library/hooks/useMediaTabDataController.ts`.
- Fixed AI Studio media modal prompt scope drift:
  - `frontend/features/ai-studio/components/MediaLibraryModal.tsx` now applies explicit `.eq('user_id', userId)` via shared query builder.
- Added/updated tests:
  - `frontend/features/media-library/logic/__tests__/mediaQueryModel.test.ts`,
  - `frontend/features/ai-studio/components/__tests__/MediaLibraryModal.test.tsx`.
- Updated unified phase docs/evidence tracking:
  - `docs/planning/shortpulse-unified-buildout-tracker.md`,
  - `docs/planning/stages/unified-phase-05-media-library-security-first-hardening.md`,
  - `docs/planning/evidence/unified-buildout/phase-05/README.md`,
  - `docs/planning/evidence/unified-buildout/phase-05/2026-02-27-phase-05-slice-d-shared-query-model-and-modal-scope.md`.

## 2026-02-27 (unified buildout phase-05 slice-d qa follow-up)

- Stabilized `MediaLibraryModal` test harness to remove warning noise while preserving behavior coverage:
  - wrapped retry-cap timer waits in `act(...)` to prevent React test warnings,
  - supplied deterministic signed URL batch mocks for media-selection tests to avoid unresolved-preview log spam.
- Updated Phase 05 Slice D evidence with the QA follow-up validation record.

## 2026-02-27 (unified buildout phase-05 slice-e pre-closeout parity packet)

- Added Phase 05 Slice E pre-closeout parity packet:
  - `docs/planning/evidence/unified-buildout/phase-05/2026-02-27-phase-05-slice-e-precloseout-parity-packet.md`.
- Updated Phase 05 stage/tracker/evidence index notes to reflect that closure prep is complete and Phase 05 remains blocked only on Phase 04 canary signoff.

## 2026-02-27 (unified buildout phase-04 canary execution packet template)

- Added a structured canary execution/signoff template for Phase 04 read-only queue-status rollout:
  - `docs/planning/evidence/unified-buildout/phase-04/2026-02-27-fal-queue-status-read-only-canary-execution-log-template.md`.
- Updated Phase 04 stage/tracker/evidence index docs to reference the execution template as the required signoff artifact before phase closure.

## 2026-02-27 (unified buildout phase-04/05 regression refresh)

- Ran a full regression refresh over active Phase 04/05 scope tests and quality gates; results were green.
- Recorded refresh evidence and outcomes:
  - `docs/planning/evidence/unified-buildout/phase-04/2026-02-27-phase-04-05-regression-refresh.md`.
- Updated tracker notes:
  - Phase 04 now references the green regression refresh while remaining blocked on canary execution/signoff.
  - Phase 07 note now tracks an existing warn-mode size-budget target (`useAiStudioState.ts`) as planned modularization work.

## 2026-02-27 (unified buildout phase-04 canary runbook command hardening)

- Tightened Phase 04 canary execution docs with explicit, executable command references:
  - added preflight env setup and exact `capture_protected_route_latency.mjs` invocation examples (bootstrap-token and existing-token paths),
  - added explicit recovery metrics `curl` command with bearer-auth contract,
  - added queue-depth SQL snapshot query.
- Updated:
  - `docs/planning/evidence/unified-buildout/phase-04/2026-02-27-fal-queue-status-read-only-canary-readiness.md`,
  - `docs/planning/evidence/unified-buildout/phase-04/2026-02-27-fal-queue-status-read-only-canary-execution-log-template.md`.

## 2026-02-27 (unified buildout phase-04 canary execution attempt blocked)

- Attempted to run Phase 04 canary latency capture from current shell and recorded explicit blocker evidence.
- Blocker: required staging execution env/auth variables were unset (`SHORTPULSE_STAGING_BASE_URL`/`APP_BASE_URL` and related auth inputs).
- Added evidence artifact:
  - `docs/planning/evidence/unified-buildout/phase-04/2026-02-27-fal-queue-status-read-only-canary-execution-blocked-missing-env.md`.
- Updated phase-04 evidence index and tracker note to reflect blocked state and next required action.

## 2026-02-27 (unified buildout phase-04 baseline capture automation helper)

- Added `scripts/capture_phase04_canary_baseline.mjs` to automate Phase 04 baseline evidence capture:
  - validates required staging env/auth inputs,
  - runs `capture_protected_route_latency.mjs` for `/api/fal/queue-status` and `/api/media/resolve-previews`,
  - captures `/api/internal/generation-recovery/run` snapshot,
  - writes a secret-safe markdown artifact under `docs/planning/evidence/unified-buildout/phase-04/`.
- Updated Phase 04 readiness/stage/evidence docs to include helper usage.

## 2026-02-27 (master rollout proposal terminology alignment)

- Updated `docs/planning/master-rollout-proposal.md` terminology in Stage 01 inventory task from `KEI` to canonical `KIE` naming for provider/migration plan consistency.

## 2026-02-27 (unified buildout phase-10 slice-a webhook size caps + safe errors)

- Added a shared bounded raw-body utility for API routes:
  - `frontend/lib/server/api/requestBody.ts`.
- Hardened webhook handlers with explicit size caps and `413` responses:
  - `POST /api/billing/stripe/webhook` (`256 KB` max),
  - `POST /api/fal/webhook` (`512 KB` max).
- Sanitized webhook `500` responses to avoid leaking internal transport/database error details while preserving server-side exception logging.
- Added focused webhook route coverage for oversized payload and sanitized failure behavior:
  - `frontend/tests/api/stripe-webhook.test.ts`,
  - `frontend/tests/api/fal-webhook-route.test.ts`.
- Updated security/API/phase tracking docs and Phase 10 evidence artifacts.

## 2026-02-27 (unified buildout phase-10 slice-b describe-image fail-closed host trust)

- Hardened `/api/ai/describe-image` host trust policy to fail closed for non-allowlisted external hosts by default (Supabase host remains auto-trusted).
- Added explicit route coverage for empty-allowlist fail-closed behavior in `frontend/tests/api/describe-image.route.test.ts`.
- Tightened describe-image `5xx` error payloads to avoid returning internal transport details to clients while preserving server-side error logging.
- Updated deployment/API/SOP/security docs and env template to align with the trusted-host contract.

## 2026-03-01 (unified rollout pre-canary acceleration track)

- Advanced Phase 11 pre-canary implementation with Fal-preservation guardrails:
  - added Kie dark-path runtime configuration surface and trust/allowlist helpers (`providerRuntimeConfig`),
  - expanded provider dispatch/topology/payload/policy seams to support `provider="kie"` while keeping Fal route contracts unchanged,
  - propagated provider context through queue/recovery/persistence paths without enabling cutover.
- Added/updated regression coverage for provider integration seams and queue dispatch fail-closed behavior when Kie runtime targets are unavailable.
- Codified pre-canary sequencing policy and deferred-window decisioning across master plan/tracker/decision log docs.
- Added non-canary closeout acceleration artifacts:
  - Phase 05 closeout execution packet,
  - Phase 12 pre-cleanup inventory and delayed-execution checklist,
  - Phase 00/01 operator evidence closeout checklists.

## 2026-03-01 (phase-04 protected deployment baseline unblocked)

- Extended `scripts/capture_phase04_canary_baseline.mjs` with optional Vercel CLI transport using `VERCEL_API_TOKEN` / `SHORTPULSE_VERCEL_API_TOKEN`:
  - route probes and recovery snapshot now run through `vercel curl` when token is provided,
  - script captures deterministic `http_code` + `time_total` metadata for baseline output,
  - direct-fetch mode remains available when Vercel token is not configured.
- Updated Phase 04 readiness/stage docs to include `--vercel-api-token` usage for protected deployments.
- Captured a fresh Phase 04 staging baseline artifact:
  - `docs/planning/evidence/unified-buildout/phase-04/2026-03-01-phase-04-canary-baseline-capture.md`.

## 2026-03-01 (phase-05 closeout validation run under sequencing hold)

- Executed full Phase 05 closeout validation packet with green results:
  - targeted media hardening parity tests,
  - lint,
  - type-check,
  - docs parity checks,
  - production build.
- Added executed closeout evidence artifact:
  - `docs/planning/evidence/unified-buildout/phase-05/2026-03-01-phase-05-slice-e-closeout-validation-run-under-sequencing-hold.md`.
- Updated Phase 05 stage/tracker notes to reflect:
  - engineering scope complete,
  - final phase status remains sequencing-gated by Phase 04 signoff policy.

## 2026-03-01 (phase-11 contract anti-bloat drift lock)

- Reduced Kie contract duplication by updating `frontend/lib/server/providerIntegration/kieModelContracts.ts` to read allowed aspect/duration/resolution constraints from canonical `frontend/lib/model-runtime/modelCatalog.ts` entries.
- Added fail-closed guards for missing/incomplete Kie model catalog constraints in submit normalization paths.
- Ran Phase 11 no-regression checks after refactor:
  - `npm -C frontend run test -- kieModelContracts`
  - `npm -C frontend run type-check`
  - `npm -C frontend run test:phase11:fal-regression`

## 2026-03-01 (phase-11 stage doc audit cleanup)

- Corrected Phase 11 stage wording so Kie VEO/Kling are described as implemented dark-path contracts (runtime-off), not "not yet implemented."
- Replaced bulky pasted command output in Phase 11 stage validation section with canonical gate commands and current pass-state summary.
- No runtime code changes in this cleanup slice.

## 2026-03-01 (phase-12 ws0.5 execution gate helper)

- Added deterministic Phase 12 cleanup execution preflight helper:
  - `scripts/phase12_execution_gate.mjs`.
- Added npm shortcut:
  - `npm -C frontend run phase12:execution-gate`.
- Updated Phase 12 stage/tracker/evidence docs to record WS-0.5 helper availability and gate usage contract.

## 2026-03-01 (phase-11 kie model-id contract centralization)

- Added canonical Kie model-id constants module for provider-integration contracts:
  - `frontend/lib/server/providerIntegration/kieModelIds.ts`.
- Rewired Kie submit/media contract boundaries and focused tests to consume shared model ids:
  - `kieModelContracts.ts`, `kieResultMediaContracts.ts`, and related unit suites.
- Ran focused Kie contract suites and full `test:phase11:fal-regression` gate with passing results.

## 2026-03-01 (phase-11 provider-header contract centralization)

- Added shared provider header parsing helper:
  - `frontend/lib/server/providerIntegration/providerHeaderUtils.ts`.
- Rewired `kieStatusContracts.ts` and `statusProviderPolicy.ts` to shared header parsing and decoupled Kie status model-support checks from submit-contract module exports.
- Added focused helper coverage and reran full `test:phase11:fal-regression` gate with passing results.

## 2026-03-01 (phase-11 kie model-id runtime canonicalization)

- Added canonical runtime model-id constants module:
  - `frontend/lib/model-runtime/providerModelIds.ts`.
- Rewired model catalog/registry Kie entries and provider-integration Kie model-id exports to consume the same canonical runtime ids.
- Hardened `scripts/check_model_catalog_parity.js` TypeScript loader to resolve relative module imports so docs parity checks remain stable with modularized runtime constants.
- Added focused model-id coverage and reran full `test:phase11:fal-regression` gate with passing results.

## 2026-03-01 (phase-11 kie canonical-id parity guard)

- Hardened `scripts/check_model_catalog_parity.js` with canonical Kie ID drift enforcement:
  - validates parity between `KIE_SUPPORTED_MODEL_IDS`, model catalog Kie provider entries, and Kie API doc mappings.
- Added Phase 11 evidence/stage/tracker updates for the new canonical-id guardrails.

## 2026-03-01 (phase-11 kie registry canonical-id parity guard)

- Extended `scripts/check_model_catalog_parity.js` to enforce canonical Kie ID parity with runtime model registry entries (`listModelConfigs()`).
- Added Phase 11 evidence/stage/tracker updates so Chunk 5 reflects runtime/catalog/registry/docs parity enforcement.

## 2026-03-01 (phase-11 runtime model-surface parity guard)

- Extended `scripts/check_model_catalog_parity.js` with full model-surface parity checks:
  - catalog model presence in runtime registry,
  - runtime registry model presence in catalog,
  - provider classification parity by model id.
- Added Phase 11 evidence/stage/tracker updates to record all-provider runtime model-surface drift enforcement.

## 2026-03-01 (phase-11 provider source provenance parity guard)

- Extended `scripts/check_model_catalog_parity.js` to enforce provider-aligned source-url provenance checks by host allowlist:
  - `fal` -> `fal.ai`,
  - `kie` -> `docs.kie.ai` / `kie.ai`,
  - `openai` -> `platform.openai.com` / `openai.com`.
- Added URL host parsing + allowlist checks to fail fast on source provenance drift in the canonical model catalog.
- Added Phase 11 evidence/stage/tracker updates for this anti-drift governance slice.

## 2026-03-01 (phase-11 kie allowlist normalization and validation hardening)

- Hardened `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts` allowlist parsing to:
  - normalize entries to lowercase,
  - allow canonical Kie model ids and `*`,
  - allow wildcard prefixes only when they match canonical Kie model-id prefixes,
  - reject invalid/non-Kie allowlist entries (fail-closed).
- Added focused tests for normalized + invalid-entry filtering and fail-closed behavior:
  - `frontend/lib/server/providerIntegration/__tests__/providerRuntimeConfig.test.ts`.
- Clarified Kie allowlist env contract in `frontend/.env.example`.
- Added Phase 11 evidence/stage/tracker updates for this anti-drift runtime-config slice.

## 2026-03-01 (phase-11 model contract completeness parity guard)

- Extended `scripts/check_model_catalog_parity.js` with model-contract completeness checks:
  - default aspect membership in allowed aspects for non-text submit surfaces,
  - default duration consistency when allowed durations are configured,
  - required Kie contract fields (`payloadValidation`, `allowedDurations`).
- Added Phase 11 evidence/stage/tracker updates for this anti-drift governance slice.

## 2026-03-01 (phase-11 kie primary-source contract alignment slice)

- Captured Kie Veo/Kling primary-source contract details and updated API docs:
  - `docs/api/api-kie-veo-3-1-fast-image-to-video.md`
  - `docs/api/api-kie-kling-3-0.md`
- Aligned Kie submit contracts with documented request conventions:
  - Veo alias normalization (`imageUrls`, `callBackUrl`, `generationType`), `seeds` range validation, and generation-type image-count/aspect constraints.
  - Kling submit normalization to `createTask` request shape (`model` + `input`) with validated mode/sound/multi-shot/image requirements.
- Aligned callback parsing contracts for documented callback shapes:
  - terminal `state=fail` handling in Kie status contracts,
  - `resultJson.resultUrls` media extraction in Kie result-media contracts.
- Added Phase 11 evidence/stage/tracker updates for this primary-source alignment slice.

## 2026-03-01 (phase-11 kie callback code + aspect alias follow-on alignment)

- Added `aspectRatio` submit alias support in Kie submit contract normalization.
- Added lifecycle fallback mapping for callback payloads that only include numeric `code` values:
  - `200` -> `completed`
  - `501` -> `failed`
- Added numeric retryable-code handling in Kie upstream retry classification.
- Added focused Kie contract test coverage and updated Phase 11 evidence/stage/tracker notes.

## 2026-03-01 (phase-11 kie primary-source fixture regression lock)

- Added primary-source-shaped Kie fixtures for Veo and Kling contracts:
  - `frontend/lib/server/providerIntegration/__tests__/fixtures/kieContractFixtures.ts`.
- Extended Kie contract suites to assert normalized behavior against fixture payloads:
  - submit contract normalization,
  - callback lifecycle convergence,
  - callback `resultJson` media extraction.
- Locked canonical callback failure normalization (`state=fail` -> `failed`) with fixture-backed coverage.

## 2026-03-01 (Phase 11 Kie dispatch anti-drift)

- Added template-safe Kie status/details URL dispatch support with optional `{requestId}` token substitution so query-style Kie polling endpoints can be configured without changing Fal routing behavior.
- Hardened Kie runtime URL parsing/trust checks to accept `{requestId}` only in path/query and fail closed when token usage appears in authority/hostname.
- Added regression coverage for Kie template dispatch and runtime config parsing, then re-ran Phase 11 Fal no-regression and docs parity checks.

## 2026-03-01 (Phase 11 Kie topology contract defaults)

- Added model-catalog-owned Kie submit/status topology metadata (`kieSubmitUrl`, `kieStatusBaseUrls`, `kieTimeoutMs`) for Veo 3.1 Fast I2V and Kling 3.0.
- Updated provider runtime resolution to use env overrides when present and model-catalog defaults when unset, keeping Kie dark-path guards and Fal behavior unchanged.
- Extended model-catalog parity checks to require Kie topology fields and added regression coverage for catalog fallback behavior in submit/status dispatch paths.

## 2026-03-01 (Phase 11 Kie record-info envelope hardening)

- Expanded Kie status/result contract parsing to include nested envelope candidates (`data.result`, `result.data`, `response.result`, etc.) for lifecycle and retry classification.
- Expanded Kie media extraction to support nested record-info result envelopes and parsed-object `resultJson` payloads in addition to JSON-string `resultJson`.
- Added primary-source-style Veo/Kling record-info fixtures and regression tests to lock lifecycle, response URL, retry-code, and media extraction behavior.

## 2026-03-01 (Phase 11 Kie envelope canonicalization)

- Added a shared Kie envelope normalizer to canonicalize nested `record-info` payloads before lifecycle/media/content-policy decisions.
- Updated provider payload parsing to normalize Kie envelopes first, then validate/parse, preventing false fail-closed outcomes when malformed top-level aliases coexist with valid nested values.
- Added targeted tests for malformed-top-level + valid-nested envelope cases and re-ran full Phase 11 Fal regression + docs parity checks.

## 2026-03-01 (Phase 11 Kie recovery-probe integration lock)

- Added recovery-probe integration coverage to verify nested Kie `recordInfo` envelope payloads are normalized and converged to `completed` + media URLs even when top-level alias fields are malformed.
- Confirmed end-to-end runtime probe path uses canonicalized provider payload parsing under Kie dark-path gating.

## 2026-03-01 (Phase 11 Kie submit transport logical-status normalization)

- Added Kie submit transport normalization helper:
  - `frontend/lib/server/providerIntegration/kieSubmitTransportContracts.ts`.
- Rewired Kie submit dispatch so HTTP `200` responses with non-success Kie body `code` values are treated as logical failures/retry candidates for deterministic fallback:
  - `frontend/lib/server/providerIntegration/submitProviderDispatcher.ts`.
- Added focused regression coverage for logical-status mapping and retry/fallback behavior:
  - `frontend/lib/server/providerIntegration/__tests__/kieSubmitTransportContracts.test.ts`
  - `frontend/lib/server/providerIntegration/__tests__/submitProviderDispatcher.test.ts`.

## 2026-03-01 (Phase 11 engineering freeze and complete-state mark)

- Marked Phase 11 as engineering-complete and frozen for additional anti-drift coding unless a concrete defect appears.
- Updated stage/tracker/evidence docs to reflect decision-window-pending state and explicit freeze policy.

## 2026-03-02 (Phase 13 governance lock + adaptive gate stabilization kickoff)

- Added cross-plan governance artifacts for unified execution:
  - `docs/planning/stages/unified-phase-13-cross-plan-master-rollout.md`
  - `docs/planning/migration-number-reservation-map.md`
  - `docs/planning/evidence/unified-buildout/phase-13/README.md`
  - `docs/planning/evidence/unified-buildout/phase-13/research-checkpoints.md`
- Updated canonical unified planning docs (master plan, tracker, overlap matrix, decision log) to include Phase 13 cross-plan locks, migration reservation policy, and anti-duplication constraints.
- Updated docs indexes (`docs/README.md`, `docs/planning/README.md`) to include the new Phase 13 docs and evidence paths.
- Started Wave B adaptive stabilization by aligning failing `ReferenceGrid.curated` fixtures to trusted Supabase-style URLs in:
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`.
- Implemented Wave C Pass 1 settlement-hardening foundation:
  - Added migration `sql/migrations/041_harden_released_reservation_recapture_semantics.sql` to persist `release_finality` metadata and allow success-path recapture from released-conditional reservations.
  - Added `frontend/lib/server/api/generationBilling/settlementPolicy.ts` and wired `settlementService.ts` through policy evaluation for capture-result handling.
  - Added settlement integrity diagnostics script: `sql/check_generation_settlement_integrity.sql`.
  - Added unit coverage: `frontend/lib/server/api/__tests__/generationBilling.settlementPolicy.test.ts`.
- Updated migration/security docs for new migration and check script:
  - `docs/database-migrations.md`
  - `docs/sops/sop_sql_migration_operations.md`
  - `docs/data-dictionary.md`.

## 2026-03-02 (Phase 13 Wave C Pass 2/3 runtime hardening + SQL audit parity)

- Added runtime hardening flags to Fal runtime config:
  - `recovery_probe_timeout_ms` (`SHORTPULSE_FAL_RECOVERY_PROBE_TIMEOUT_MS`, default `15000`)
  - `running_exhaust_min_age_seconds` (`SHORTPULSE_FAL_RUNNING_EXHAUST_MIN_AGE_SECONDS`, default `7200`)
- Added timeout-aware probe transport wrapper:
  - `frontend/lib/server/falIntegration/recoveryFetchWithTimeout.ts`
  - wired into `recoveryProviderProbe.ts` so timeout/abort transport failures degrade to retry-safe running outcomes instead of bubbling route-level exceptions.
- Hardened running exhaustion policy in recovery execution:
  - running-state exhaustion now requires attempts + min-age threshold,
  - deferred-exhaustion path preserves retry eligibility when attempt budget is reached before age floor.
- Added migration `sql/migrations/042_harden_queue_recovery_rpc_execute_grants.sql` to enforce service-role-only execute grants for:
  - `enqueue_generation_submit(...)`
  - `claim_generation_submit_queue_batch(...)`
  - `claim_generation_recovery_batch(...)`
- Expanded SQL runtime security audit expected-function coverage for queue/recovery enqueue/claim RPCs:
  - `sql/check_runtime_sql_security_audit.sql`.
- Tightened Phase 11 metrics packet queue-dispatch telemetry:
  - replaced wildcard source match with explicit error-source counters (`claim_failed`, `retry`, `exhausted`) in `sql/check_phase11_shadow_canary_metrics.sql`.
- Added/updated focused runtime tests:
  - `frontend/lib/server/falIntegration/__tests__/recoveryFetchWithTimeout.test.ts`
  - `frontend/lib/server/falIntegration/__tests__/recoveryProviderProbe.test.ts`
  - `frontend/lib/server/falIntegration/__tests__/recoveryExecution.test.ts`
  - `frontend/lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts`
  - `frontend/lib/server/api/__tests__/falRuntimeFlags.test.ts`
- Recorded Wave C Pass 2/3 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-c-pass-2-3-runtime-hardening-and-audit-parity.md`.

## 2026-03-02 (Phase 13 Wave C Pass 4 controlled webhook canary controls)

- Added controlled webhook canary cohort gating in Fal runtime flags and submit-targeting:
  - `SHORTPULSE_FAL_WEBHOOK_CANARY_USER_ALLOWLIST`
  - `SHORTPULSE_FAL_WEBHOOK_CANARY_MODEL_ALLOWLIST`
- Webhook callback URL registration now checks canary eligibility per `(userId, modelId)` in:
  - `frontend/lib/server/api/falSubmitTargeting.ts`
  - `frontend/lib/server/api/falSubmitProxy.ts`
  - `frontend/lib/server/api/generationQueue/dispatch.ts`
- Preserved route topology and safety path behavior:
  - no new webhook routes,
  - `/api/fal/webhook` remains canonical ingress,
  - polling/reconciler fallback remains active for non-canary traffic.
- Added targeting and runtime-flag coverage:
  - `frontend/lib/server/api/__tests__/falSubmitTargeting.test.ts`
  - updates to `falRuntimeFlags` and webhook-signature fixture typing.
- Updated incident SOP with canary-env and rollout guidance:
  - `docs/sops/sop_provider_incident_response.md`.
- Recorded Wave C Pass 4 control-evidence note:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-c-pass-4-webhook-canary-controls.md`.

## 2026-03-02 (Phase 13 Wave D autosave policy foundation)

- Added shared autosave policy module for client/server decision parity:
  - `frontend/lib/mediaAutosavePolicy.ts`
  - `frontend/lib/__tests__/mediaAutosavePolicy.test.ts`
- Added AI Studio autosave preference + orchestration hooks and integrated page/state wiring:
  - `frontend/features/ai-studio/hooks/useMediaAutosavePreference.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioMediaAutosaveOrchestrator.ts`
  - `frontend/pages/ai-studio.tsx`
  - `frontend/features/ai-studio/hooks/useAiStudioState.ts`
- Hardened recovery execution to enforce autosave preference at completion-time:
  - autosave OFF skips background persistence but still settles generation success,
  - metadata + media decision events include autosave decision fields.
- Added recovery autosave enforcement tests:
  - `frontend/lib/server/falIntegration/__tests__/recoveryExecution.test.ts`
- Added duplicate-save idempotency handling for AI Studio manual save path and tests:
  - `frontend/features/ai-studio/logic/mediaLibraryPersistence.ts`
  - `frontend/features/ai-studio/logic/__tests__/mediaLibraryPersistence.test.ts`
- Added generated-video manual save action parity in reference cards and updated curated tests.
- Added migration `043_add_user_preferences_media_autosave_enabled.sql` (+ rollback pair) and updated bootstrap parity in `sql/create_user_preferences_table.sql`.
- Updated migration/governance docs and Wave D evidence:
  - `docs/database-migrations.md`
  - `docs/sops/sop_sql_migration_operations.md`
  - `docs/data-dictionary.md`
  - `docs/security-checklist.md`
  - `docs/planning/migration-number-reservation-map.md`
  - `docs/planning/stages/unified-phase-13-cross-plan-master-rollout.md`
  - `docs/planning/shortpulse-unified-buildout-tracker.md`
  - `docs/planning/shortpulse-unified-decision-log.md`
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-d-autosave-policy-foundation.md`

## 2026-03-02 (Phase 13 Wave E Pass 1 agent message identity foundation)

- Added stable hook-generated message identity in `useAiAgent`:
  - user messages now receive `agent-user-*` IDs,
  - assistant messages now receive `agent-assistant-*` IDs.
- Added targeted message-update seam in agent state layer:
  - `updateMessageById(messageId, updater)` from `useAiAgent`.
- Updated message-store helper contracts and tests:
  - `appendAssistantMessage` now takes `{ id, content }`.
  - `updateUiMessageById` added with no-op behavior when message ID is not found.
- Added focused regression coverage:
  - `frontend/features/ai-agent/client/__tests__/messageStore.test.ts`
  - `frontend/features/ai-agent/__tests__/useAiAgent.test.ts`
- Recorded Wave E Pass 1 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-1-agent-message-identity-foundation.md`.

## 2026-03-02 (Phase 13 Wave E Pass 2 structured output-generate callback)

- Upgraded agent output-generate callback contract from raw string to structured payload:
  - `{ messageId, prompt, source }`.
- Updated chat prefab emission behavior:
  - staged prompts emit `source='staged'` with virtual key `staged-agent-output`,
  - history assistant bubbles emit `source='history'` with assistant message id.
- Added page-level compatibility shim so legacy string callback payloads are still accepted during transition:
  - `frontend/pages/ai-studio.tsx`.
- Threaded updated callback types through AI Studio create/prompt/shell prop contracts and hook composition layers.
- Updated targeted callback behavior tests:
  - `frontend/prefabs/agent/panels/__tests__/AgentChatPanel.actions.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx`.
- Recorded Wave E Pass 2 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-2-structured-generate-callback.md`.

## 2026-03-02 (Phase 13 Wave E Pass 3 assistant-bubble thumbnail linking)

- Added assistant bubble media-link orchestration seam:
  - `frontend/features/ai-studio/hooks/agentOrchestration/useAgentOutputBubbleLinking.ts`.
- Added optimistic output-link hook coverage:
  - `frontend/features/ai-studio/hooks/agentOrchestration/__tests__/useAgentOutputBubbleLinking.test.ts`.
- Updated generation controller contract to return `{ accepted, optimisticOutputId }` so page orchestration can register post-submit bubble links without changing route contracts:
  - `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`.
- Wired assistant bubble media mapping through inline and expanded chat surfaces and rendered thumbnail/status states above generate pills:
  - `frontend/prefabs/agent/panels/AgentChatPanel.tsx`
  - `frontend/features/ai-studio/components/*` + `frontend/features/ai-studio/hooks/*PanelProps.ts`
  - `frontend/pages/ai-studio.tsx`.
- Updated styling for compact generate controls with thumbnail/status support:
  - `frontend/styles/prefabs-agent-variants.css`
  - `frontend/styles/ai-studio-create-expert-output-generate.css`.
- Added/updated targeted UI tests:
  - `frontend/prefabs/agent/panels/__tests__/AgentChatPanel.actions.test.tsx`.
- Recorded Wave E Pass 3 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-3-bubble-thumbnail-linking.md`.

## 2026-03-02 (Phase 13 Wave E Pass 4 inline assistant bubble edit wiring)

- Added local-only assistant message edit helper seam:
  - `frontend/features/ai-agent/client/messageEditing.ts`
  - `frontend/features/ai-agent/client/__tests__/messageEditing.test.ts`.
- Added assistant edit request contract:
  - `AgentAssistantMessageEditRequest` in `frontend/prefabs/agent/types.ts`.
- Wired bridge-level assistant edit handler through existing message identity foundation (`updateMessageById`) with no-op/empty edit rejection:
  - `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`.
- Threaded `onAssistantMessageEdit` callback contracts through create/inline/expanded AI Studio chat surfaces.
- Implemented double-click inline edit UX in `AgentChatPanel`:
  - Enter/blur commits,
  - Escape cancels,
  - empty/no-op edits revert,
  - drag is disabled while editing.
- Added page-level rollout gate:
  - `NEXT_PUBLIC_ENABLE_AGENT_BUBBLE_INLINE_EDIT` (default off unless explicitly enabled).
- Updated panel regression coverage:
  - `frontend/prefabs/agent/panels/__tests__/AgentChatPanel.actions.test.tsx`.
- Recorded Wave E Pass 4 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-4-inline-assistant-edit.md`.

## 2026-03-02 (Phase 13 Wave E Pass 5 chat mode toggle + raw submit behavior)

- Added chat-mode preference seam with default ON and legacy raw-mode fallback compatibility:
  - `frontend/features/ai-studio/logic/chatModePreference.ts`
  - `frontend/features/ai-studio/logic/__tests__/chatModePreference.test.ts`.
- Extended bridge/panel contracts to thread chat-mode state as a decoupled UI policy:
  - `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioPanelProps.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioCreatePanelProps.ts`
  - `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
  - `frontend/features/ai-studio/components/PromptStep.tsx`
  - `frontend/features/ai-studio/components/promptStep/types.ts`.
- Added Chat Mode toggle UI to the right side of the inline composer using Character Mode toggle styling:
  - `frontend/features/ai-studio/components/promptStep/PromptStepChatSurface.tsx`
  - `frontend/styles/prefabs-agent.css`.
- Enforced behavior split in primary create/text submit flow:
  - Chat Mode ON keeps agent send/respond path,
  - Chat Mode OFF disables send affordances and routes submit through direct raw generation (`agentInput` fallback to shared prompt):
  - `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
  - `frontend/pages/ai-studio.tsx`.
- Updated targeted regression coverage:
  - `frontend/features/ai-studio/components/__tests__/PromptStep.actions.test.tsx`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts`.
- Recorded Wave E Pass 5 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-5-chat-mode-toggle-and-raw-submit.md`.

## 2026-03-02 (Phase 13 RCP-1 browser lifecycle save-strategy lock)

- Completed research checkpoint RCP-1 before session persistence implementation:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-rcp-1-browser-lifecycle-save-strategy.md`.
- Locked implementation posture:
  - `visibilitychange` + `pagehide` as primary flush triggers,
  - `keepalive` fetch as default exit transport with `sendBeacon` fallback,
  - no critical dependence on `unload`/`beforeunload`,
  - IndexedDB-first local shadow storage for larger snapshots.

## 2026-03-02 (Phase 13 Wave E Pass 6 session identity URL contract foundation)

- Added modular AI Studio session identity helpers:
  - `frontend/features/ai-studio/logic/sessionIdentity.ts`
  - `frontend/features/ai-studio/logic/__tests__/sessionIdentity.test.ts`.
- Added dedicated URL-contract hook:
  - `frontend/features/ai-studio/hooks/useAiStudioSessionIdentity.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionIdentity.test.ts`.
- Wired `/ai-studio` page entry to enforce `sid` UUID query contract via shallow replace when missing/invalid:
  - `frontend/pages/ai-studio.tsx`.
- Recorded Wave E Pass 6 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-6-session-identity-url-contract.md`.

## 2026-03-02 (Phase 13 Wave E Pass 7 local session write-shadow durability)

- Added schema-versioned AI Studio snapshot serializer for local persistence payloads:
  - `frontend/features/ai-studio/logic/sessionSnapshot.ts`
  - `frontend/features/ai-studio/logic/__tests__/sessionSnapshot.test.ts`.
- Added IndexedDB-first local shadow storage seam with in-memory fallback:
  - `frontend/features/ai-studio/logic/sessionSnapshotStorage.ts`.
- Added debounced write-shadow persistence hook with lifecycle flush triggers (`visibilitychange(hidden)`, `pagehide`) and max-dirty timer:
  - `frontend/features/ai-studio/hooks/useAiStudioSessionWriteShadow.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionWriteShadow.test.ts`.
- Wired `/ai-studio` to persist local snapshots keyed by `sid` session identity:
  - `frontend/pages/ai-studio.tsx`.
- Recorded Wave E Pass 7 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-7-session-write-shadow-local-durability.md`.

## 2026-03-02 (Phase 13 RCP-2 session SQL/API security research lock)

- Completed targeted research checkpoint for Wave E session SQL/API persistence security posture:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-rcp-2-supabase-rls-security-definer-upsert-pruning.md`.
- Locked implementation constraints for migration `044_*`:
  - service-role-only `SECURITY DEFINER` RPC execution posture,
  - explicit function `search_path` hardening,
  - atomic upsert + deterministic per-user prune with bounded TTL/cap policy,
  - scheduled bounded expired-row pruning via `pg_cron`.

## 2026-03-02 (Phase 13 Wave E Pass 8 session SQL/API foundation)

- Added migration `044_add_ai_studio_sessions_persistence.sql` (+ rollback) with:
  - `ai_studio_sessions` table and RLS ownership policies,
  - service-role-only `SECURITY DEFINER` RPCs for save/get/list/prune,
  - deterministic per-user cap/TTL pruning with advisory-lock serialization.
- Added server helper seam for AI session validation/cursor handling/RPC calls:
  - `frontend/lib/server/api/aiStudioSessions.ts`
  - `frontend/lib/server/api/__tests__/aiStudioSessions.test.ts`.
- Added authenticated AI session API routes:
  - `frontend/pages/api/ai/sessions/save.ts`
  - `frontend/pages/api/ai/sessions/[sid].ts`
  - `frontend/pages/api/ai/sessions/index.ts`
  - with rollout gate `SHORTPULSE_AI_STUDIO_SESSIONS_API_ENABLED`.
- Added API route coverage:
  - `frontend/tests/api/ai-sessions.routes.test.ts`
  - expanded `frontend/tests/api/auth-guarded-ai-routes.test.ts`.
- Expanded runtime SQL security audit expected function set to include new session RPCs:
  - `sql/check_runtime_sql_security_audit.sql`.
- Recorded Wave E Pass 8 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-8-session-sql-api-foundation.md`.

## 2026-03-02 (Phase 13 Wave E Pass 9 client remote-shadow write-through)

- Added authenticated session save API client seam:
  - `frontend/features/ai-studio/logic/sessionApiClient.ts`
  - `frontend/features/ai-studio/logic/__tests__/sessionApiClient.test.ts`.
- Added local-first write-shadow transport seam with optional remote mirror:
  - `frontend/features/ai-studio/logic/sessionShadowPersistence.ts`
  - `frontend/features/ai-studio/logic/__tests__/sessionShadowPersistence.test.ts`.
- Updated write-shadow hook to pass lifecycle `keepalive` intent to persistence transport and updated tests:
  - `frontend/features/ai-studio/hooks/useAiStudioSessionWriteShadow.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionWriteShadow.test.ts`.
- Wired page write-shadow path to use transport seam:
  - `frontend/pages/ai-studio.tsx`.
- Added docs updates for remote-shadow rollout flag and troubleshooting:
  - `README.md`
  - `docs/api/api-internal-routes.md`
  - `docs/troubleshooting.md`.
- Recorded Wave E Pass 9 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-9-session-remote-shadow-write-through.md`.

## 2026-03-02 (Phase 13 Wave E Pass 8 runtime SQL security audit execution)

- Executed runtime SQL security audit after queue/recovery grant remediation and session SQL/API rollout.
- Confirmed summary counters:
  - `total_checks = 102`
  - `passing_checks = 102`
  - `failing_checks = 0`.
- Recorded execution evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-8-runtime-sql-audit-green.md`.

## 2026-03-02 (Phase 13 Wave E Pass 10 session restore-candidate readiness)

- Added AI Studio session read client support for `GET /api/ai/sessions/:sid`:
  - `frontend/features/ai-studio/logic/sessionApiClient.ts`
  - `frontend/features/ai-studio/logic/__tests__/sessionApiClient.test.ts`.
- Added restore-candidate resolver seam (local shadow + optional remote read with freshest-by-`updatedAt` selection):
  - `frontend/features/ai-studio/logic/sessionRestoreCandidate.ts`
  - `frontend/features/ai-studio/logic/__tests__/sessionRestoreCandidate.test.ts`.
- Added default-off restore-candidate hook + telemetry-only page wiring (no hydration apply):
  - `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreCandidate.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreCandidate.test.ts`
  - `frontend/pages/ai-studio.tsx`.
- Updated docs for restore-candidate flag and troubleshooting:
  - `README.md`
  - `docs/api/api-internal-routes.md`
  - `docs/troubleshooting.md`.
- Recorded Wave E Pass 10 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-10-session-restore-candidate-readiness.md`.

## 2026-03-02 (Phase 13 Wave C Pass 1 operational settlement closeout)

- Applied settlement recapture semantics in active environment (migration `041` function body confirmed active).
- Executed one-time released-conditional success recapture backfill:
  - `captured = 34` rows.
- Post-closeout checks are green:
  - `sql/check_generation_settlement_integrity.sql` => `missing_charge_count = 0`, `duplicate_charge_key_count = 0`.
  - `sql/check_runtime_sql_security_audit.sql` => `total_checks=102`, `passing_checks=102`, `failing_checks=0`.
- Recorded operational evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-c-pass-1-settlement-integrity-operational-closeout.md`.

## 2026-03-02 (Phase 13 Wave E Pass 11 session hydration apply, gated)

- Added hydration normalization seam for persisted snapshot payloads:
  - `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
  - `frontend/features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`.
- Added `useAiStudioState` hydration entrypoint:
  - `hydrateFromSessionSnapshot(snapshot)` in `frontend/features/ai-studio/hooks/useAiStudioState.ts`.
- Added one-shot page-level hydration apply behind new default-off flag:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_ENABLED`
  - wiring in `frontend/pages/ai-studio.tsx`.
- Updated docs and API env flag inventory:
  - `README.md`
  - `docs/api/api-internal-routes.md`
  - `docs/troubleshooting.md`.
- Recorded Wave E Pass 11 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-11-session-hydration-apply-gated.md`.

## 2026-03-02 (Phase 13 Wave E Pass 12 agent transcript/input hydration, gated)

- Extended snapshot hydration normalization to include agent-state payloads (`messages`, `input`, `latestAgentPrompt`, `promptOrigin`, `chatModeEnabled`) with malformed-row filtering and deterministic message-id normalization:
  - `frontend/features/ai-studio/logic/sessionSnapshotHydrator.ts`
  - `frontend/features/ai-studio/logic/__tests__/sessionSnapshotHydrator.test.ts`.
- Added explicit transcript replacement seam to agent runtime hook:
  - `frontend/features/ai-agent/useAiAgent.ts`
  - `frontend/features/ai-agent/__tests__/useAiAgent.test.ts`.
- Added bridge-level agent hydration seam to keep page orchestration decoupled:
  - `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`.
- Extracted restore-candidate logging + hydration-apply orchestration into a dedicated hook (with focused tests) to keep page size-budget compliant:
  - `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreHydration.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`.
- Updated gated restore apply path to hydrate workspace/output plus agent transcript/input in one one-shot flow per `sid`:
  - `frontend/features/ai-studio/hooks/useAiStudioState.ts`
  - `frontend/pages/ai-studio.tsx`.
- Recorded Wave E Pass 12 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-12-agent-transcript-input-hydration.md`.

## 2026-03-02 (Phase 13 Wave E Pass 13 staged restore rollout gating)

- Added independent restore-apply gate for agent transcript/input hydration:
  - `NEXT_PUBLIC_AI_STUDIO_SESSION_RESTORE_APPLY_AGENT_ENABLED` (defaults to enabled when restore apply is on).
- Updated restore-hydration orchestration to emit explicit gate telemetry (`agent_hydration_applied`) in hydration breadcrumbs:
  - `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreHydration.ts`.
- Added regression coverage for agent-gate-off behavior:
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`.
- Updated docs for the new staged rollout gate:
  - `README.md`
  - `docs/api/api-internal-routes.md`
  - `docs/troubleshooting.md`.
- Recorded Wave E Pass 13 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-e-pass-13-staged-restore-agent-gate.md`.

## 2026-03-02 (Phase 13 RCP-3 provider safety/error normalization checkpoint)

- Completed RCP-3 evidence packet before Wave F safety-control implementation:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-rcp-3-provider-safety-error-normalization.md`.
- Locked Wave F normalization contract:
  - production user-lane responses remain normalized (canonical refusal + stable fallback),
  - development diagnostics remain configurable independently,
  - auth/invalid-request failures remain explicit hard errors.
- Updated canonical rollout governance docs:

## 2026-03-03 (AI Studio sessions selector + deterministic switch flow)

- Added AI Studio toolbar `Sessions` entry in the left rail footer and threaded open-handler props through toolbar boundary/page-content wiring:
  - `frontend/features/ai-studio/components/AiStudioToolbar.tsx`
  - `frontend/features/ai-studio/components/AiStudioToolbarRail.tsx`
  - `frontend/features/ai-studio/components/AiStudioPageContent.tsx`
  - `frontend/pages/ai-studio.tsx`.
- Added recent-sessions modal UI with pagination, empty/error states, and confirm-before-switch controls:
  - `frontend/features/ai-studio/components/AiStudioSessionsModal.tsx`
  - `frontend/styles/ai-studio-history.css`
  - `frontend/styles/ai-studio-layout.css`
  - `frontend/styles/ai-studio-responsive.css`.
- Added client session list API helper and snapshot-title resolution for save payloads:
  - `frontend/features/ai-studio/logic/sessionApiClient.ts`
  - `frontend/features/ai-studio/logic/sessionSnapshotTitle.ts`
  - `frontend/features/ai-studio/logic/sessionShadowPersistence.ts`.
- Added session-switch orchestration hook for deterministic save -> hydrate -> `sid` URL switch:
  - `frontend/features/ai-studio/hooks/useAiStudioSessionSwitcher.ts`.
- Added restore apply coexistence guard and per-session agent namespace isolation:
  - `frontend/features/ai-studio/hooks/useAiStudioSessionRestoreHydration.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioAgentBridge.ts`.
- Added/updated focused test coverage:
  - `frontend/features/ai-studio/logic/__tests__/sessionApiClient.test.ts`
  - `frontend/features/ai-studio/logic/__tests__/sessionSnapshotTitle.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionSwitcher.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`
  - `frontend/features/ai-studio/components/__tests__/AiStudioSessionsModal.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/AiStudioToolbar.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`.
  - `docs/planning/stages/unified-phase-13-cross-plan-master-rollout.md`
  - `docs/planning/shortpulse-unified-buildout-tracker.md`
  - `docs/planning/shortpulse-unified-decision-log.md`
  - `docs/planning/evidence/unified-buildout/phase-13/research-checkpoints.md`
  - `docs/planning/evidence/unified-buildout/phase-13/README.md`.

## 2026-03-02 (Phase 13 Wave F Phase 0 safety control-plane governance artifacts)

- Added Wave F implementation plan and execution tracker:
  - `docs/planning/ai-studio-agent-safety-control-plane-plan.md`
  - `docs/planning/ai-studio-agent-safety-control-plane-tracker.md`.
- Added durable architecture decision record:
  - `docs/adr/0028-agent-safety-control-plane-and-modality-profiles.md`.
- Updated canonical indexes and governance docs to keep single-source execution alignment:
  - `docs/README.md`
  - `docs/planning/README.md`
  - `docs/adr/README.md`
  - `docs/planning/stages/unified-phase-13-cross-plan-master-rollout.md`
  - `docs/planning/shortpulse-unified-buildout-tracker.md`
  - `docs/planning/shortpulse-unified-decision-log.md`.
- Recorded Wave F Pass 0 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-f-pass-0-safety-control-plane-governance-lock.md`.

## 2026-03-02 (Phase 13 Wave F Pass 1 runtime policy core)

- Added safety-policy core modules under `frontend/features/agent-runtime/safetyPolicy/`:
  - `types.ts`
  - `categoryCatalog.ts`
  - `profileCatalog.ts`
  - `hardFloors.ts`
  - `decisionEngine.ts`
  - `providerErrorPolicy.ts`.
- Integrated policy seams into:
  - `frontend/features/agent-runtime/studioAgentCoordinator.ts`
  - `frontend/features/agent-runtime/studioAgentSafetyPostProcess.ts`
  - `frontend/features/agent-runtime/legacyImageDescribeService.ts`
  - `frontend/pages/api/ai/studio-agent.ts`.
- Added focused safety-policy tests and extended post-process coverage:
  - `frontend/features/agent-runtime/safetyPolicy/__tests__/decisionEngine.test.ts`
  - `frontend/features/agent-runtime/safetyPolicy/__tests__/providerErrorPolicy.test.ts`
  - `frontend/features/agent-runtime/__tests__/studioAgentSafetyPostProcess.test.ts`.
- Updated docs for new safety control-plane runtime flags:
  - `README.md`
  - `docs/api/api-internal-routes.md`
  - `docs/sops/sop_ai_studio_agent.md`
  - `docs/troubleshooting.md`.
- Recorded Wave F Pass 1 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-f-pass-1-runtime-policy-core.md`.

## 2026-03-02 (Phase 13 Wave F Pass 2 modality submission safety wiring)

- Expanded task-submission safety policy seam from image-only to image+video payload resolution:
  - `frontend/features/ai-studio/hooks/taskSubmission/safetyPolicy.ts`.
- Replaced hardcoded Veo/Seedance handler safety branches with shared policy resolver wiring:
  - `frontend/features/ai-studio/hooks/taskSubmission/videoHandlers.ts`.
- Added/updated regression coverage for modality safety payload parity:
  - `frontend/features/ai-studio/hooks/taskSubmission/__tests__/safetyPolicy.test.ts`
  - `frontend/features/ai-studio/hooks/taskSubmission/__tests__/submissionPayloadMatrix.test.ts`
  - `frontend/features/ai-studio/hooks/taskSubmission/__tests__/videoHandlers.test.ts`.
- Recorded Wave F Pass 2 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-f-pass-2-modality-wiring.md`.
- Corrected migration reservation governance to avoid collisions with existing Character QuickSwap migrations:
  - safety control-plane persistence/hardening slots moved from `045/046` to `047/048` in
    `docs/planning/migration-number-reservation-map.md`,
  - linked phase/decision/safety-tracker docs updated to the new reservation range.

## 2026-03-02 (Phase 13 Wave F Pass 3 control-plane persistence + admin APIs)

- Added safety control-plane SQL foundation:
  - `sql/migrations/047_add_agent_safety_policy_control_plane.sql`
  - `sql/migrations/048_harden_agent_safety_policy_control_plane_grants.sql`
  - `sql/migrations/rollback/047_add_agent_safety_policy_control_plane_rollback.sql`.
- Added safety control-plane SQL diagnostics:
  - `sql/check_agent_safety_policy_control_plane.sql`.
- Expanded runtime SQL security audit expected-function set:
  - `sql/check_runtime_sql_security_audit.sql`.
- Added server helper seam for control-plane RPC access:
  - `frontend/lib/server/api/agentSafetyPolicyControlPlane.ts`.
- Added admin control-plane API routes:
  - `frontend/pages/api/admin/agent-safety-policy/active.ts`
  - `frontend/pages/api/admin/agent-safety-policy/activate.ts`
  - `frontend/pages/api/admin/agent-safety-policy/rollback.ts`.
- Added targeted API route tests:
  - `frontend/tests/api/admin-agent-safety-policy-active.test.ts`
  - `frontend/tests/api/admin-agent-safety-policy-activate.test.ts`
  - `frontend/tests/api/admin-agent-safety-policy-rollback.test.ts`.
- Updated docs/contracts for new schema/routes/security posture:
  - `README.md`
  - `docs/api/api-internal-routes.md`
  - `docs/data-dictionary.md`
  - `docs/security-checklist.md`
  - `docs/database-migrations.md`
  - `docs/sops/sop_sql_migration_operations.md`
  - `docs/sops/sop_ai_studio_agent.md`
  - `docs/planning/migration-number-reservation-map.md`.
- Recorded Wave F Pass 3 evidence:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-f-pass-3-control-plane-persistence-admin-apis.md`.

## 2026-03-02 (Character UI unification: layout swap + class decoupling)

- Implemented Pass 1 create-workspace layout swap with a dedicated presentational wrapper:
  - added `frontend/features/character-manager/components/CharacterCreateWorkspaceLayout.tsx`
  - refactored `frontend/features/character-manager/components/CharacterManagerShell.tsx` to enforce create-region DOM order `Identity -> QuickSwap -> Character Sheet` for both page and panel surfaces.
- Updated Character Manager layout CSS for swapped desktop placement and deterministic mobile stacking:
  - `frontend/styles/character-manager.css` now defines `.character-create-workspace-layout` plus region classes and roots shared selectors under `.character-manager-page` to reduce cross-surface style bleed.
- Implemented Pass 2 AI Studio character-control decoupling:
  - added `frontend/styles/ai-studio-character-controls.css`
  - imported it in `frontend/styles/globals.css`
  - migrated AI Studio create/picker/chat components to `ai-character-*` and `ai-chat-*` class namespaces:
    - `frontend/features/ai-studio/components/create/ExpertCreatePanelView.tsx`
    - `frontend/features/ai-studio/components/CreatePropertiesPanel.tsx`
    - `frontend/features/ai-studio/components/promptStep/PromptStepChatSurface.tsx`
  - removed overlapping generic character-control block from `frontend/styles/ai-studio-properties.css`.
- Added layout regression coverage:
  - `frontend/features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/CharacterPanel.layout.test.tsx`.
- Updated SOP contracts:
  - `docs/sops/sop_character_manager_operations.md` (create-workspace layout order contract).
  - `docs/sops/sop_ai_studio_index.md` (AI Studio Character panel parity note).
- Validation evidence:
  - targeted suites passed:
    - `cd frontend && npm run test -- features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.copy.test.tsx features/ai-studio/components/__tests__/CharacterPanel.layout.test.tsx features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx features/ai-studio/components/__tests__/PromptStep.actions.test.tsx tests/pages/ai-studio.character-mode.test.tsx`
  - `cd frontend && npm run lint` passed.
  - `cd frontend && npm run build` passed.
  - `cd frontend && npm run test` reported 3 unrelated pre-existing failures in Fal recovery server tests:
    - `lib/server/falIntegration/__tests__/recoveryGenerationLookup.test.ts` (2 assertions)
    - `lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts` (1 assertion).

## 2026-03-02 (post-unification validation closeout)

- Resolved previously failing Fal recovery test drift by updating expectations/fixtures to current recovery contracts:
  - `frontend/lib/server/falIntegration/__tests__/recoveryGenerationLookup.test.ts` now includes required `created_at` fixture field for typed row parsing.
  - `frontend/lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts` now asserts autosave metadata fields emitted by recovered-success updates.
- Hardened character E2E audit selectors to support both legacy and new AI Studio picker class namespaces:
  - `frontend/tests/e2e/character-pipeline.audit.js` now looks for `.ai-character-picker-modal` / `.character-picker-modal` and `.ai-character-list-select-btn` / `.character-list-select-btn`.
- Validation evidence:
  - `cd frontend && npm run test -- lib/server/falIntegration/__tests__/recoveryGenerationLookup.test.ts lib/server/falIntegration/__tests__/recoveryLifecycleTransitions.test.ts` passed.
  - `cd frontend && npm run test` passed (`293` files, `1520` tests).
  - `cd frontend && npm run lint` passed.
  - `cd frontend && npm run build` passed.
  - `cd frontend && npm run test:e2e:character` remains environment-gated until `PLAYWRIGHT_AUDIT_EMAIL` is provided.

## 2026-03-02 (Character Sheet preset tabs redesign + accessibility hardening)

- Replaced inline Character Sheet preset-tab strip rendering with a dedicated component:
  - `frontend/features/character-manager/components/CharacterSheetPresetTabs.tsx`.
- Hardened preset-tab interaction semantics:
  - added roving `tabindex` behavior (`0` on active tab, `-1` otherwise),
  - added keyboard support for `ArrowLeft/ArrowRight` with wrap, `Home/End`, and `Enter/Space`,
  - wired explicit `aria-controls` + `aria-labelledby` linkage between tabs and tabpanel.
- Updated `CharacterManagerShell` to consume the new tab component and wrap the sheet-grid region in a single `role="tabpanel"` container while preserving existing preset persistence and DnD behavior.
- Restyled Character Sheet tabs from block buttons to a connected sculpted rail system in:
  - `frontend/styles/character-manager.css`
  - active tab now visually fuses into panel chrome with neon-teal accent language,
  - mobile keeps single-row tab concept with horizontal scroll.
- Added focused accessibility tests:
  - `frontend/features/character-manager/components/__tests__/CharacterSheetPresetTabs.a11y.test.tsx`.
- Extended integrated shell behavior tests for tab semantics/keyboard behavior:
  - `frontend/features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx`.
- Updated Character Manager SOP with the tab keyboard/ARIA contract:
  - `docs/sops/sop_character_manager_operations.md`.
- Validation evidence:
  - `cd frontend && npm run test -- features/character-manager/components/__tests__/CharacterSheetPresetTabs.a11y.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.copy.test.tsx features/ai-studio/components/__tests__/CharacterPanel.layout.test.tsx` passed.
  - Follow-up visual polish:
    - removed tab lift/translate motion on hover/active to avoid button-like detachment,
    - tightened tab rail spacing and panel seam fusion so active tab remains visually connected to the sheet panel.
  - Follow-up interaction stability fix:
    - removed `isSavingCharacterSheetPreset` from global Character Manager `pageBusy` gating so preset-save round trips no longer dim/disable unrelated surfaces,
    - hardened `setActiveCharacterSheetPreset` against stale async responses via request-id guards,
    - stopped rehydrating signed preset preview URLs during tab-switch persistence to reduce avoidable image URL churn/flicker.
  - `cd frontend && npm run test -- features/character-manager/logic/__tests__/characterManagerPersistence.presets.test.ts features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx features/character-manager/components/__tests__/CharacterSheetPresetTabs.a11y.test.tsx` passed.
  - `cd frontend && npm run test -- features/character-manager/components/__tests__/CharacterSheetPresetTabs.a11y.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.behavior.test.tsx features/character-manager/components/__tests__/CharacterManagerShell.layout.test.tsx features/ai-studio/components/__tests__/CharacterPanel.layout.test.tsx` passed.
  - `cd frontend && npm run lint` passed.

## 2026-03-02 (agent safety control-plane ops guide)

- Added a dedicated SOP for AI Studio agent safety control-plane operations and tuning knobs:
  - `docs/sops/sop_ai_studio_agent_safety_control_plane.md`
- Documented the operational control surface in one place:
  - supported profiles (`prod_safe_v1`, `staging_lenient`, `dev_absolute_zero`),
  - runtime tuning env vars and safe usage guidance,
  - admin activation/rollback workflows and status handling,
  - SQL validation gates (`check_agent_safety_policy_control_plane.sql`, `check_runtime_sql_security_audit.sql`),
  - structured telemetry fields and hard-floor rollback guardrails.
- Linked the new SOP from discovery/index docs:
  - `docs/sops/README.md`
  - `docs/sops/sop_ai_studio_index.md`
  - `docs/sops/sop_ai_studio_agent.md`
  - `docs/README.md`

## 2026-03-02 (agent safety runtime control-plane sync hardening)

- Runtime safety profile resolution now prefers control-plane active state with env/default fallback:
  - `frontend/lib/server/api/agentSafetyPolicyControlPlane.ts` adds `resolveRuntimeSafetyProfile` with bounded in-process cache (`STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS`).
  - `frontend/pages/api/ai/studio-agent.ts` and `frontend/features/agent-runtime/legacyImageDescribeService.ts` now resolve profile from the shared runtime resolver.
- Added production activation guard for high-risk debug profile:
  - `frontend/pages/api/admin/agent-safety-policy/activate.ts` now rejects `dev_absolute_zero` when `NODE_ENV=production`.
- Added targeted regression coverage:
  - `frontend/lib/server/api/__tests__/agentSafetyPolicyControlPlane.runtimeProfile.test.ts`
  - updated `frontend/tests/api/admin-agent-safety-policy-activate.test.ts` with production guard coverage.
- Added and documented runtime sync control knobs:
  - `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED` (default true)
  - `STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS` (default 5000, bounded `1000..60000`)
  - docs updated in `README.md`, `docs/api/api-internal-routes.md`, `docs/sops/sop_ai_studio_agent.md`, `docs/sops/sop_ai_studio_agent_safety_control_plane.md`, and `docs/troubleshooting.md`.

## 2026-03-02 (Wave G pass 1 prompt-adjacency contract normalization)

- Added shared prompt-adjacency seam:
  - `frontend/features/ai-studio/logic/promptAdjacency.ts`
  - centralizes chat-off create prompt resolution and agent-output generate request normalization.
- Wired the shared seam into:
  - `frontend/features/ai-studio/hooks/useAiStudioGenerationController.ts`
  - `frontend/pages/ai-studio.tsx`
- Added focused regression coverage:
  - `frontend/features/ai-studio/logic/__tests__/promptAdjacency.test.ts`
  - extended `frontend/features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`
  - revalidated `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`
- Updated Wave G/Phase 13 planning evidence and trackers:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-g-pass-1-prompt-adjacency-contract-normalization.md`
  - `docs/planning/ai-studio-ux-prompt-adjacency-rollout-tracker.md`
  - `docs/planning/evidence/unified-buildout/phase-13/README.md`
  - `docs/planning/stages/unified-phase-13-cross-plan-master-rollout.md`
  - `docs/planning/shortpulse-unified-buildout-tracker.md`
- Validation evidence:
  - `cd frontend && npm run test -- features/ai-studio/logic/__tests__/promptAdjacency.test.ts features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts` passed.
  - `cd frontend && npm run test -- features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts` passed.
  - `cd frontend && npm run type-check` passed.
  - `cd frontend && npm run lint` passed.

## 2026-03-02 (Wave G pass 2 local validation window 1)

- Completed Wave G local UX consistency validation packet for prompt-adjacent surfaces:
  - `features/ai-studio/components/__tests__/PromptStep.actions.test.tsx`
  - `features/ai-studio/hooks/__tests__/useAiStudioPanelProps.test.ts`
  - `features/ai-studio/hooks/__tests__/useAiStudioSessionRestoreHydration.test.ts`
  - `prefabs/agent/panels/__tests__/AgentChatPanel.actions.test.tsx`
  - `features/ai-studio/logic/__tests__/promptAdjacency.test.ts`
  - `features/ai-studio/hooks/__tests__/useAiStudioGenerationController.test.ts`
- Validation result:
  - targeted packet passed (`67` tests),
  - `cd frontend && npm run lint` passed,
  - `cd frontend && npm run type-check` passed,
  - `cd frontend && npm run build` passed,
  - `cd frontend && npm run docs:check` passed.
- Added evidence and tracker updates:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-g-pass-2-local-validation-window-1.md`
  - updated Wave G tracker/status and Phase 13 evidence index + stage/buildout tracker notes.

## 2026-03-02 (Phase 13 Wave H pass 1 operator packet readiness)

- Completed Wave H H1 readiness artifacts for controlled webhook canary execution:
  - added operator packet evidence note with frozen UTC windows and locked command chain:
    - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-h-pass-1-operator-packet-readiness.md`
  - added window execution templates:
    - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-h-canary-window-1-template.md`
    - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-h-canary-window-2-template.md`
- Updated canonical Wave H planning/tracking docs to mark H1 complete and H2 pending execution:
  - `docs/planning/ai-studio-webhook-canary-closeout-plan.md`
  - `docs/planning/ai-studio-webhook-canary-closeout-tracker.md`
- Synced canonical Phase 13 governance trackers/logs:
  - `docs/planning/stages/unified-phase-13-cross-plan-master-rollout.md`
  - `docs/planning/shortpulse-unified-buildout-tracker.md`
  - `docs/planning/shortpulse-unified-decision-log.md` (Decision 039)
  - `docs/planning/evidence/unified-buildout/phase-13/README.md`

## 2026-03-02 (Phase 13 Wave H pass 2 pre-window local gate)

- Executed canonical Wave H pre-window local regression gate:
  - `bash scripts/phase11_shadow_checkpoint_gate.sh --quick`
- Validation result:
  - packet passed (`14` files, `98` tests),
  - gate status: `PASS`.
- Added local-gate evidence note:
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-h-pass-2-pre-window-local-gate.md`
- Updated Wave H/Phase 13 trackers for H2 in-progress state:
  - `docs/planning/ai-studio-webhook-canary-closeout-plan.md`
  - `docs/planning/ai-studio-webhook-canary-closeout-tracker.md`
  - `docs/planning/stages/unified-phase-13-cross-plan-master-rollout.md`
  - `docs/planning/shortpulse-unified-buildout-tracker.md`
  - `docs/planning/evidence/unified-buildout/phase-13/README.md`

## 2026-03-02 (Wave H evidence automation tooling)

- Added shared gate-evaluation helpers to reduce script duplication and lock threshold behavior:
  - `scripts/lib/phase11_gate_evaluator.mjs`
- Enhanced gate evaluator with machine-readable output mode:
  - `scripts/phase11_evaluate_gate_summary.mjs` now supports `--format text|json|both`.
- Added Wave H evidence packet generator for canary window logs:
  - `scripts/phase13_wave_h_capture_packet.mjs`
  - can emit markdown packet from SQL one-row JSON and optionally append to canonical window templates.
- Added npm command alias:
  - `npm -C frontend run phase13:waveh:capture`
- Updated Wave H operator docs to include optional packet automation command:
  - `docs/planning/ai-studio-webhook-canary-closeout-plan.md`
  - `docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-h-pass-1-operator-packet-readiness.md`

## 2026-03-02 (temporary closeout deferment lock for later full-sweep)

- Applied a temporary deferment lock across remaining Phase 13 operational closeout windows to pause execution until the planned full repo-wide sweep later this week.
- Set explicit resume target to `2026-03-06` (UTC) in canonical Wave H/Phase 13 planning docs.
- Updated canonical deferment status surfaces:
  - `docs/planning/ai-studio-webhook-canary-closeout-plan.md`
  - `docs/planning/ai-studio-webhook-canary-closeout-tracker.md`
  - `docs/planning/stages/unified-phase-13-cross-plan-master-rollout.md`
  - `docs/planning/shortpulse-unified-buildout-tracker.md`
  - `docs/planning/shortpulse-unified-decision-log.md` (Decision 040)

## 2026-03-02 (Media Library speed program: route + modal)

- Added server-authoritative media list API with authenticated tab/query keyset pagination and first-slice signed preview hydration:
  - `frontend/pages/api/media/list.ts`
  - `frontend/features/media-library/logic/mediaListApi.ts`
- Migrated Media Library route and AI Studio modal list controllers to use `/api/media/list` behind rollout flag with legacy direct-query fallback retained.
- Added Media Library performance rollout flags:
  - `SHORTPULSE_MEDIA_LIST_API_ENABLED`
  - `NEXT_PUBLIC_MEDIA_LIST_API_ENABLED`
  - `NEXT_PUBLIC_MEDIA_LIBRARY_VIRTUALIZATION_ENABLED`
  - `NEXT_PUBLIC_MEDIA_LIBRARY_VIDEO_BUDGET_ENABLED`
  - `NEXT_PUBLIC_MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED`
- Added route/modal open-to-first-media perf attribution events and wired timer-based logging.
- Added shared route/modal masonry virtualization and bounded video autoplay runtime:
  - `frontend/features/media-library/logic/mediaGridVirtualization.ts`
  - `frontend/features/media-library/hooks/useMediaMasonryVirtualization.ts`
  - `frontend/features/media-library/hooks/useMediaGridVideoBudgetController.ts`
  - integrated in route grid and modal grid renderers.
- Hardened signing/resolve instrumentation for route/modal tuning:
  - `frontend/pages/api/media/sign-batch.ts`
  - `frontend/pages/api/media/resolve-previews.ts`
  - `frontend/lib/mediaSignedUrlCache.ts`
  - `frontend/features/media-library/hooks/useMediaPreviewSigningController.ts`
- Added SQL migration for media cursor + search index hardening (`pg_trgm` + cursor composite indexes):
  - `sql/migrations/050_add_media_list_search_cursor_indexes.sql`
- Added/updated coverage:
  - `frontend/tests/api/media-list.test.ts`
  - `frontend/features/media-library/logic/__tests__/mediaGridVirtualization.test.ts`
- Updated operations/docs for list API + virtualization rollout and troubleshooting:
  - `frontend/.env.example`
  - `docs/api/api-internal-routes.md`
  - `docs/deployment.md`
  - `docs/sops/sop_media_performance_operations.md`
  - `docs/troubleshooting.md`

## 2026-03-02 (Profile account autosave toggle UI)

- Added a reusable profile preference toggle card for account settings:
  - `frontend/features/profile/components/ProfilePreferenceToggleCard.tsx`
- Wired `/profile?section=account` to existing autosave preference state:
  - `frontend/pages/profile.tsx` now reads/writes `user_preferences.media_autosave_enabled` through `useMediaAutosavePreference`.
- Added focused coverage for the reusable card and profile page wiring:
  - `frontend/features/profile/components/__tests__/ProfilePreferenceToggleCard.test.tsx`
  - `frontend/tests/pages/profile.account-settings.test.tsx`
- Updated route/surface docs and backlog evidence for the new account setting:
  - `README.md`
  - `docs/routes.md`
  - `docs/planning/backlog.md`

## 2026-03-02 (AI Studio model modal ordering + video keyframes picker policy)

- Enforced deterministic, provider-grouped model-chip ordering in AI Studio model modals across Create, Edit, and Video contexts:
  - `frontend/features/ai-studio/components/ModelModal.tsx`
- Updated video model-selection policy so standard Video mode excludes `fal-ai/veo3.1/first-last-frame-to-video`, while Keyframes mode remains first/last-frame-only:
  - `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`
- Added regression coverage for modal ordering and standard-vs-keyframes filtering behavior:
  - `frontend/features/ai-studio/components/__tests__/ModelModal.test.tsx`
  - `frontend/features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts`
- Synced documentation to reflect the shipped picker behavior:
  - `docs/sops/sop_video_generation.md`
  - `docs/sops/sop_ai_studio_index.md`

## 2026-03-02 (Media Library modal no-flash stale-refresh hardening)

- Fixed modal pagination/stale-refresh flashing where cards could disappear behind a blocking loading state:
  - `frontend/features/ai-studio/components/MediaLibraryModal.tsx`
- Added shared route/modal fetch-transition policy for reset vs preserve-rows semantics:
  - `frontend/features/media-library/logic/mediaFetchTransition.ts`
  - `frontend/features/media-library/hooks/useMediaTabDataController.ts`
- Added regression coverage for:
  - initial blocking loader behavior on empty first load,
  - non-blocking stale refresh with existing rows preserved,
  - load-more append behavior with no destructive row clearing.
- Updated media operations/troubleshooting docs for no-flash stale refresh validation:
  - `docs/sops/sop_media_performance_operations.md`
  - `legacy standalone Media Library UI SOP`
  - `docs/troubleshooting.md`

## 2026-03-02 (AI Studio agent inline preview drag/drop guard)

- Blocked drag initiation from inline assistant output preview media/status tiles so they cannot create reference-grid drops.
- Preserved assistant bubble text drag behavior for prompt-card creation and changed right-column mixed-drop routing to prefer prompt text over media URL hints.
- Added focused regression coverage for agent bubble drag behavior and right-column mixed-payload drop routing:
  - `frontend/prefabs/agent/panels/__tests__/AgentChatPanel.actions.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`
- Updated AI Studio agent chat ops SOP to reflect the new drag-source guard and prompt-first drop precedence:
  - `docs/sops/sop_ai_studio_agent_chat_ops.md`

## 2026-03-02 (Fal reliability drain + settlement integrity closeout)

- Completed focused Fal recovery drain execution using `/api/internal/generation-recovery/run` until convergence, including authenticated handling for Vercel deployment protection.
- Cleared stale queue/recovery blocker candidates (`sql/check_generation_queue_blockers.sql` stale-candidate query returned no rows after targeted replay/single-record cleanup).
- Verified settlement integrity post-drain (`sql/check_generation_settlement_integrity.sql`):
  - `missing_charge_count = 0`
  - `duplicate_charge_key_count = 0`
- Normalized final legacy state hygiene (`status='success'` + `recovery_state='recovering'`) to `recovered`; post-check summary no longer reports that bucket.

## 2026-03-04 (AI Studio reference-only session persistence documentation packet)

- Added a decision-complete, docs-only rebuild plan for reference-only AI Studio session persistence:
  - `docs/planning/ai-studio-session-persistence-reference-only-plan-2026-03-04.md`
- Added execution tracker for staged rollout, validation gates, and rollback stop conditions:
  - `docs/planning/ai-studio-session-persistence-reference-only-tracker-2026-03-04.md`
- Added ADR locking the reference-only persistence boundary decision:
  - `docs/adr/0029-ai-studio-reference-only-session-persistence.md`
- Added SOP runbook for staged enablement and immediate rollback operations:
  - `docs/sops/sop_ai_studio_session_persistence_reference_only.md`
- Updated docs indexes for discoverability:
  - `docs/README.md`
  - `docs/planning/README.md`
  - `docs/adr/README.md`
  - `docs/sops/README.md`
- No product/runtime code behavior changed in this docs packet.

## 2026-03-03 (Reference Grid heavy-load adaptive compaction + routing semantics hardening)

- Added a new runtime guardrail flag for optional heavy-load image long-edge compaction (default off):
  - `NEXT_PUBLIC_REFERENCE_GRID_HEAVY_LOAD_LONG_EDGE_COMPACTION`
  - wired in `frontend/lib/adaptive-media/flags.ts` and `frontend/.env.example`.
- Added pressure-level-2 long-edge compaction (dimensions only, no quality-param changes) for:
  - Adaptive Media V2 policy path (`frontend/lib/adaptive-media/policy.ts`)
  - Legacy reference-grid resolver path (`frontend/features/ai-studio/logic/referenceGridMedia.ts`)
  - parity behavior preserved between legacy and V2.
- Fixed reference-grid adaptive-preview routing semantics to require both flags (`ADAPTIVE_PREVIEW` and `ADAPTIVE_PREVIEW_QUALITY`) via shared helper:
  - `frontend/features/ai-studio/reference-grid/logic/referenceGridAdaptivePreview.ts`
  - wired into `ReferenceGrid` plus card-items/hydration/image-transcode controllers.
- Updated reference-grid telemetry/debug surface to report effective adaptive routing state:
  - `data-grid-adaptive-preview-enabled` now maps to the effective combined routing gate.
- Added/updated targeted coverage:
  - `frontend/lib/adaptive-media/__tests__/policy.test.ts`
  - `frontend/features/ai-studio/logic/__tests__/referenceGridMedia.test.ts`
  - `frontend/features/ai-studio/logic/__tests__/referenceGridMedia.parity.test.ts`
  - `frontend/features/ai-studio/reference-grid/logic/__tests__/referenceGridAdaptivePreview.test.ts`
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
- Updated operations docs for effective adaptive-routing semantics and optional heavy-load compaction control:
  - `docs/sops/sop_media_performance_operations.md`
  - `docs/troubleshooting.md`

## 2026-03-03 (AI Studio sessions save outage hotfix)

- Added SQL hotfix migration to resolve `upsert_ai_studio_session_snapshot` ambiguity failures (`SQLSTATE 42702`, `column reference "user_id" is ambiguous`) without changing function signature or retention semantics:
  - `sql/migrations/053_fix_ai_studio_session_upsert_ambiguity.sql`
- Added rollback pair restoring the original 044 function body:
  - `sql/migrations/rollback/053_fix_ai_studio_session_upsert_ambiguity_rollback.sql`
- Added focused API route tests for `/api/ai/sessions/save` validation and error-mapping behavior:
  - `frontend/tests/api/ai-sessions-save.test.ts`
- Updated troubleshooting docs with explicit error signature and remediation runbook:
  - `docs/troubleshooting.md`
- Operational containment during patch window:
  - set local `NEXT_PUBLIC_AI_STUDIO_SESSION_REMOTE_SHADOW_ENABLED=false` to suppress repeated remote-save 500 noise until migration is applied.

## 2026-03-03 (AI Studio session restore reference durability + model fallback hardening)

- Added restore-time signed URL rehydration for storage-path-backed session outputs so restored reference-grid cards resolve real media URLs instead of placeholder-only rows:
  - `frontend/features/ai-studio/logic/sessionRestoreMediaSigning.ts`
  - integrated into `frontend/features/ai-studio/hooks/useAiStudioState.ts` restore apply flow with stale-apply revision guarding.
- Added local-reference durability hook to convert blob/data reference previews into private storage-backed delivery without inserting `media_files` rows:
  - `frontend/features/ai-studio/hooks/useAiStudioSessionReferenceDurability.ts`
  - integrated into `frontend/features/ai-studio/hooks/useAiStudioState.ts`.
- Added non-breaking upload helper expansions that return `{ url, path }` metadata while preserving existing string-returning APIs:
  - `frontend/features/ai-studio/utils/imageUpload.ts`
  - `frontend/features/ai-studio/utils/videoUpload.ts`
- Added deterministic Edit startup model fallback policy (`Seedream 4.5 edit`) and applied null/invalid-model default handling symmetry between Create and Edit workflows:
  - `frontend/features/ai-studio/logic/modelSelectionPolicy.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioStateEffects.ts`
  - `frontend/features/ai-studio/hooks/useAiStudioWorkflowSettings.ts`
- Added focused regression coverage:
  - `frontend/features/ai-studio/logic/__tests__/sessionRestoreMediaSigning.test.ts`
  - `frontend/features/ai-studio/hooks/__tests__/useAiStudioSessionReferenceDurability.test.ts`
  - updated:
    - `frontend/features/ai-studio/logic/__tests__/modelSelectionPolicy.test.ts`
    - `frontend/features/ai-studio/hooks/__tests__/useAiStudioStateEffects.test.tsx`
    - `frontend/features/ai-studio/hooks/__tests__/useAiStudioWorkflowSettings.test.ts`
- Validation:
  - targeted session/model test suite (`42` tests) passes,
  - `npm -C frontend run lint` passes (one pre-existing unrelated warning in media-library hook),
  - `npm -C frontend run build` passes.

## 2026-03-07 (Expert Edit Crop tool activation)

- Implemented stage-accurate Crop workflow for Expert Edit:
  - no default crop ratio selection,
  - toggleable ratio chips (select/unselect),
  - centered max-fit crop guide overlay in the primary stage,
  - active-layer-only crop apply using current move/resize/rotate transform state.
- Added a dedicated crop compositor helper module and geometry utilities:
  - `frontend/features/ai-studio/logic/expertEditLayerCrop.ts`
  - `frontend/features/ai-studio/logic/__tests__/expertEditLayerCrop.test.ts`
- Wired Crop apply into `ExpertEditPanelView` and updated crop-panel behavior/tests:
  - `frontend/features/ai-studio/components/edit/ExpertEditPanelView.tsx`
  - `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
  - `frontend/styles/ai-studio-edit-expert.css`
- Documented the active Crop tool contract in image-generation SOP:
  - `docs/sops/sop_image_generation.md`

## 2026-03-07 (Expert Edit custom preset authoring + persistence)

- Refactored Expert Edit preset internals to canonical ID-based state (`selfie...custom_18`) while preserving deterministic canonical ordering and legacy label fallback mapping.
- Added inline custom preset authoring in the More Presets surface: custom chips now expose an edit button that opens a contained mini editor for preset name + prompt, with Save/Cancel, Escape, and editor-outside-close behavior.
- Preset panel interactions now resolve effective label/prompt from ID + custom overrides; clicking a selected preset continues to replace prompt text.
- Added account-level persistence for preset panel allocation IDs and custom preset overrides through `user_preferences` (`expert_edit_preset_panel_ids`, `expert_edit_custom_presets`) with local fallback and backward compatibility from legacy label storage.
- Added migration `056_add_user_preferences_expert_edit_preset_ids_and_custom_presets.sql`, rollback pair, and bootstrap-schema updates to include new columns/defaults.

## 2026-03-08 (Expert Edit styles rail redesign)

- Replaced the Expert Edit Styles modal with a right-rail Styles panel rendered below Reference Grid.
- Moved styles UI ownership to `AiStudioPageContent` with shared state (`isStylesPanelOpen`, `selectedStyleId`) so the left Styles button preview and right-rail selection stay synchronized.
- Updated Expert Edit Styles button behavior to toggle the right-rail panel (`aria-expanded`) and removed modal-only behavior/effects (dialog/backdrop/Escape/body scroll lock).
- Added right-rail styles split behavior in Reference Grid:
  - when styles are open, Canvas and Quick Slot Inventory are hidden,
  - Reference Grid and Styles are separated by a dedicated horizontal divider (`Resize Reference Grid and Styles sections`),
  - styles render as a 2-column card grid with 16 tiles, placeholders disabled, and visual selected state.
- Extracted shared style catalog + preview URL helper into `frontend/features/ai-studio/components/edit/expertEditStyles.ts` and reused it across left-button preview and right-rail cards.
- Updated tests and docs for the new interaction model:
  - `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/AiStudioPageContent.drop.test.tsx`
  - `docs/sops/sop_image_generation.md`.

## 2026-03-08 (Styles panel parity + workflow-themed selection polish)

- Extended shared Styles control parity into Expert Create composer so Create and Edit both toggle/use the same right-rail Styles panel state.
- Updated styles rail card density to 3 columns and retained the 16-tile catalog contract (active tiles selectable, placeholders disabled).
- Added workflow-themed styles selection visuals across both surfaces:
  - Styles button open/active state and title text color now follow selected workflow theme.
  - Right-rail selected style card border/fill now follows selected workflow theme.
  - Theme mapping: Create/Text = blue, Edit/Image = amber, Video/Kling = violet, Canvas = cream.
- Expert-mode styles panel polish:
  - helper text hidden in expert mode,
  - helper copy updated for current selection behavior plus forthcoming drag/drop workflow messaging.
- Updated/extended focused regression coverage:
  - `frontend/features/ai-studio/components/__tests__/CreatePropertiesPanel.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/ExpertEditPanelView.test.tsx`
  - `frontend/features/ai-studio/components/__tests__/ReferenceGrid.curated.test.tsx`.

## 2026-03-08 (AI Studio primary Styles Library panel)

- Implemented `Shortcuts -> Styles` as a real primary left-panel surface in AI Studio (no longer a coming-soon-only tool state).
- Added `StylesLibraryPanel` as a presentational, prop-driven boundary that renders the existing 16-tile style catalog (real tiles + disabled placeholders) with shared selection visuals.
- Kept style selection state centralized in `AiStudioPageContent` so primary styles panel, Expert Create styles control, and Expert Edit styles control remain synchronized.
- Selecting the primary Styles tool now keeps the right rail visible in reference-grid-only mode (Canvas/Quick Slot/Styles subpanels hidden).
- Preserved existing right-rail styles behavior for expert workflows; no generation/pricing/provider behavior changes.
- Added a dedicated stylesheet for the primary panel (`frontend/styles/ai-studio-styles-library.css`) and wired it through `frontend/styles/globals.css`; updated docs (`docs/routes.md`, `docs/styles-structure.md`).
- Added session-restore parity for `selectedTool="styles"` in snapshot hydration allowlist (`sessionSnapshotHydrator`).

## 2026-03-08 (AI Studio primary Presets Library panel)

- Implemented `Shortcuts -> Presets` as a real primary left-panel surface in AI Studio (removed from coming-soon tool handling).
- Added `PresetsLibraryPanel` as a presentational, prop-driven boundary that renders the full Expert Edit preset catalog from canonical preset definitions with custom override labels/prompts applied.
- Kept primary Presets selection browse-only in v1: selecting a tile updates local highlight state only (no prompt apply, no preset-panel mutation, no drag/drop wiring).
- Wired `presets` into `resolvePropertiesPanelKind` and the `AiStudioPageContent` panel registry while keeping the right rail visible when Presets is selected.
- Added a dedicated stylesheet for the primary panel (`frontend/styles/ai-studio-presets-library.css`) and wired it through `frontend/styles/globals.css`; updated docs (`README.md`, `docs/routes.md`, `docs/styles-structure.md`, `docs/sops/sop_ai_studio_index.md`, `docs/sops/sop_image_generation.md`).
- Added session-restore parity for `selectedTool="presets"` in snapshot hydration allowlist (`sessionSnapshotHydrator`) and expanded focused AI Studio regression tests.

## 2026-04-19 (AI Studio Pulse Presets library panel)

- Added `Libraries -> Pulse Presets` as a new primary left-panel surface in AI Studio and placed it directly above `Prompt Presets` in the Libraries rail.
- Implemented a raw `PulsePresetsLibraryPanel` that intentionally mirrors the Prompt Presets panel visually while keeping its catalog and edit/delete/create state local-only and uncoupled from Prompt Presets persistence.
- Added a dedicated stylesheet for the panel (`frontend/styles/ai-studio-pulse-presets-library.css`) and wired it through `frontend/styles/globals.css`; updated docs (`README.md`, `docs/routes.md`, `docs/styles-structure.md`, `docs/sops/sop_ai_studio_index.md`, `docs/sops/sop_image_generation.md`).
- Added tool routing, session hydration allowlist support, and focused AI Studio regression coverage for `pulse-presets`.

## 2026-03-08

- Added AI Studio primary Styles Library delete UX: hovering a real style tile now reveals a destructive `X` action, and clicking it opens a compact yes/no confirmation modal.
- Wired per-user style deletion persistence through `user_preferences.ai_studio_deleted_style_ids` with local fallback, shared selection synchronization, and catalog filtering across both primary Styles Library and right-rail styles surfaces.
- Added SQL migration + rollback (`057_add_user_preferences_ai_studio_deleted_style_ids`) and updated bootstrap/docs parity (`sql/create_user_preferences_table.sql`, migration docs, routes map, data dictionary, security checklist).
- Updated styles-library panel CSS for top-row breathing room and touch-device delete-button accessibility.
- Added Styles Library tile edit modal: clicking a non-placeholder style now opens a popup with editable fields for `Style`, `Title`, `Reference Image Name`, and `Style Prompt`.
- Added per-user style-detail persistence via `user_preferences.ai_studio_style_details_overrides` with local fallback and shared catalog synchronization across primary Styles Library and right-rail style selectors.
- Added SQL migration + rollback (`058_add_user_preferences_ai_studio_style_details_overrides`) and updated user-preferences bootstrap/schema/docs parity.
- Updated Styles tool shell behavior: opening primary Styles Library no longer hides the entire right rail; right rail now remains visible in reference-grid-only mode (Canvas/Quick Slot/Styles subpanels hidden).
- Removed generated placeholder style cards from the shared style catalog so both the primary Styles Library and right-rail Styles panel now show only loaded, selectable styles.
- Added a persistent trailing `+` card in the primary Styles Library; clicking it appends a new placeholder style card directly before the `+` card.
- Added drag-and-drop reordering for primary Styles Library cards so users can rearrange style-card positions directly in the grid.

## 2026-03-09 (AI Studio primary Presets Library modal editing)

- Updated primary Presets Library cards so clicking a preset opens a modal editor for preset name + prompt text.
- Added save/cancel modal workflow with required-field validation, Escape/outside-close handling, and save error feedback.
- Wired Presets Library save actions into shared preset overrides so renamed/edited presets immediately reflect across the resolved preset catalog.
- Expanded preset override normalization to accept canonical preset IDs (not only `custom_*`), enabling edits for both base and custom preset cards with existing per-user preference persistence.
- Added focused tests for Presets Library modal editing and preset override normalization behavior.
- Re-seeded all default `Custom 1..18` preset prompt bodies to a shared editable placeholder so new/unaltered custom presets start as blank cookie-cutter templates.
- Updated primary Presets Library tile chrome so the `CUSTOM` pill hides once a custom preset has any saved override state.

## 2026-03-10 (dashboard simplification toggle + new project CTA)

- Added a temporary dashboard client flag `NEXT_PUBLIC_DASHBOARD_HIDE_LEGACY_SECTIONS` (default `true`) to keep legacy quick-start/workflow cards, tools grid, Searches header metric, and footer helper text hidden during redesign.
- Restored legacy dashboard sections behind the flag so setting `NEXT_PUBLIC_DASHBOARD_HIDE_LEGACY_SECTIONS=false` re-enables the prior launchpad blocks without code restoration.
- Added and polished a single `New Project` quick-start card in the welcome row that opens `/ai-studio`, including refined CTA chip styling and responsive behavior for mobile layouts.
- Updated docs and env example to advertise the flag and current `/dashboard` behavior (`README.md`, `docs/routes.md`, `frontend/.env.example`).

## 2026-03-11

- Realigned Media Library documentation to a `Target Contract + Current Runtime Delta` model with `All Media` master-folder semantics.
- Updated `docs/sops/sop_ai_studio_media_library_operations.md` with explicit `All Media` sectioned display contract (prompt text cards + image/video masonry at true aspect ratio), right-click media ingest to Reference Grid, folder membership move/assign semantics, deletion semantics, and folder-canvas domain requirements.
- Updated dependent references in `legacy standalone Media Library UI SOP`, `docs/sops/sop_ai_studio_index.md`, `docs/sops/sop_ai_studio_session_persistence_reference_only.md`, `README.md`, `docs/routes.md`, and `docs/api/api-internal-routes.md` for consistency.
- Added `docs/adr/0032-ai-studio-media-library-target-ux-and-folder-canvas-domains.md` and updated ADR/index discoverability (`docs/README.md`, `docs/adr/README.md`, `docs/sops/README.md`).

## 2026-03-13

- Media Library preview stabilization Phase 2 foundation: added migrations `065_add_media_derivative_processing_fields.sql` and `066_add_media_derivative_processing_rpcs.sql` (with rollback scripts) for derivative retry/lease controls and service-role-only claim/update RPCs.
- Added internal derivative worker route `POST /api/internal/media-derivatives/run` (`GET` compatible) with cron-secret auth, `SKIP LOCKED` claim execution, transformed-source thumb generation (`thumb_240`, `thumb_480`), variant upserts, and ready/failed status transitions.
- Added runtime flags parser (`mediaDerivativesRuntimeFlags`) and focused tests for route behavior + flag parsing.
- Updated runtime SQL security audit expected-function checks to include derivative RPCs.
- Synced docs/operations references across README, API internal route inventory, migration runbooks, performance/media SOPs, security checklist, data dictionary, ADR index, and added ADR `0037` for Supabase-first derivative-worker architecture.

## 2026-03-13 (production Supabase credential wiring + migration guardrail)

- Updated production environment wiring posture for Supabase: documented required Vercel Production keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and GitHub Environment `SUPABASE_DB_URL` targeting in `docs/deployment.md`.
- Added deployment-time verification guidance for environment scoping (`production` vs `staging`) and retained staging isolation expectations for Vercel Preview.
- Added temporary migration safety guardrail script `scripts/db_migrate_guardrail.mjs` and rewired `npm run db:migrate` to fail closed until hosted migration authority is unified.
- Updated `docs/database-migrations.md` with explicit hosted promotion policy: environment-pinned SQL apply required for staging/production and explicit `--project-ref` pinning required for production one-off CLI operations.

## 2026-03-13 (production Supabase cutover handoff log + resume runbook)

- Added a comprehensive paused-state handoff document at `docs/planning/supabase-production-cutover-handoff-2026-03-13.md` with full execution status, environment topology, validation evidence, open risks, and a phased resume plan.
- Recorded production cutover evidence in the handoff doc: runtime smoke status, preview isolation status, media drift/constraint status, runtime SQL audit status, and unresolved CI workflow discoverability gap.
- Updated docs discoverability indexes (`docs/README.md`, `docs/planning/README.md`) so the cutover handoff can be found quickly when resuming implementation.

## 2026-03-14 (deployment route-parity hardening gate)

- Added `scripts/verify_deployment_route_parity.mjs` to validate deployment-target route parity before operational actions (drain/recovery/derivative workflows), with hard-fail behavior when required routes are missing.
- Script contract:
  - resolves target via `vercel inspect --format=json`,
  - validates required internal route inventory (default: generation recovery + media derivatives),
  - supports repeated `--required-route`,
  - supports env fallback loading through shared `scripts/lib/load_local_env.mjs`,
  - prints resolved deployment URL + creation timestamp for alias drift diagnostics.
- Added focused regression coverage `frontend/tests/api/internal-route-inventory-regression.test.ts` to freeze internal route module inventory/default exports for:
  - `pages/api/internal/generation-recovery/run.ts`
  - `pages/api/internal/media-derivatives/run.ts`
- Updated deployment/release/troubleshooting docs to require route-parity verification before scheduler URL updates and pre/post deploy operations:
  - `docs/deployment.md`
  - `docs/release-checklist.md`
  - `docs/troubleshooting.md`

## 2026-03-14 (media transform sunset + local derivative engine)

- Added shared signed-transform policy (`frontend/lib/mediaSignedTransformPolicy.ts`) and rewired media signing paths (`/api/media/list`, `/api/media/sign-batch`, `/api/media/resolve-previews`, and client signed-url cache) to require dual explicit flags before applying transforms.
- Added transform policy env contract (`SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED`, `NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED`) and defaulted behavior to transform-off.
- Reworked derivative processing to local `sharp` generation (`thumb_240`, `thumb_480`) from source-object downloads, removing transformed-source fetch dependence while keeping existing claim/ready/failed RPC contracts unchanged.
- Added deterministic local derivative failure-class semantics (`unsupported_input`, `decode_failed`, `upload_failed`, `variant_upsert_failed`) and updated focused route/processor/signing tests.
- Added ADR `docs/adr/0039-media-library-transform-sunset-and-local-derivative-engine.md` and synced related docs (`README.md`, `docs/deployment.md`, `docs/troubleshooting.md`, `docs/sops/sop_media_performance_operations.md`, ADR indexes).

## 2026-03-14 (Kie video status reliability hardening)

- Hardened provider-aware status parsing seams so `modelId` is threaded consistently across status/result/media helpers in `falStatusProxy` and response-url probe runtime.
- Extended Kie Veo record-info normalization and contracts for `data.successFlag`, `data.response`, and `data.response.resultUrls` to prevent false terminal failures when provider media is present.
- Split terminal no-media settlement semantics from explicit provider-failure settlement: no-media now syncs recovery as completed-without-media (recoverable `terminal_success_no_media`) while preserving user-facing error behavior and fail-release billing semantics.
- Added optional `modelId` to dispatched queue-status payloads and client polling provider resolution so generic `kie` dispatches cannot misroute Kling vs Veo polling.
- Added focused regression tests across status proxy, Kie envelope/status/media contract boundaries, queue polling, and queue-status route payload shape.
- Updated runtime docs and SOP incident guidance to reflect current Kie Veo runtime-gated state and no-media false-fail guard behavior.

## 2026-03-14 (admin fleet health automation)

- Added fleet health automation migration `067_add_admin_user_health_fleet_automation.sql` (+ rollback) with compact persistence tables (`admin_user_health_scan_runs`, `admin_user_health_snapshots`, `admin_user_health_snapshot_findings`), retention helper RPC (`prune_admin_user_health_history`), and active-user target resolver RPC (`list_admin_user_health_active_targets`).
- Added modular server implementation under `frontend/lib/server/adminUserHealth/`:
  - `deep.ts` shared deep-diagnostics helpers (consumed by `/api/admin/user-health`),
  - `fleet.ts` set-based active-user scan pipeline (bounded batching, partial-run handling, retention prune, optional report-only incident emission),
  - `policy.ts` shared findings/risk mapping,
  - `runtime.ts` fleet env/runtime flag contract,
  - `types.ts` fleet domain contracts.
- Added new routes:
  - `GET|POST /api/internal/admin-user-health-fleet/run` (cron-secret/bearer protected runner),
  - `GET /api/admin/user-health-fleet` (admin read API for run summary + paginated snapshots).
- Added dedicated admin page `/admin/user-health-fleet` with severity/risk/finding/search filters, summary cards, degraded-state banner, and drill-down links into `/admin/user-health` and `/admin/generation-trace`.
- Added focused regression coverage:
  - `frontend/tests/api/internal-admin-user-health-fleet-run.test.ts`,
  - `frontend/tests/api/admin-user-health-fleet.test.ts`,
  - `frontend/tests/lib/admin-user-health-policy.test.ts`,
  - updated `internal-route-inventory-regression` and runtime SQL audit script tests for new fleet route/functions.
- Hardened operational parity checks and docs for the new internal route:
  - updated `scripts/verify_deployment_route_parity.mjs` default required routes,
  - updated deployment/troubleshooting route parity docs to include `/api/internal/admin-user-health-fleet/run`.
- Added fleet operations documentation package:
  - `docs/archive/planning/admin-user-health-fleet-implementation-plan-2026-03-14.md`,
  - `docs/sops/sop_admin_user_health_fleet_operations.md`,
  - and updated README, routes map, monitoring, internal API inventory, migration docs, SQL SOPs, billing/recovery SOP cross-links, docs indexes, and security checklist.

## 2026-03-14 (AI Studio right-rail styles density update)

- Updated the shared right-rail Styles grid density from 3 to 4 tiles per row for Expert Edit and Expert Create workflows.
- Added a narrow-viewport fallback that restores 3 columns at `max-width: 1320px` to avoid over-compressed tiles when the rail is constrained.
- Kept scope CSS-only in `frontend/styles/ai-studio-reference-grid-split.css` with no changes to selection/state behavior.

## 2026-03-14 (admin fleet staging setup walkthrough)

- Added `docs/sops/sop_admin_user_health_fleet_staging_walkthrough.md` with a simple end-to-end checklist for staging setup.
- Documented exactly where each value is sourced (`Staging Vercel` vs `Staging Supabase`) and provided copy/paste SQL for Vault upserts and verification queries.
- Added quick symptom-based troubleshooting (`401`, `404`, no run rows) and explicit guidance about Vercel protection blocking Supabase cron callbacks.
- Updated SOP indexes in `docs/README.md` and `docs/sops/README.md` to include the new walkthrough.

## 2026-03-14 (AI Studio pricing recalibration Phase B/C checklist)

- Added `docs/archive/planning/ai-studio-pricing-recalibration-phase-b-c-execution-checklist-2026-03-14.md` as the operational runbook for remaining pricing recalibration phases.
- Captured Phase B implementation gates (shared conversion, dynamic-settings preservation, cross-layer parity, and test commands) and Phase C docs/metadata sync gates.
- Updated planning indexes in `docs/planning/README.md` and `docs/README.md` for discoverability.

## 2026-03-14 (AI Studio pricing recalibration Phase B/C execution closeout)

- Completed Phase B/C checklist execution and marked all gates complete in:
  - `docs/archive/planning/ai-studio-pricing-recalibration-phase-b-c-execution-checklist-2026-03-14.md`
  - `docs/archive/planning/ai-studio-model-pricing-audit-checklist-2026-03-14.md`
- Re-ran full targeted pricing/debit parity suite (`115` tests) and docs integrity checks; all gates passed.

## 2026-04-23 (Pulse workflow session banner)

## 2026-04-23 (Pulse workflow session persistence + build validation recovery)

- Added minimal persisted workflow session state for active `workflow_gpt` Pulses in AI Studio session snapshots.
- Session persistence now stores and restores a derived Pulse workflow session payload alongside the agent snapshot, including workflow status, current step metadata, collected user inputs, and prompt preview when available.
- Threaded the restored Pulse workflow session back into the hidden Pulse runtime context so guided Pulses can resume with explicit step state instead of relying only on transcript inference.
- Added regression coverage for snapshot serialization/hydration, page session persistence wiring, agent bridge hydration, agent context serialization, and route-envelope sanitation of Pulse workflow session metadata.
- Fixed the pre-existing TypeScript build blocker in `frontend/pages/api/admin/billing-diagnostics.ts` by narrowing filtered error messages to real strings before schema-compatibility checks.

- Added a lightweight in-chat workflow session banner for active `workflow_gpt` Pulses in Expert Create `Pulse` mode.
- The chat surface now shows the active Pulse name, current guided-session status, and the exact first step before the workflow conversation begins.
- The banner now also infers and displays `Step N` plus the current step prompt when workflow messages follow explicit `Step N - ...` formatting.
- Documented the structured workflow builder (`Role & Goal`, `Step Flow`, `Final Output Shape`, `Additional Rules`) and the new in-chat workflow banner in the README and Create wiring SOP.

## 2026-03-14 (AI Studio preflight timeout docs alignment)

- Updated image-generation SOP timeout semantics to match runtime behavior: reference prep now uses dynamic budgeting (`base + per-work-unit + local-upload bonus`, capped) and abortable stage execution.
- Updated Create properties generation wiring SOP to reflect dynamic reference preflight and stage breadcrumb diagnostics (`generation_preflight_prepare_stage`).
- Updated video-generation SOP to document shared image-input preflight timeout behavior and fail-fast timeout message parity.
- Added troubleshooting runbook coverage for `Preparation timed out before generation started. Please retry.` including `generation_preflight_timeout` log metadata and stage-level breadcrumb triage for `fetch_local_image`, `upload_image_route`, and `refresh_signed_url`.

## 2026-03-16

- Added `docs/planning/mvp-ui-ux-pass-execution-plan-2026-03-16.md`, a tactical pass-by-pass remediation checklist for `UX1`/`UX2`/`UX3` plus modularization kickoff (`UX5-01`) with dated sequencing, acceptance criteria, and validation commands.
- Updated planning indexes to include the new execution artifact (`docs/README.md`, `docs/planning/README.md`).

## 2026-03-16 (Lane A docs governance normalization + tracking closeout)

- Completed Lane A docs governance normalization pass with no runtime behavior changes:
  - removed duplicate route rows and corrected stale source references in `docs/api/api-internal-routes.md`,
  - corrected migration-reference drift in `docs/planning/supabase-production-cutover-handoff-2026-03-13.md` (current baseline through `069_*`),
  - repaired active index parity across `docs/README.md`, `docs/planning/README.md`, `docs/planning/evidence/README.md`, `docs/product/README.md`, `docs/design/README.md`, and `docs/adr/README.md`.
- Added a minimal task-contract governance baseline for agent-driven execution:
  - roadmap-level task contract in `docs/planning/foundation-lanes-master-roadmap-2026-03-16.md`,
  - per-slice task contract + parity closeout checks in `docs/archive/planning/lane-a-execution-plan-2026-03-16.md`,
  - tracker schema extensions for DoD/audit/parity fields in `docs/archive/planning/lane-a-tracker-spec-2026-03-16.md`,
  - evidence packet contract expansion in `docs/records/evidence/generation-pipeline-hardening/README.md`,
  - PR template enforcement checkboxes in `.github/pull_request_template.md`.
- Closed Lane A documentation tracking drift:
  - added Lane A evidence packets for size-budget gate recovery (`A1-02`), validate relock (`A1-03`), policy-surface alignment (`A2-01`), and docs governance cleanup (`A3-01`),
  - reconciled Lane A execution-plan status rows and global tracker evidence references.
- Validation: `npm -C frontend run docs:check` and `npm -C frontend run validate` both passed (`412` files / `2615` tests; lint warnings unchanged at baseline `7`).

## 2026-04-20 (AI Studio Pulse runtime planning doc set)

- Added the full Pulse runtime planning set under `docs/planning/`:
  - `ai-studio-pulse-runtime-master-plan-2026-04-20.md`
  - `ai-studio-pulse-runtime-tracker-2026-04-20.md`
  - `ai-studio-pulse-runtime-decision-log-2026-04-20.md`
  - `ai-studio-pulse-runtime-phase-0-v1-contract-and-stop-rules-plan-2026-04-20.md`
  - `ai-studio-pulse-runtime-phase-1-domain-model-and-storage-plan-2026-04-20.md`
  - `ai-studio-pulse-runtime-phase-2-client-runtime-state-plan-2026-04-20.md`
  - `ai-studio-pulse-runtime-phase-3-session-persistence-plan-2026-04-20.md`
  - `ai-studio-pulse-runtime-phase-4-agent-contract-and-transport-plan-2026-04-20.md`
  - `ai-studio-pulse-runtime-phase-5-server-runtime-activation-plan-2026-04-20.md`
  - `ai-studio-pulse-runtime-phase-6-surface-unification-and-activation-ux-plan-2026-04-20.md`
  - `ai-studio-pulse-runtime-phase-7-validation-docs-and-rollout-plan-2026-04-20.md`
- Locked the repo-audited V1 Pulse direction:
  - one saved `PulseDefinition` authority,
  - one active Pulse runtime per Create session,
  - Pulse activation as hidden runtime behavior instead of composer mutation,
  - V1 implemented as a profile-aware layer on top of the current AI Studio prompt-compiler runtime.
- Updated `docs/README.md` and `docs/planning/README.md` so the full plan set is discoverable.
- Added an explicit program done state and completion stop rule so the Pulse runtime program must stop once complete, and accidental follow-up requests to continue the same program are treated as mistakes unless a new separate scope is opened.
- Rewrote the Pulse plan set to make Pulse authoring/build/manage UX first-class scope alongside runtime activation, so the program cannot be marked done if activation works but users still lack the intended custom-GPT-style creation workflow.
- Extended the Pulse plan set again after a repo + external-research comparison to explicitly cover:
  - direct OpenAI bypass compatibility,
  - Pulse-mode chat/style shell semantics,
  - Create-rail topology versus full library behavior,
  - alignment with broader AI Studio session-persistence gates,
  - multimodal/context visibility rules,
  - and telemetry/eval posture for Pulse rollout.
- Added explicit recommended V1 defaults to the Pulse Phase 0 plan and master plan so implementation can start from one coherent posture instead of reopening every contract branch.

## 2026-04-23 (Pulse workflow completion semantics)

- Carried `workflow_gpt` semantic completion status through the shared runtime success paths so message-only `chat_reply` workflows can finish as durable completed sessions instead of being treated as generic awaiting-input turns.
- Updated `/api/ai/studio-agent` and coordinator success handling so completed workflow replies persist `lastArtifact` plus `finalArtifactSource` when the model returns a final chat artifact with semantic `ready`.
- Added regressions for:
  - API-route completion of a built-in `Story Builder` `chat_reply` workflow artifact,
  - hydration of completed Pulse workflow artifacts with persisted completion source,
  - and full frontend build/runtime validation on the updated completion contract.
- Corrected the Pulse docs and planning language so they no longer describe workflow-session state as transcript-derived/UI-only and no longer imply a Pulse-specific rollout gate that the product does not use.
- Updated the Pulse master plan, tracker, and Phase 7 closeout doc to reflect actual implementation posture: Phases 0-6 complete, Phase 7 in progress, and the remaining closeout work narrowed to explicit telemetry/eval documentation plus a decision on the separate pre-existing `docs/routes.md` semantic-drift blocker.
- Documented the explicit Pulse telemetry/eval posture in `docs/monitoring.md`, including the split between studio-agent route telemetry and authoritative `pulseWorkflowSession` state.
- Classified the lingering `docs/routes.md` semantic-drift failure as a separate repo-wide docs-governance issue outside Pulse scope, then closed the Pulse master plan, tracker, and Phase 7 plan as complete.

## 2026-04-27 (Agent regression remediation split + status normalization)

- Archived the completed remediation `Phase 2` and `Phase 3` execution plans out of `docs/planning/` into `docs/archive/planning/` because those closeout docs were still indexed as active even though the family now continues from the master roadmap/tracker and the remaining live Phase 1/Phase 4 contracts.
- Updated the active/archive indexes and remediation evidence READMEs so they point at the archived `Phase 2` and `Phase 3` plan paths instead of stale active-planning locations.
- Normalized the remaining `ai-studio-agent-pipeline-regression-*` family onto the canonical planning status vocabulary:
  - `active` for the live roadmap, tracker, Phase 1 route outcome contract, Phase 4 plan, and supporting governance contracts
  - `draft` for the still-pending `Phase 1` execution plan
  - `complete` for the archived `Phase 2` and `Phase 3` closeout plans

## 2026-04-27 (Agent rollout tracker status normalization)

- Normalized the `ai-studio-agent-modularization`, `ai-studio-agent-safety-control-plane`, and `ai-studio-ux-prompt-adjacency` plan/tracker pairs onto canonical `active` status values so those still-live execution packets stop contributing status drift in the active planning index.
- Normalized the deferred `ai-studio-webhook-canary-closeout` plan/tracker pair to canonical `draft` status values so the packet remains discoverable without pretending it is currently active execution work.

## 2026-04-27 (Foundation lanes status normalization)

- Normalized the `foundation-lanes-*` roadmap/tracker pair and the still-open Lane C packet to canonical `active` status values.
- Normalized the completed Lane A, B, D, E, F, and separate generation-pipeline hardening (`P1`) docs to canonical `complete` status values, including their tracker-spec and contact-map surfaces, so the remaining archive work is explicit instead of hidden behind mixed legacy status phrases.

## 2026-04-27 (Foundation archive wave A/D/E/F/P1)

- Archived the completed Lane A, D, E, and F planning packets plus the completed separate `P1` generation-pipeline hardening packet into `docs/archive/planning/`.
- Removed that completed subset from the active planning indexes, added it to the archive indexes, and retargeted the live foundation roadmap/tracker plus the related evidence packets to the archived paths.
- Left Lane B and Lane C in `docs/planning/`: Lane B still needs its own heavier archive pass because of broader reference sprawl, and Lane C remains the active foundation lane.

## 2026-04-27 (Foundation archive wave B)

- Archived the completed Lane B modularization packet into `docs/archive/planning/`.
- Removed Lane B from the active planning indexes, added it to the archive indexes, and retargeted the related ADR, follow-on planning docs, and Lane B evidence packet to the archived paths.
- The active foundation planning surface is now narrowed to the roadmap/tracker, the rebuild playbook, and the still-open Lane C regression-armor packet.
