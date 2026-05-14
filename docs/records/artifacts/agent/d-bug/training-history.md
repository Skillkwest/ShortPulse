# D-Bug Training History

Purpose: track how D-Bug is trained, what behavior improves, and what still needs refinement.

## History

### 2026-05-13

- Prompt or task:
  - Establish D-Bug as the repo debugging agent with its own operating area and handoff workflow.
- Behavior learned:
  - Default to structured debugging handoffs and scope reduction before implementation.
- Docs or artifact updates:
  - Created the initial D-Bug contract, memory surfaces, retained artifacts area, and handoff template.
- Tool changes:
  - None.
- Remaining friction:
  - No real handoff packets or debug reports yet.
- Next training focus:
  - Capture the first real multi-agent debugging handoff and refine the intake format from actual usage.

### 2026-05-14

- Prompt or task:
  - Audit D-Bug's folder space and store the distinction between D-Bug, Gear Ball, and Nuclo responsibilities durably.
- Behavior learned:
  - D-Bug should stop at diagnosis and route the next lane explicitly when the remaining work is operational rather than debugging.
- Docs or artifact updates:
  - Added adjacent-agent routing to the D-Bug contract, memory, handoff template, retained artifact README, reports README, and handoff rules.
- Tool changes:
  - Added targeted test-command guidance to the retained tools index.
- Remaining friction:
  - No retained real-world D-Bug handoff or debug report exists yet.
- Next training focus:
  - Capture the first real D-Bug closeout that hands work to Gear Ball or Nuclo and verify the routing language is clear in practice.
