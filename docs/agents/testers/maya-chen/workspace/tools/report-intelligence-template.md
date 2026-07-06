# Maya Report Intelligence Template

Use this template after every browser run. It upgrades Maya's reports from a run recap into product intelligence, customer-service preparation, and an engineering-ready fix packet.

Do not force every field to be long. Short, specific answers are better than filler.

## Persona Report Additions

### Customer Journey Snapshot

Write this in Maya's customer language.

| Journey moment           | Maya's customer read                                            |
| ------------------------ | --------------------------------------------------------------- |
| Starting intent          | `<what Maya came back/arrived to do>`                           |
| First confidence lift    | `<first moment that made the app feel trustworthy>`             |
| First doubt/friction     | `<first moment that made Maya pause>`                           |
| Trust break or trust win | `<the moment that most changed Maya's willingness to continue>` |
| End decision             | `<what Maya would do next as a customer>`                       |

### Product Decision Signal

One paragraph or 3-5 bullets explaining what the run means for UI, UX, customer journey, support burden, conversion, retention, billing/credit trust, or launch readiness.

Use plain language:

- `Trust`: `<what improved or eroded trust>`
- `Retention`: `<would Maya come back or avoid the workflow?>`
- `Support`: `<what support ticket or confusion this could create>`
- `Revenue/Credits`: `<whether the issue affects willingness to spend>`
- `Launch readiness`: `<whether this feels acceptable for early customers>`

### Customer Service Simulation

Write likely customer-service language, not engineering language.

Support email Maya might send:

```text
<2-5 sentences Maya would send to support>
```

Bad review / public complaint risk:

```text
<1-3 sentences Maya might write if frustrated enough>
```

What would calm Maya down:

- `<clear product behavior, support response, refund/credit clarity, or explanation that would restore trust>`

### What Maya Would Do Next

Choose the most realistic next customer action:

- keep using confidently,
- continue cautiously,
- stop spending credits,
- contact support,
- ask for a refund/credit adjustment,
- try again after an update,
- warn another creator,
- abandon the workflow.

Explain why in one short paragraph.

### Issue Tags

Add tags that help future agents/admin views group repeated issues.

Examples:

- `saved-work`
- `prompt-recovery`
- `media-library`
- `detail-modal`
- `project-context`
- `reference-grid`
- `credit-confidence`
- `generation-output`
- `reuse-workflow`
- `support-risk`
- `repeat-finding`

## Engineering Handoff Additions

### Agent Fix Packet

Use one packet per primary issue. If there are several small issues, group them by customer workflow.

```md
#### Fix Packet: <short issue name>

- Issue tags: `<tags>`
- Repeat finding: `<yes/no; prior run ids or reports>`
- Customer impact: `<one sentence>`
- Product decision impact: `<trust / retention / support / credits / launch readiness>`
- Suspected owning surface: `<route/component/system/lane, or unknown>`
- Likely source boundary: `<files/services/data path when evidence supports it; otherwise unknown>`
- Canonical fix expectation: `<what should become true in the product>`
- Acceptance criteria:
  - `<visible behavior that proves the fix>`
  - `<reload/return/session condition if relevant>`
  - `<what must stay unchanged>`
- Validation steps:
  - `<manual visible Chrome path>`
  - `<focused automated/unit/integration check if known>`
- Protected behavior:
  - `<working behavior the fix must not regress>`
- Stop/escalation condition:
  - `<what would require user/product approval before changing>`
```

### Issue Pattern And Prior Reports

When the issue repeats, explicitly link prior local reports and note whether the current run adds new proof.

Use:

```md
Repeat pattern:

- Prior report: `<path>`
- Current run adds: `<new evidence, new session type, reload proof, credit-spend proof, or no new proof>`
- Do not keep re-proving unless: `<deploy changed / user requests / behavior changes / regression check needed>`
```

### Decision Impact

Every engineering handoff should include a compact line near the summary:

```md
Decision impact: `<why this matters for product direction, release risk, or engineering priority>`
```

### Validation Boundary

State what proof exists and what proof does not.

Examples:

- `Proved in production Chrome as Maya.`
- `Not proved against local code.`
- `Not proved after a new deploy.`
- `Admin publish verified.`
- `Database state not inspected during live customer journey.`

## Quality Gate Before Publish

Before publishing to Agent Tester Reports, confirm:

- Persona report has customer journey, customer-service risk, and what-Maya-would-do-next.
- Engineering handoff has fix packet, acceptance criteria, validation steps, protected behavior, and decision impact.
- Repeat findings link prior reports.
- Product strengths are named so fixes do not regress working behavior.
- Screenshots are evidence, not decoration.
- No credentials, tokens, cookies, signed URLs, or billing details are included.
