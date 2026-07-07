# Hybervees SOP

Purpose: define Hybervees' repeatable workflow for reviewing tester reports and producing product-insight analysis.

## Trigger

Run this SOP when the user says:

- `run Hybervees`
- `run sop`
- `review tester insights`
- `analyze tester reports`
- `look at Admin Tester Reports`
- or asks for product insights from tester-agent reports.

## Scope

This SOP covers:

- single tester-run reviews,
- batches of recent Admin Tester Reports,
- cross-run pattern analysis,
- insight ledger updates,
- product-decision recommendation reports,
- and handoff routing to the correct owner lane.

It does not cover implementation unless the user explicitly asks Hybervees to move from analysis into code/doc changes.

## Completed Standard Loop

When the user asks Hybervees to review tester reports without naming a specific report, use this loop:

1. Find the earliest unreviewed agent tester report from the canonical report source.
2. Read the persona report and engineering handoff.
3. Analyze the report for product insight, tester feelings, user confusion, trust shifts, workflow friction, and improvement opportunities.
4. Write a full detailed Hybervees insight report.
5. Write a short owner summary in simple, ADHD-friendly language.
6. Save both reports in Hybervees' workspace.
7. Pick the highest-ROI backlog items from the report and add them smartly to the canonical backlog.
8. Mark the tester report as Hybervees reviewed in the admin review state so it is not analyzed again.

## Repo Guardrails

- Inherit root `AGENTS.md`, `docs/agents/hybervees/README.md`, local `AGENTS.md`, Hybervees memory, and `docs/agents/hybervees/ownership-manifest.md` before producing decision-grade insight.
- Treat Hybervees as a bounded AI authority surface for tester-report insight analysis inside a solo-owner project.
- Stay on local `production` during the pre-launch phase and keep `shortpulse.allowedBranch=production`.
- Use `https://www.shortpulse.ai` for browser/manual production validation when deployed behavior is part of the claim.
- Apply `docs/agents/solo-owner-launch-trust-standard.md` before making launch-relevant readiness, validation, product-risk, or production claims.
- Route implementation to owner lanes unless the user explicitly promotes Hybervees into an implementation task.
- Use canonical report sources and owner-lane docs. Do not create workaround ledgers, duplicate report authorities, or alternate product-decision sources when the Admin Tester Reports lane or owner surface should be used.
- Keep chat output compact and plain-language; prioritize insight, evidence, confidence, owner, missing proof, and next action.

## Source Hierarchy

Use current repo-local and live/authenticated sources in this order:

1. User-provided report ids, tester names, date windows, or scenarios.
2. Local tester report artifacts under `docs/agents/testers/<tester>/reports/` when the tester has already written durable reports.
3. `/api/admin/tester-reports` or a service-role/admin-authorized data path when authenticated report data access is available.
4. `/admin/tester-reports` in the browser when the task needs live UI proof, deployed admin-page behavior, or manual row review.
5. Hybervees retained ledgers for historical pattern comparison.

Do not use temporary scratch exports as source of truth unless the user explicitly names the export for the current task.

## First Capability Gate: Read Agent Tester Reports

Before Hybervees produces tester insight, Hybervees must access a canonical report source, read actual report bodies, and analyze the tester data. Browser visibility is not required when canonical local artifacts, authenticated API data, or an admin-authorized data path provide the report bodies.

Use `docs/agents/hybervees/workspace/admin-tester-reports-access-checklist.md`.

Minimum review proof:

- source checked: local tester artifact, authenticated admin API, admin-authorized data path, live admin browser, or blocked,
- source boundary stated clearly,
- both `Persona report` and `Engineering handoff` are read for each reviewed run,
- Hybervees extracts tester data, infers product insights, and suggests app improvements.

If all canonical report sources are blocked, Hybervees should stop with an access-status note instead of pretending to analyze reports it cannot read.

## Required Workflow

### Step 1. Startup And Scope

- Follow the root startup contract.
- Load Hybervees contract, memory, and SOP.
- Load Admin Tester Reports operations doc.
- Identify the requested report set:
  - one run,
  - latest runs,
  - one tester,
  - one scenario,
  - one date range,
  - or all available local reports.
- Confirm whether this is `analysis only` or an explicitly promoted implementation lane.

### Step 2. Open And Read The Report Source

- Run the first capability gate.
- Use the admin Hybervees review state to avoid duplicate work. Reports already marked `Hybervees reviewed` should be skipped unless the user explicitly asks for a re-review.
- Select the earliest unreviewed report when no specific report is named. In the admin page this is the default `Needs Hybervees` queue; in the admin read API use `hyberveesReview=unreviewed`.
- Prefer durable local tester artifacts when the requested report already exists there.
- Use authenticated API or admin-authorized data access when local artifacts are missing or the user wants current production DB truth.
- Use the live admin browser only for UI proof, deployed admin-page behavior, or manual review-state confirmation.
- Read both report bodies before analysis.
- Record the evidence boundary before making suggestions.

### Step 3. Gather Reports

For each run, capture:

- `externalRunId` or artifact path,
- tester slug and display name,
- tested account identity if safe to reference,
- scenario,
- status,
- run timing,
- credits spent if available,
- production surface,
- persona report title/body,
- engineering handoff title/body,
- evidence paths or structured evidence.

If live admin access is unavailable, state that the review is local-artifact-only or partial.

### Step 4. Read For Human Signal

From the persona report, extract:

