# Holomony Training History

Purpose: record supervised Holomony training runs, prompt patterns, learned behavior, tooling updates, and next training focus.

## 2026-05-25: Shared-Surface Sensitivity And Stewardship Calibration

Task: synthesize why the user was highly protective around the Media Library preview-modal lane and convert that sensitivity into durable Holomony operating behavior.

Interaction audited:

- user repeatedly challenged whether the lane was real ROI or momentum
- user explicitly protected normal Edit panel behavior, stage zoom/pan, and image move/resize behavior
- Holomony was asked to infer the deeper reason for that hesitation instead of treating it as ordinary task friction

Actions taken:

- audited the interaction as a training/governance event instead of a one-off conversation
- distilled the core lesson into:
  - blast-radius awareness around shared AI Studio behavior
  - cost-of-change discipline
  - stewardship over existing working product interactions
  - explicit continue/pivot/stop boundaries
- updated Holomony memory with a durable rule for shared-surface bug lanes
- updated Holomony's local instructions so future shared-surface fixes must identify:
  - symptom
  - owning path
  - protected non-regression contract
  - smallest canonical fix worth shipping
- promoted the `approval-worthiness test` into live operating guidance so future sensitive lanes must be clearly defensible before Holomony asks for approval
- added a new failure pattern for expanding a valid bug lane into adjacent redesign or abstraction work

Training result:

- Holomony now treats shared AI Studio bug work as a stability-sensitive lane by default
- durable lesson recorded: the real task is often not just `fix the bug`; it is `fix the bug without spending stability on anything else`
- durable lesson recorded: user hesitation can be a signal about blast radius, trust, and cost-of-change, not resistance to progress
- Holomony now has a stronger stewardship rule:
  - preserve working interactions first
  - prove the owning source path
  - make the smallest ROI-positive canonical fix
  - stop once the lane is done
- Holomony now treats `approval-ready` as a real quality gate for sensitive shared-surface work, not just a communication nicety

Next training focus:

- apply the new shared-surface stewardship rule on the next AI Studio media/rendering bug lane
- self-audit future proposals for hidden scope creep before asking the user to approve them

## 2026-05-19: Approved-Panel Baseline Refresh And Classification Reset

Task: rerun fresh approved-surface production baselines after the measurement-tooling fixes and let the new evidence update Holomony's current-state judgment.

Actions taken:

- reran fresh 5-run production KPI captures for:
  - `ai-studio-panel`
  - `elements-media-panel`
- reran same-day production persistence audits for both approved surfaces
- promoted the new packets and persistence outputs into Holomony's retained reports
- updated Holomony memory, inventory, and ledger to retire the stale `done enough for now` classification
- recorded the new active blocker as mixed-open signing cost and first useful media paint, not resolver churn or persistence trust

Training result:

- durable rule recorded: when KPI logic or telemetry attribution changes materially, rerun fresh retained baselines before trusting the prior lane classification
- durable rule recorded: `persistence green` is not enough to close a runtime lane if fresh repeated KPI still shows fragile browse-open performance
- Holomony now treats fresh source-of-truth reruns as authority over older optimistic status summaries

Next training focus:

- use the refreshed approved-surface baselines to choose the next real product optimization lane
- keep Character expansion secondary until the approved-panel hot path is stronger or the evidence changes

## 2026-05-20: Holomony Identity Consolidation

Task: consolidate the assistant-owned local package so Holomony, not a separate temporary local folder, is the canonical local identity for media-performance work.

Actions taken:

- audited the newer temporary assistant-local surfaces against the existing Holomony corpus
- migrated the unique assistant-specific rules and helper-script concept into Holomony's contract, local instructions, memory, tools, and artifact README
- created Holomony-owned helper audits under:
  - `scripts/ops/holomony/holomony_folder_audit.sh`
  - `scripts/ops/holomony/holomony_media_performance_audit.sh`
- retired the redundant temporary local identity surfaces after preserving the useful lessons

Training result:

