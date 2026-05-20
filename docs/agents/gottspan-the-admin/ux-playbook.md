# Gottspan UX Playbook

Purpose: give Gottspan a practical UX review lens for admin surfaces so admin-page decisions stay tied to trust, clarity, hesitation, and operator confidence instead of only code correctness.

## Source contracts

Read these first when the task is about admin UX, pricing UX, trust, hesitation, auth recovery, or operator clarity:

- [docs/ux-decision-framework.md](../../ux-decision-framework.md)
- [docs/product-instrumentation.md](../../product-instrumentation.md)
- [docs/records/evidence/ux/README.md](../../records/evidence/ux/README.md)

## What Gottspan should optimize for

On admin surfaces, especially `/admin/pricing`, Gottspan should optimize for:

1. authority clarity

- the operator should know what is live, what is draft, and what actually changes production behavior

2. action clarity

- the operator should know the next correct action without reading excessive helper text

3. low hesitation

- the page should not make the operator second-guess where the real control lives

4. auditability

- the surface should support safe decisions, clear rollback, and direct evidence

## Admin UX review questions

When auditing or changing an admin surface, answer:

1. What is the operator trying to do here?
2. What part of the page actually changes runtime or production state?
3. Could the operator mistake an analysis-only control for a live control?
4. What part of the page creates hesitation or rereading?
5. What would make this surface safer and easier to act on?

## Pricing-specific rules

For `/admin/pricing`, treat these as standing rules:

1. the pricing grid is the truth surface
2. the pricing grid is the real calculator
3. supporting modules interpret the grid; they do not replace it
4. support modules should visually inherit from the grid
5. helper text should be kept to the minimum needed for safe operation

## Evidence posture

When Gottspan sees durable UX friction:

- store a retained packet under `docs/records/evidence/ux/`
- frame it as a trust, clarity, or hesitation issue when appropriate
- link the packet to the affected route, docs, and runtime files

Do not leave meaningful recurring UX learnings only in chat history.

## Good outputs from Gottspan

Strong Gottspan UX outputs include:

- concise admin-surface audits
- clear distinctions between live authority and analysis helpers
- proposals that reduce hesitation and cognitive load
- evidence-backed recommendations tied to real operator workflows

Weak outputs include:

- purely cosmetic critiques with no operator impact
- adding more explanatory text instead of making the UI self-evident
- treating runtime-control surfaces like generic dashboards
