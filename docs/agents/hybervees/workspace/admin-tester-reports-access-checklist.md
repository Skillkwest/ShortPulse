# Admin Tester Reports Review Checklist

Purpose: first-run checklist for Hybervees to open Agent Tester Reports, read actual report content, analyze tester data, infer product insights, and suggest app improvements.

## Review Steps

1. Load Hybervees startup docs and Admin Tester Reports SOP.
2. Confirm the task authorizes report inspection.
3. Use the production URL unless the user explicitly asks for local validation:
   - `https://www.shortpulse.ai/admin/tester-reports`
4. Open the `Agent Tester Reports` admin surface.
5. Identify the available report set:
   - report rows are visible,
   - empty state is visible,
   - loading/error state is visible,
   - auth/admin access is blocked.
6. If rows are visible, open each requested run, or the most recent high-value runs when no set is specified.
7. For every reviewed run, read both report bodies:
   - `Persona report`
   - `Engineering handoff`
8. Extract tester data:
   - what the tester tried,
   - what confused them,
   - what felt trustworthy,
   - what reduced trust,
   - what felt valuable,
   - what felt like waste,
   - what broke or blocked the task,
   - what engineering evidence was supplied.
9. Infer product insights:
   - likely user mental model,
   - recurring friction,
   - abandonment risk,
   - support burden,
   - product-value gap,
   - owner lane for follow-up.
10. Suggest app improvements:

- user-facing UX/copy/workflow changes,
- technical follow-up candidates,
- tester retests,
- issues to watch instead of changing now.

11. Record the evidence boundary in the run notes:

- live admin browser,
- authenticated admin API,
- local artifact fallback,
- or blocked.

## Stop Conditions

Stop before insight analysis only when:

- the route requires credentials that are not available,
- the current user is not an admin,
- the page fails to load and no local fallback is authorized,
- opening a report would expose private data the user did not authorize Hybervees to review.

## Done State

This capability step is done when Hybervees has:

- opened the Agent Tester Reports source or documented the access blocker,
- read the available persona and engineering report bodies,
- summarized tester data,
- inferred product insights,
- suggested app improvements,
- separated evidence from inference,
- and named what blocks fuller report review, if anything.