- Holomony is now the single local assistant folder for this lane
- the media-performance corpus stays in one canonical identity instead of being split across Holomony history and parallel local overlays
- durable lesson recorded: when an existing specialist already owns the real corpus, merge new self-governance into that specialist instead of creating a second parallel identity

Next training focus:

- use Holomony's own helper audits and retained tools as the default package on future media-performance runs
- do not recreate a separate parallel local folder for this lane unless the workflow later splits materially

## 2026-05-19: Measurement-Validity Answer Audit

Task: learn from the moment where Holomony answered the measurement-validity question correctly in direction but not at the best decision quality.

Interaction audited:

- user asked whether the measurement tools were still valid
- Holomony answered mostly correctly but blended together:
  - tool logic validity
  - evidence freshness
  - surface coverage completeness
- user then asked why the best answer was not given

Actions taken:

- audited the interaction as a training event instead of treating it as conversational noise
- updated Holomony memory with a durable rule for governance-answer layering
- updated Holomony's local instructions to require engineering-review style answers for trust and validity questions
- updated the standing SOP so future governance answers separate the decision layers explicitly
- added `answer-layer collapse` to the failure taxonomy

Training result:

- Holomony now has an explicit rule for these moments:
  - direct verdict first
  - then separate tool validity, evidence freshness, and coverage completeness
  - then state the best next move
- durable lesson recorded: a status summary can be factually right but still be the wrong answer if it does not expose the actual decision layers

Next training focus:

- apply this answer pattern automatically on the next user challenge about tool trust, KPI validity, or whether a lane should continue
- self-audit future meta/governance answers for decision quality, not just factual correctness

## 2026-05-18: Character Panel Media Assignment Onboarding

Task: expand Holomony toward the new character-panel media workflow without collapsing it into the existing panel KPI family.

Actions taken:

- audited the AI Studio Character panel host, split host, embedded media panel seam, character workspace, and character-owned persistence paths
- verified the character isolation and ownership ADRs against the live code boundary
- created a stable candidate surface id: `character-panel-media-assignment`
- added the candidate surface to Holomony's media-surface inventory with owner files, measurement path, correctness gates, and next need
- created a retained onboarding audit note instead of pretending a panel KPI packet already exists
- updated Holomony memory, SOP references, and scope rules so future runs do not misclassify the character workflow as just another panel

Training result:

- Holomony now distinguishes:
  - shared panel browse/runtime surfaces
  - character-owned assignment/persistence surfaces
- durable rule recorded: if a surface embeds shared media browse/runtime but persists through a different authority path, onboard it as a separate candidate surface
- the character workflow is now managed as a real candidate surface instead of an ambiguous scope edge

Next training focus:

- build a direct audit path for selection/drop-to-saved-character latency and failure rate
- prove save/reopen trust for the character-panel assignment workflow before promoting it beyond candidate status

## 2026-05-16: Kirk Page Style Lock

Task: preserve the preferred visual direction for Kirk's Holomony profile page.

Actions taken:

- iterated the page away from bubbly summary-card styling
- moved it toward a darker ShortPulse-style gray UI with light text and `#25a9bf` as the accent
- reshaped key sections to read more like engineering reports and data-backed status blocks
- recorded the approved visual direction in Holomony memory so future edits do not drift

Training result:

- durable style preference captured for `docs/agents/holomony/Kirk.html`
- preferred direction is now explicit:
  - dark technical layout
  - flatter surfaces
  - report-like sections
  - less decorative, more referenceable

Next training focus:

- keep future Kirk-page edits aligned with the saved visual direction
- avoid reintroducing bubbly cards or vague summary language

## 2026-05-15: Agent Setup

Task: establish Holomony as the media optimization and performance specialist.

Prompt summary:

```text
From now on you are going to act as my media optimization and performance specialist. Your name is "Holomony". Create your own folder in the repo and create your memory and artifacts areas there.
```

Actions taken:

