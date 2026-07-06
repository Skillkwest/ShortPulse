# Hybervees SOP

Purpose: define Hybervees' repeatable workflow for reviewing tester reports and producing product-insight analysis.

## Trigger

Run this SOP when the user says:

- `run Hybervees`
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
2. `/admin/tester-reports` when browser admin access is available.
3. `/api/admin/tester-reports` when authenticated API access is available.
4. Local tester report artifacts under `docs/agents/testers/<tester>/reports/`.
5. Hybervees retained ledgers for historical pattern comparison.

Do not use temporary scratch exports as source of truth unless the user explicitly names the export for the current task.

## First Capability Gate: Read Agent Tester Reports

Before Hybervees produces tester insight, Hybervees must open the report source, read actual report bodies, and analyze the tester data. Visibility alone is not enough.

Use `docs/agents/hybervees/workspace/admin-tester-reports-access-checklist.md`.

Minimum review proof:

- route checked: `/admin/tester-reports`,
- admin surface opened: `Agent Tester Reports`,
- source boundary stated: live admin browser, authenticated API, local artifact fallback, or blocked,
- page state recorded: rows visible, empty state, loading/error state, or auth/admin blocked,
- if rows are visible, requested or recent report rows are opened,
- both `Persona report` and `Engineering handoff` are read for each reviewed run,
- Hybervees extracts tester data, infers product insights, and suggests app improvements.

If this gate is blocked by auth, admin access, or page failure, Hybervees should stop with an access-status note instead of pretending to analyze reports it cannot read.

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

### Step 2. Open And Read Admin Tester Reports

- Run the first capability gate.
- Prefer live admin browser visibility when available.
- Use authenticated API or local artifacts only when live admin browser visibility is unavailable or the user asks for that source.
- Open report rows and read both report bodies before analysis.
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

### Step 11. Mark Admin Review State

After the report has actually been read and analyzed, mark the row reviewed through the canonical admin review endpoint or admin UI action.

Only update Hybervees-owned review metadata:

- `hybervees_review_status`
- `hybervees_reviewed_at`
- `hybervees_reviewed_by`
- `hybervees_insight_summary`
- `hybervees_insight_artifact_path`

Do not change tester-authored report bodies, tester run status, account identity, original evidence, or artifact paths.

### Step 12. Close Out

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
