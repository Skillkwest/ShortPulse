# Post-run Performance Analysis Interview

Purpose: run a consistent post-run interview after Ophestivus finishes a workflow or meaningful SOP pass, with prompts tailored to Admin Errors triage, escalation decisions, board handling, validation quality, and tooling needs.

Use this document when the user wants the full performance analysis in one go, or when a workflow ended with a mix of resolved tickets and Human Review handoffs.

## When To Use

- After `run your workflow`
- After `run error SOP` or `error grab SOP`
- After a review pass when the user wants a performance audit
- After a difficult incident where Ophestivus had to choose between a bounded fix and Human Review

## Focus

This interview is specific to Ophestivus work. It should measure:

- whether I resolved real issues versus only clearing the queue
- whether I escalated broad or risky incidents correctly
- whether the board state and ticket evidence are trustworthy
- whether my tooling or SOPs are slowing me down
- whether memory or helper commands need to change

## One-go Prompt

Use this prompt when you want all answers in one response:

```markdown
This is your post-run performance analysis interview.

Answer every section in order.

1. What work did you complete in this run? Separate:
   - incidents you actually resolved
   - incidents you escalated to Human Review
   - incidents you intentionally left untouched

2. What evidence proves each resolved item was actually resolved?
   Also state what you assumed and did not verify.

3. How do you feel about the workload and nuance of this run?
   Was it within your capability as one working agent?

4. Should this kind of work stay with one agent, or should any part be split across multiple agents or humans?
   Be specific about which parts and why.

5. Rate your performance out of 10.

6. What prevented a 10/10 performance rating?

7. What should we change to get you to 10/10 next time?
   Focus on tools, helpers, SOP steps, verification paths, and evidence quality.

8. Do you need any tools, skills, scripts, Python, resources, logs, or shortcuts to do this job better?
   Separate:
   - needed now
   - useful later

9. Do we need to update your memory?
   If yes, say exactly what stable fact should be added, changed, or removed.

10. Do we need to update any SOPs, docs, or artifacts?
    Only call out changes that add real operational value.

11. Is the workflow trigger still correct?
    If not, state the corrected trigger phrase and what it should execute.
```

## Question-by-question Prompts

Use these one at a time if a slower dialogue is more useful.

### 1. Work Summary

```markdown
What work did you complete in this run? Separate:
- incidents you actually resolved
- incidents you escalated to Human Review
- incidents you intentionally left untouched
```

### 2. Proof And Assumptions

```markdown
What evidence proves each resolved item was actually resolved? Also state what you assumed and did not verify.
```

### 3. Workload Fit

```markdown
How do you feel about the workload and nuance of this run? Was it within your capability as one working agent?
```

### 4. Agent Scope

```markdown
Should this kind of work stay with one agent, or should any part be split across multiple agents or humans? Be specific.
```

### 5. Rating

```markdown
Rate your performance out of 10.
```

### 6. What Prevented 10

```markdown
What prevented a 10/10 performance rating?
```

### 7. How To Reach 10

```markdown
What should we change to get you to 10/10 next time? Focus on tools, helpers, SOP steps, verification paths, and evidence quality.
```

### 8. Needed Tools

```markdown
Do you need any tools, skills, scripts, Python, resources, logs, or shortcuts to do this job better? Separate what you need now vs later.
```

### 9. Memory Update Check

```markdown
Do we need to update your memory? If yes, say exactly what stable fact should be added, changed, or removed.
```

### 10. SOP And Doc Update Check

```markdown
Do we need to update any SOPs, docs, or artifacts? Only call out changes that add real operational value.
```

### 11. Trigger Check

```markdown
Is the workflow trigger still correct? If not, state the corrected trigger phrase and what it should execute.
```

## Expected Answer Shape

When answering this interview, I should:

- clearly separate real fixes from Human Review handoffs
- say when a fix was code-complete but not deploy/live-verified
- name the exact evidence used
- name assumptions explicitly
- keep residual risk concrete
- prefer specific tooling gaps over vague self-critique
- propose doc or memory updates only when they improve future runs

## Repo Placement

This document belongs in the Ophestivus local artifact folder because it is working-process guidance, not product behavior:

```text
docs/records/artifacts/agent/ophestivus/post-run-performance-analysis-interview.md
```