- Loaded the repo startup contract and core docs.
- Loaded the agent-teaching setup and identity docs for agent creation.
- Audited the existing agent contract and artifact structure in the repo.
- Created Holomony's durable contract under `docs/agents/holomony/`.
- Created Holomony's retained artifact area under `docs/records/artifacts/agent/holomony/`.
- Indexed Holomony in the agent docs and retained artifact docs.

Training result:

- Holomony is initialized at `Level 1: Supervised`.
- Durable scope is set to media optimization, media KPI tooling, and media performance evidence work.

Next training focus:

- run Holomony on a real media-panel optimization or KPI lane
- capture and retain one production KPI packet
- turn repeated successful runs into a stronger Holomony SOP package

## 2026-05-15: Media Panel Optimization Retrospective Synthesis

Task: synthesize the full media-panel optimization workflow into durable Holomony training data.

Actions taken:

- reviewed the full lane from video preview coverage through KPI tooling and live AI Studio panel audit
- created a retained retrospective report capturing wins, drift, mistakes, durable lessons, and current unresolved items
- updated Holomony memory with the highest-value durable rules

Training result:

- Holomony now has a retained retrospective for this lane:
  - `docs/records/artifacts/agent/holomony/reports/archive/2026-05-15-media-panel-optimization-retrospective.md`
- Durable lesson recorded: upstream preview/readiness work and honest KPI tooling are the highest-value pattern for this media surface.
- Durable lesson recorded: dead-surface drift and environment-language drift are repeatable failure modes to avoid.

Next training focus:

- capture repeated production KPI packets for the AI Studio panel
- use those packets to isolate the next best ROI hotspot
- add KPI regression/compare mode once enough packet history exists

## 2026-05-15: Holomony Performance Package

Task: create the durable doc package used to score Holomony and improve performance over time.

Actions taken:

- created baseline KPI, performance scorecard, performance ledger, failure taxonomy, experiment ledger, capability ladder, and run-report template
- wired those docs into Holomony's retained artifact area
- validated doc integrity after creation

Training result:

- Holomony now has a real performance-management system, not just memory notes
- future runs can be scored, trended, compared, and analyzed for repeated failure modes

Next training focus:

- use the new scorecard and ledger on the next substantive Holomony run
- capture a real production AI Studio panel KPI packet and log the run with the new template

## 2026-05-15: Holomony Local Instruction Overlay

Task: create Holomony's own scoped instruction file inside its agent folder.

Actions taken:

- loaded repo startup, docs scope, and agent-teaching identity/maintenance guidance
- created `docs/agents/holomony/AGENTS.md` as Holomony's local execution overlay
- linked the new instruction file from Holomony's contract and the global agent index

Training result:

- Holomony now has a local instruction layer that sits below the root repo contract and above run-specific memory
- Holomony-specific execution rules for surface scope, scoring, artifact updates, and stop conditions are now durable and discoverable

Next training focus:

- use the new local instruction overlay during the next substantive Holomony run
- verify that scorecard, ledger, and failure-taxonomy updates stay proportionate rather than turning into documentation churn

## 2026-05-15: Holomony SOP Synthesis

Task: synthesize this conversation history into the standing SOP Holomony needs to perform its duties across approved media surfaces.

Actions taken:

- audited the current Holomony contract, memory, KPI SOP, media-performance SOP, and retrospective
- inferred which conversation patterns were durable enough to become standing process
- created `docs/agents/holomony/standard-operating-procedure.md`
- created a retained synthesis report explaining what should and should not become SOP

Training result:

- Holomony now has a single main operating SOP for media-performance work
- the SOP explicitly captures the remaining prerequisites Holomony still needs in order to fully own cross-surface media optimization

Next training focus:

- build the cross-surface inventory Holomony still needs
- capture repeated baseline KPI packets for each approved surface
- add regression/compare mode once packet history is deep enough

## 2026-05-15: Cross-Surface Inventory And Onboarding Tools

Task: create the next missing Holomony operating tools so cross-surface media optimization can expand without scope drift.

Actions taken:

