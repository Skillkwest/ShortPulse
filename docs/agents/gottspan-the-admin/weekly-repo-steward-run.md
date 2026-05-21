# Gottspan Weekly Repo-Steward Run

Purpose: define the single highest-ROI recurring Gottspan workflow so repo stewardship produces one concise, reusable output instead of expanding into more setup work.

## Weekly Goal

Run one compact repo-state audit each week and publish one durable report that answers:

- Is repo posture safe?
- Is there branch or worktree drift?
- Is there docs, SOP, or index drift?
- Is there a release-readiness or ownership risk that should be addressed now?
- What is the single best follow-up action?

## Trigger

Use this workflow when:

- the user says `run Gottspan`
- the repo needs a weekly stewardship check
- release readiness or repo hygiene needs a quick status read

## Inputs

Load only:

- `AGENTS.md`
- `docs/dev-ground-rules.md`
- `docs/conventions.md`
- `docs/agent-playbook.md`
- `docs/README.md`
- `docs/troubleshooting.md`
- `docs/glossary.md`
- `docs/agents/gottspan-the-admin/README.md`
- `docs/agents/gottspan-the-admin/memory.md`
- `docs/agents/gottspan-the-admin/standard-operating-procedure.md`
- `docs/agents/gottspan-the-admin/repo-state-audit-checklist.md`
- `docs/records/artifacts/agent/gottspan-the-admin/baseline-kpi.md`

Only load additional route, system, or agent docs if the audit surfaces a specific risk that requires them.

## Workflow

### 1. Check repo posture first

Capture:

- current branch
- `shortpulse.allowedBranch`
- worktree status
- generated-artifact safety posture

If branch posture conflicts with documented rules, state the contradiction explicitly.

### 2. Run the smallest useful governance sweep

Review only what is needed to answer:

- docs/index drift
- route/SOP mismatch
- agent contract or ownership gaps
- release-risk contradictions

Do not expand into implementation work unless the user explicitly asks for fixes.

### 3. Identify the highest-risk finding

Pick one primary issue only:

- branch/worktree risk
- docs/SOP drift
- release-risk ambiguity
- admin subsystem stewardship gap
- agent-surface ownership gap

If there is no meaningful risk, say that directly and do not invent work.

### 4. Take one durable stewardship action

Choose the smallest action with real operational value:

- update or add one contract/SOP/checklist/template
- repair one index/discoverability problem
- create one evidence-backed decision packet
- create one explicit handoff to the correct specialized agent

### 5. Validate and score the run

- run relevant docs checks
- score the run against `baseline-kpi.md`
- state residual risk plainly

## Required Output

Produce exactly one durable report:

- `docs/agents/gottspan-the-admin/reports/YYYY-MM-DD-weekly-repo-state-report.md`

That report should be concise and decision-first.

## Success Standard

This workflow is successful if it:

- makes repo posture visible
- surfaces the highest-risk issue without noise
- produces one usable report
- names one concrete next action or states that no action is justified

## Non-Goals

Do not use the weekly run to:

- rewrite broad policy without explicit human direction
- expand the Gottspan meta-framework
- drift into unrelated code implementation
- produce multiple overlapping reports from one audit
