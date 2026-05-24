# Bopper Checkpoint Summaries

Purpose: keep short trainer-facing summaries for Bopper runs.

## Conventions

- Make each summary easy to scan in under a minute.
- Treat the summary as the ADHD-friendly digest of the full run packet and reports, not as a separate analysis lane.
- These summaries are for the trainer to quickly feel the user's experience.
- Do not try to stuff the technical operator record into the summary.
- Use real Markdown headers, not just bold labels, so the sections read larger and cleaner.
- Optimize for skimmability over completeness.
- Keep each section to `1-2` short bullets max when possible.
- Prefer concrete labels like `What Worked`, `What Broke`, and `My Take` over report language.
- Write the summary in Bopper's own voice.
- Use first-person full thought sentences, not note fragments.
- Use only language Bopper could realistically know from the visible UI and his own reaction.
- Do not use operator phrasing like `restore flow`, `runtime`, `rendering`, `control plane`, or internal system labels unless the exact words were visibly shown to the user, and even then prefer plain-language paraphrase.
- Make the voice sound like the actual ICP:
  - plainspoken
  - slightly clumsy
  - practical
  - money-aware
  - not polished like a product reviewer
- Prefer phrases like `weird`, `felt off`, `kind of`, `I wasn't sure`, `this made me stop`, and `this felt like too much` when they fit.
- Avoid polished summary language like `the route remained unavailable`, `the surface was unauthenticated`, or `the workflow degraded`.
- Keep the main body to five sections max.
- Always include:
  - the blunt result
  - what Bopper tried
  - what worked
  - what broke or confused him
  - what he would conclude as the ICP
  - what got handed off
- Prefer short blunt lines over explanation.
- If a report says more than the summary, the summary should still capture the highest-signal takeaway from it.
- Keep these summaries simpler than the detailed reports so the trainer can correct Bopper quickly.

## What Belongs Here

- the emotional read of the route
- what felt clear
- what felt broken or confusing
- whether Bopper would keep going
- what Bopper would likely say out loud after the run
- the kind of wording this ICP would actually use in a support message or complaint

## What Does Not Belong Here

- code-surface ownership
- probable root-cause analysis
- deep technical debugging notes
- full runtime or console detail
- exact operator follow-up plan
- detailed evidence inventory

That material belongs in:

- `docs/agents/bopper/workspace/reports/...`
- `docs/records/artifacts/agent/bopper/reports/...`
- `docs/agents/bopper/workspace/runs/<timestamp>-<slug>/`

## Default Shape

Use this visual order:

1. `Bottom Line`
   - one blunt sentence saying whether the route worked, failed, or stayed mixed
2. `What I Tried`
   - one or two lines on the route
3. `What Worked`
   - only what genuinely felt clear or usable
4. `What Broke`
   - the confusion, failure, or abandonment point
5. `My Take`
   - trust / keep-going judgment
   - one short blockquote for the likely customer reaction

After the five sections, keep footer lines only:

- `Handoff: ...`
- `Read next: ...`

## Example Shape

```md
# Bopper Checkpoint Summary - YYYY-MM-DD

## Bottom Line
I got into the route and it mostly worked, but it still felt a little off and I wasn't fully sure my paid plan was showing up right.

## What I Tried
I came in through the signed-in dashboard `New Project` path.

## What Worked
I clicked the obvious create button and it actually took me where I thought it would.

## What Broke
I still saw one thing that made me stop and question it.

## My Take
I would keep going, but I would still feel a little weird about it until the plan part looked clearer.
> "This is closer to what I thought I paid for, but I still don't totally trust what I'm seeing."

Handoff: none.
Read next: `...`
```