- audited the systems catalog and repo owner files for current and candidate media-heavy surfaces
- created Holomony's cross-surface media inventory
- created a reusable onboarding checklist for bringing new surfaces into first-class Holomony scope

Training result:

- Holomony now has a durable inventory of approved and candidate media-heavy surfaces
- future surface expansion no longer has to rediscover owners, measurement paths, and baseline gaps from scratch

Next training focus:

- create the dedicated Elements embedded media panel capture path
- start building retained baseline packets for each approved surface

## 2026-05-15: Memory And Artifact Pruning

Task: prune Holomony artifact surfaces that add duplication and retrieval noise.

Actions taken:

- audited Holomony's active contract, memory, artifact index, and retained logs for overlapping roles
- removed the retained `memory.md` duplicate in the artifact area
- removed the separate `run-log.md` because its job was already covered by training history and the performance ledger
- updated artifact indexing and pruning rules so future runs do not recreate parallel low-value memory surfaces

Training result:

- Holomony now has fewer competing "small truth" files
- the active retained read path is cleaner and more execution-oriented

Next training focus:

- keep future retention proportional
- avoid creating a new file unless it has a distinct operational job that the current package does not already cover

## 2026-05-15: Elements Panel Capture Path Activation

Task: complete the Elements embedded media panel capture path so Holomony can measure both approved panel surfaces with the same KPI system.

Actions taken:

- verified the capture helper, tests, and embedded panel owner files against the live Holomony inventory
- confirmed the embedded panel exposes a stable labeled root for automation
- aligned the KPI SOP and Holomony retained inventory with the now-working `elements-media-panel` capture path

Training result:

- Holomony no longer has to treat Elements panel measurement as a partial manual exception
- the next operational gap is repeated retained baseline capture, not missing capture scaffolding

Next training focus:

- capture the first retained Elements baseline packet
- build regression/compare mode for retained KPI packets

## 2026-05-15: KPI Compare Mode

Task: add retained packet comparison so Holomony can judge whether an approved surface is actually improving over time.

Actions taken:

- extended the KPI scorer with `--compare <older> <newer>`
- added meaningful-improvement and meaningful-regression classification by metric type
- added comparison flags for weak evidence, coverage drops, and additional score caps
- updated the KPI SOP and Holomony retained tool inventory to treat comparison as a first-class workflow

Training result:

- Holomony can now compare retained runs instead of relying on memory or manual eyeballing
- the next operational leverage comes from capturing more retained packets, not inventing more scoring theory

Next training focus:

- capture repeated retained baseline packets for AI Studio and Elements
- use compare mode on the first real pair of retained packets per approved surface

## 2026-05-15: Production Panel Baseline Capture

Task: capture retained production KPI packet pairs for both approved panel surfaces and use compare mode on real retained data.

Actions taken:

- captured two retained production packets for `ai-studio-panel`
- captured two retained production packets for `elements-media-panel`
- used compare mode on both retained surface pairs
- recorded the retained report for the first production baseline evidence set

Training result:

- Holomony now has real retained packet history for both approved surfaces
- after correcting the capture helper, the shared panel weakness is clearer than before:
  - canonical preview coverage stayed weak
  - extra list churn stayed present
  - Elements still showed slightly worse visible state churn
- the initial fallback-storm diagnosis was a measurement bug, not a product truth

## 2026-05-16: Persistence Proof Audit Path

Task: close the media-panel persistence-proof gap without reopening runtime tuning by creating a dedicated save/reopen browse-readiness audit.

Actions taken:

- audited the existing AI Studio media save path, autosave orchestration, and project persistence audits
- chose a bounded proof path: upload through the real AI Studio Media panel, verify browse-ready visibility, reload and reopen, repeat the check in a fresh signed-in context, then delete the audit fixture
- created `frontend/tests/e2e/media-panel-persistence.audit.js`
- wired it into `frontend/package.json` as `npm run test:e2e:media-panel-persistence`
- documented the audit in `docs/testing-guide.md` and `docs/sops/sop_media_panel_performance_kpi.md`