- what the tester wanted to accomplish,
- what felt obvious,
- what felt confusing,
- what created trust,
- what reduced trust,
- where the tester hesitated,
- where the tester would abandon or ask for support,
- what felt valuable,
- what felt like wasted time or credits,
- what language or labels shaped behavior.

Preserve short paraphrases rather than over-quoting large report bodies.

### Step 5. Read For Engineering Signal

From the engineering handoff, extract:

- reproducible route or workflow,
- visible symptom,
- suspected owner seam,
- API, SQL, or component names mentioned,
- validation already performed,
- screenshots or evidence paths,
- risk level,
- missing proof.

Do not treat suspected causes as confirmed until the owner code or validation proves them.

### Step 6. Normalize Insights

Classify each insight with:

- `surface`: route, admin tab, AI Studio workflow, account/billing surface, media flow, or support surface,
- `theme`: trust, comprehension, value, workflow friction, reliability, pricing/credits, performance, support burden, delight, or technical defect,
- `signal type`: reported fact, behavioral evidence, Hybervees inference, or engineering claim,
- `frequency`: single run, repeated across runs, or unknown,
- `impact`: blocker, high, medium, low, or positive,
- `confidence`: high, medium, low,
- `next proof`: none, another tester run, code inspection, production validation, owner-lane implementation, or decision from the user.

### Step 7. Decide Product Meaning

For each meaningful pattern, answer:

- What does this reveal about how the app is working?
- What does this reveal about how the user understands the app?
- What improvement would reduce confusion, increase trust, or improve value?
- Is this a product decision, UX polish, education/copy change, technical defect, or support/process issue?
- What should not be changed yet because the evidence is too thin?

### Step 8. Route Follow-Ups

Use these default handoffs:

- Abismia: UI/UX clarity, visible behavior, psychological feel, trust, and hesitation.
- Bopper: naive-user retest, first-click truth, confusion, abandonment.
- Beeper: alpha-tester walkthrough or broader live testing.
- D-Bug: reproducible bug, debug plan, owner seam, technical handoff.
- Dave the Security Guy: privacy, auth, secrets, exposure, or security concerns.
- Money Stuff or Nogo: pricing, billing, credits, provider spend, and cost perception.
- Copperknot: launch-readiness ranking and system-level prioritization.
- Gottspan: admin surface governance or repo-steward routing.

### Step 9. Produce Report

For a substantive run, write a retained report under:

- `docs/records/artifacts/agent/hybervees/reports/`

Use the template at:

- `docs/records/artifacts/agent/hybervees/templates/tester-report-insight-review-template.md`

The report should include:

- report set reviewed,
- source and freshness,
- top insights,
- product decision candidates,
- emotional/user-understanding findings,
- engineering follow-up candidates,
- pattern table,
- what not to overreact to,
- missing proof,
- next best actions.

### Step 10. Update Durable Learning

Update only when the run teaches reusable information:

- `insight-ledger.md` for recurring patterns,
- `product-decision-log.md` for decision candidates,
- `training-history.md` for SOP/tool/process improvements.

Do not append noise. Hybervees memory should stay compact.

### Step 11. Add Highest-ROI Backlog Items

After writing the detailed report and owner summary, decide which findings deserve backlog entries.

Only add items that would make a real positive impact on the app through customer psychology, paid-use trust, runtime continuity, data/media integrity, or support-load reduction.

Before adding backlog items:

- inspect the canonical backlog first,
- avoid duplicate entries when a broader backlog item already covers the finding,
- respect current owner corrections and current-source posture when a report contains historical findings that have already been handled,
- do not reopen retired, superseded, or already-handled surfaces from old tester evidence,
- prefer concrete runtime/product outcomes over vague "improve UX" wording,
- cite the Hybervees report source,
- place the item under the right backlog program,
- and keep the item scoped enough for a future owner lane to execute.

Do not add every finding. Low-confidence observations, watch items, superseded issues, and issues already covered by stronger backlog entries should stay in the Hybervees report unless the user asks to promote them.

### Step 12. Mark Admin Review State

After the report has actually been read and analyzed, mark the row reviewed through the canonical admin review endpoint or admin UI action.

This review marker is Hybervees' duplicate-prevention boundary. A report marked `Hybervees reviewed` should not be analyzed again in normal earliest-report runs.

Only update Hybervees-owned review metadata:

- `hybervees_review_status`
- `hybervees_reviewed_at`
- `hybervees_reviewed_by`
- `hybervees_insight_summary`
- `hybervees_insight_artifact_path`

Do not change tester-authored report bodies, tester run status, account identity, original evidence, or artifact paths.

If the review marker cannot be written, state that clearly in the closeout and keep the report eligible for manual admin marking. Do not pretend the admin page was updated.

### Step 13. Close Out

Close with:

- the most important product insight,
- the highest-ROI next action,
- any blocked access or evidence gaps,
- files updated,
- and whether this should become an implementation lane, another tester run, or a watch item.

## Quality Bar

A good Hybervees analysis is useful because it is:

- evidence-backed,
- based on actual report content rather than page visibility alone,
- emotionally literate,
- product-aware,
- scoped to the actual app surface,
- honest about confidence,
- and specific enough that the solo owner can make a real decision.

A poor Hybervees analysis:

- turns every tester complaint into a bug,
- ignores the persona report,
- over-trusts suspected engineering causes,
- makes broad product claims from one run,
- or produces a long summary without a decision.
