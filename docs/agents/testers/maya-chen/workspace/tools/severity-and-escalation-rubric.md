# Maya Severity And Escalation Rubric

Use this rubric when turning Maya's customer observations into engineering handoff findings. Maya's customer report can stay emotional and human; the engineering handoff should use these stable labels.

## Severity Labels

| Severity                  | Use When                                                                                                               | Default Action                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `Blocker`                 | Maya cannot complete the core scenario after reasonable visible attempts.                                              | Engineering follow-up should start here.                                  |
| `Credit or billing risk`  | Cost, debit, payment, plan, or credit balance is unclear, wrong, or trust-breaking.                                    | Stop before more spend unless the user explicitly authorizes continuing.  |
| `Data or saved-work risk` | Maya cannot tell whether a project, prompt, generated media, download, or saved asset persisted or can be found again. | Preserve evidence and verify find-it-again behavior if safe.              |
| `Trust damage`            | Maya can continue, but the app makes her doubt reliability or recommendation-worthiness.                               | Capture Maya's harsh-review wording plus fair diagnostic wording.         |
| `Workflow confusion`      | Maya can complete a local step but cannot understand the larger path, next step, or panel relationship.                | Record Maya's question and the visible UI that failed to answer it.       |
| `Visual/copy friction`    | Text, layout, labels, state, or affordance clarity slows Maya down without blocking.                                   | Keep evidence lightweight; no screenshot unless the visual state matters. |
| `Positive`                | The app increases Maya's confidence, clarity, or willingness to spend.                                                 | Record briefly so product strengths are not lost.                         |

## Escalation Rules

- Stop immediately for real billing/payment actions that require owner input.
- Stop before destructive account or saved-work mutations unless explicitly authorized.
- Stop before non-image generation spend unless explicitly authorized.
- Stop if hidden state would be required to know whether Maya succeeded.
- Mark the run `partial` when the browser scenario completed but reporting, Admin publishing, or verification remains unfinished.
- Mark the run `blocked` when Maya cannot proceed because of auth, payment, budget, browser control, or production availability.
- Mark the run `failed` only when the run itself was invalid, unsafe, or materially violated SOP.

## Report Mapping

For each engineering handoff finding, include:

- severity,
- issue tags,
- repeat-finding status,
- route or surface,
- Maya's customer question,
- visible steps tried,
- expected customer outcome,
- actual visible outcome,
- evidence path if kept,
- customer-service risk,
- product decision impact,
- acceptance criteria,
- validation steps,
- protected behavior,
- next investigation boundary.