Training result:

- Holomony now has a direct persistence-proof tool for the AI Studio media panel instead of treating persistence metrics as a theoretical KPI gap
- Durable lesson recorded: when runtime health is good and the remaining question is browse/save trust, add a bounded audit path before inventing another runtime optimization lane

Next training focus:

- run the new persistence audit against the approved audit account and retain the result
- use that retained evidence to populate `saveRoundtripFailureRate`, `saveRoundtripMismatchRate`, and `saveBrowseReadyRatio`
- only reopen runtime tuning if the persistence audit exposes a real product regression

## 2026-05-16: Production AI Studio Panel Persistence Proof

Task: run the new media-panel persistence audit against production and retain a direct save/reopen browse-readiness result.

Actions taken:

- ran `npm run test:e2e:media-panel-persistence` against `https://www.shortpulse.ai`
- corrected two audit-harness issues that the first live attempts exposed:
  - opening the panel before trying to upload
  - matching the image-grid action labels instead of the all-items-grid labels
- verified:
  - upload browse-ready visibility
  - reload + reopen browse-ready visibility
  - fresh signed-in context browse-ready visibility
  - cleanup of the audit fixture
- retained the result in `docs/records/artifacts/agent/holomony/reports/archive/2026-05-16-production-media-panel-persistence-audit.md`

Training result:

- the AI Studio media panel now has direct retained persistence proof:
  - `saveRoundtripFailureRate: 0`
  - `saveRoundtripMismatchRate: 0`
  - `saveBrowseReadyRatio: 1`
- durable lesson recorded: real browser audits are still valuable even after tooling is in place because they expose sequencing and selector-contract mistakes before those mistakes contaminate product diagnosis

Next training focus:

- keep the AI Studio runtime lane closed unless fresh evidence regresses
- decide whether Elements needs the same persistence proof path or whether current AI Studio proof is sufficient for this milestone stage

## 2026-05-16: Open-Phase KPI Honesty Correction

Task: harden the panel KPI capture so mixed `All Media` opens do not get mis-scored as preview-authority failures.

Actions taken:

- added open-phase `/api/media/list` payload summaries to the KPI capture helper
- added representative first-row sampling so retained evidence shows what actually sits at the top of the default panel open
- changed canonical preview coverage scoring so it only evaluates rows that had durable preview candidates available
- reran the live production AI Studio panel KPI capture after the tool correction

Training result:

- Holomony now distinguishes `mixed row set with audio-heavy top cards` from `durable-capable image rows lost to originals`
- the current strongest proven blocker for the default AI Studio panel open is now high sign-batch cost, not blanket preview-authority failure
- Holomony learned a durable rule:
  - never let a synthetic sign lane such as `uploaded_images` stand in for real row-class evidence on the default `All Media` surface

Follow-on result:

- root-tab-scoped capture is now live in the KPI helper
- the `Images` root tab proved healthy in production:
  - image-only row mix
  - durable thumb coverage across visible rows
  - `canonicalPreviewCoverageRatio: 1`
  - `signBatchP95Ms: 558`
- the `Audio` root tab did not reproduce the default-open slowdown on its own
- Holomony should now treat the default mixed `All Media` open path, not generic image browse, as the primary remaining product lane

Second follow-on result:

- a shared runtime cut now excludes audio rows from eager signing on the mixed `All Media` open for both AI Studio and Elements
- audio cards now render a lightweight on-demand shell instead of forcing immediate signed playback URLs
- the next repeated production captures on the default mixed open no longer reported open-phase sign batch telemetry on either approved panel
- Holomony should now treat settle quality and perceived mixed-open stability as the next likely weakness, not raw sign churn alone

Third follow-on result:

- Holomony added a real `stableContentSettleMsP95` capture path and reran repeated production `All Media` captures
- that made the next blocker more precise:
  - the mixed open can settle reasonably under the `2/3/2` mixed-open budget
  - but AI Studio still shows meaningful sign-cost pressure
- Holomony then tested a tighter `1/2/1` mixed-open sign budget
- that experiment reduced signed-row count, but it materially worsened first paint and settle on both approved surfaces
- the experiment was reverted immediately

Durable lesson recorded:

- do not equate fewer signed rows with a better mixed-open experience
- for the default mixed open, first paint and stable settle outrank signed-row minimization once list churn and audio eager-signing pressure are already under control
- keep the mixed-open budget at `2/3/2` unless future evidence shows a better tradeoff

Fourth follow-on result:

- a bounded audit found that the remaining mixed-open leak was not the main sign-budget path but the separate video browse-preview signing lane
- `MediaLibraryAllItemsGrid` already supported visibility-scoped browse-preview signing, but the AI Studio and Elements mixed-grid callers were not passing `visibleMediaIdsRef`
- after wiring that through, the repeated production `All Media` captures on both approved surfaces converged to the same open-phase signed-row count:
  - `uploaded_images`
  - `signed=6`
- the old cross-surface sign-count mismatch was therefore largely a side-channel signing leak, not a budget mismatch

Durable lesson recorded:

- always audit side-channel signing lanes such as poster/hover-video preview signing before retuning the main preview-sign budget
- if two surfaces share the same budget but differ in cost, check whether one surface is bypassing visibility scoping in an adjacent signing path
- once cross-surface sign counts converge, shift the next lane to the remaining surface-specific bottleneck instead of continuing to retune shared sign budgets

Third follow-on result:

- the user interrupted the lane to ask why this was the next step, whether the work was real, and whether a pivot was needed
- that interruption should be treated as a training signal, not just a request for reassurance
- inferred user meaning:
  - they were checking whether Holomony was still anchored to real product improvement rather than KPI/tooling momentum
  - they wanted proof that the diagnosis had actually changed because of evidence, not because of arbitrary agent preference
  - they were verifying that AI Studio media and Elements media were both still in view
- durable rule recorded:
  - when the user challenges the lane's purpose, Holomony must re-justify the lane from fresh evidence before doing more work
  - this is part of good media-performance behavior, not a pause from it

Next training focus:

- add row-class-aware preview correctness evidence for the mixed `All Media` open path
- audit whether open-phase signing can safely deprioritize audio/original-heavy top rows without harming visible correctness

## 2026-05-16: KPI Honesty Hardening And Repeated Production Panel Capture

Task: repair the main KPI integrity gap, then refresh retained production evidence for both approved panel surfaces.

Actions taken:

- upgraded the KPI capture helper so it now defaults to `5` repeated panel opens
- made direct timing `p95` fields stay `null` until repeated-run evidence is strong enough to justify them
- updated capture tests and KPI SOP guidance to match the stricter contract
- captured new repeated retained production packets for:
  - `ai-studio-panel`
  - `elements-media-panel`
- compared the new packets against the latest 2026-05-15 retained baselines

Training result:

- Holomony's KPI system is materially harder to overstate now
- the next product lane is clearer than before:
  - the panel count-only optimization did not eliminate the remaining second open-phase list request

## 2026-05-16: Open-Phase Sign Breakdown Hardening

Task: strengthen the KPI capture so panel authority decisions are based on open-phase evidence instead of tab-churn-blended telemetry, then re-audit both approved production panels.

Actions taken:

- updated the KPI capture helper to snapshot perf telemetry twice:
  - once immediately after the open-phase panel load
  - once after the tab interaction sweep
- changed canonical preview coverage and sign-batch diagnosis to prefer open-phase sign stats
- added structured sign-tab breakdown analysis to the packet and report surfaces
- reran live production captures for:
  - `ai-studio-panel`
  - `elements-media-panel`

Training result:

- the next lane is now much narrower and better supported by evidence
- both approved panel surfaces show the same open-phase pattern:
  - sign activity is concentrated in `uploaded_images`
  - those rows are still opening on original assets
  - open-phase `canonicalPreviewCoverageRatio` is `0`
- durable lesson recorded: when the panels are opening `uploaded_images` on originals, treat image thumb derivative readiness/promotion as the first blocker before adding more browse-path complexity

Next training focus:

- verify image derivative backlog/terminal-failure state for production `uploaded_images`
- repair derivative readiness or promotion if backlog/exhaustion is confirmed
- rerun the repeated KPI captures and look for movement first in:
  - `canonicalPreviewCoverageRatio`
  - `signBatchP95Ms`
  - `stateFlipCountPerOpen`
  - canonical preview coverage is now the clearest shared weakness in the refreshed evidence
- the biggest remaining process gap is retained-summary drift, not lack of tooling

Next training focus:

- inspect the still-remaining open-phase `/api/media/list` duplication on the approved panel surfaces
- inspect why the refreshed repeated packets now show `canonicalPreviewCoverageRatio: 0`
- keep Holomony's retained summary surfaces updated immediately after real runtime evidence changes
- the next lane should target shared panel-runtime behavior, not surface-scaffold tooling

Next training focus:

- raise evidence quality beyond single-sample packets
- investigate the shared list-count/canonical-preview weakness across approved panel surfaces

## 2026-05-16: KPI Diagnostic Triage Upgrade

Task: make the KPI scorer more actionable by turning weak media-panel packets into likely next-fix lanes with owner-file hints.

Actions taken:

- extended the scorer with ranked root-cause diagnostics
- added a likely `nextFocus` lane and likely owner-file hints for the active weakness
- aligned the KPI SOP and Holomony tool inventory with the new diagnostic behavior

Training result:

- Holomony can now use the KPI system as a triage tool, not just a score formatter
- the retained reports can move faster from evidence to likely engineering lane without separate manual interpretation each time

Next training focus:

- verify that the next runtime fix actually matches the scorer's top diagnostic lane
- add one more direct correctness metric so triage is less dependent on canonical-preview coverage alone

## 2026-05-16: Mixed-Open Shell and Elements Visibility-Scoping Follow-Through

Task: continue the real runtime lane after the mixed-open audio-shell cut, reduce AI Studio shell churn, and verify Elements did not retain a separate visible-card signing leak.

Actions taken:

- memoized `MediaLibraryPanelFoldersSection` so AI Studio-only folder chrome no longer rerenders on unrelated media churn
- stabilized root-content props in both approved panel surfaces by memoizing bulk actions and replacing inline root render lambdas with stable callbacks
- reran repeated production KPI capture for `ai-studio-panel`
- identified a real Elements regression: `ElementsEmbeddedMediaLibraryPanel` was not passing `visibleMediaIdsRef` into `MediaLibraryAllItemsGrid`
- restored that prop and reran repeated production KPI capture for `elements-media-panel`

Training result:

- the mixed default-open runtime is materially healthier on both approved surfaces
- latest repeated production KPI:
  - AI Studio: `842ms` first paint / `1255ms` settle / `567ms` sign p95
  - Elements: `518ms` first paint / `936ms` settle / `485ms` sign p95
- the next blocker is no longer obvious browse/sign churn
- the stronger remaining gap is evidence depth on correctness and persistence, not a clear hot-path runtime leak

Durable lesson:

- if AI Studio and Elements drift again after a shared runtime fix, verify both surfaces are still passing `visibleMediaIdsRef` through the mixed `All Media` grid before retuning sign budgets or reopening shell theory

## 2026-05-16: Visible-Card Preview Presence Probe

Task: keep proving panel strength without reopening runtime tuning by adding one honest correctness metric to the KPI capture path.

Actions taken:

- added an open-phase visible-card DOM probe to the KPI capture helper
- derived `missingPreviewRatio` only from visible settled media cards
- counted audio shell cards as preview-present when their on-demand audio shell/player rendered
- added/updated packet tests for the new weighted visible-card summary
- added an explicit regression test covering `visibleMediaIdsRef` on the embedded Elements `All Media` grid
- reran repeated production captures for both approved surfaces

Training result:

- both approved production surfaces now show `missingPreviewRatio: 0` on the mixed settled open
- the next blind spot is no longer visible preview absence; it is persistence/save-reopen trust plus the remaining missing reliability/correctness depth
- Holomony should prefer persistence-oriented evidence next instead of reopening hot-path tuning that is currently healthy

Durable lesson:

- only score correctness from browser evidence the panel actually exposes
- when the DOM cannot prove wrong-asset or save-trust behavior, leave those metrics unset rather than inferring them from adjacent runtime stats

## 2026-05-17: Elements Persistence Parity Proof

Task: close the last approved-surface persistence gap by proving the Elements embedded media panel survives save, reload, reopen, and fresh signed-in reopen.

Actions taken:

- extended the retained media-panel persistence audit so the same harness can target `ai-studio-panel` or `elements-media-panel`
- validated the CLI and surface selection path
- ran the production Elements persistence audit against `https://www.shortpulse.ai`
- retained the production Elements persistence report and updated Holomony memory and surface inventory

Training result:

- both approved media panels now have direct production save/reopen browse-readiness proof
- cross-surface persistence parity is no longer the weakest open gap in the current lane
- the lane now cleanly qualifies as `done enough for now`

Durable lesson:

- once both runtime health and persistence proof exist on the approved surfaces, stop by default and wait for regression evidence or an explicitly approved new surface rather than continuing to optimize by habit

## 2026-05-17: Workflow Audit And Training Synthesis

Task: audit whether the media-panel changes were real and valuable, then synthesize the conversation into durable behavior rules and prune retention drift.

Actions taken:

- re-audited the Holomony-owned media-panel files and targeted validation
- identified a real KPI integrity gap in open-phase list-response selection and repaired it
- audited the conversation patterns for user approval/disapproval signals
- corrected stale artifact references, tightened memory, removed dynamic status from the standing SOP, and repaired the scorecard/ledger contract drift
- retained the detailed synthesis in `reports/archive/2026-05-17-holomony-workflow-audit-and-training-synthesis.md`

Training result:

- Holomony now has a much clearer rule for what the user approves:
  - direct product work,
  - explicit causal reasoning,
  - honest stop/pivot decisions,
  - and tooling only when it serves real runtime decisions
- Holomony now has a clearer rule for what the user rejects:
  - KPI theater,
  - dead-surface drift,
  - momentum work,
  - and retention/scoring that cannot defend its own truth

Durable lesson:

- one current-state surface is better than many competing "semi-current" summaries
- self-scoring that violates its own rubric is a trust bug, not a documentation nit
- repo-local skill paths should be opened literally before checking global skill roots
- retained reports are valuable historical evidence and should be described that way even when fresher proof would outrank them for a present-tense audit

## 2026-05-29: Management Burden And Lane Control Synthesis

Task: synthesize the user's hesitation, speed concerns, and repeated lane-control prompts into durable Holomony behavior rules.

Observed user concern:

- The user was not only worried about slow tool execution; they were worried Holomony would become another system they must supervise, debug, constrain, and emotionally manage.
- Hesitation often meant the lane lacked a clear stop condition, was carrying stale context, or was drifting from high-ROI causal work into momentum.
- Reconnects and slow runs made even useful work feel brittle because the process became unpredictable.

Training result:

- Holomony must reduce the user's operational burden, not transfer project-management work back to the user.
- Before medium, risky, or ambiguous work, Holomony must freeze the lane: `done`, `scope`, `out of scope`, `source of truth`, and `proof`.
- If the user sounds overwhelmed, hesitant, or concerned about performance, Holomony should narrow context and recommend `continue`, `pivot`, or `stop` instead of asking the user to organize the agent's process.
- Tool use should be exact and bounded by the proof condition; broad commands and extra validation need a concrete stop-decision reason.

Durable lesson:

- "Be easier to trust" is a higher-order performance requirement than "be faster."
- Do not convert user anxiety into more user work.
- Treat user interruption as evidence for lane control, not as friction to overcome.
