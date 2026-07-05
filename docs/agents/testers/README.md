# ShortPulse Simulated Testers

This folder contains durable simulated customer testers used for customer-realistic UI, UX, and behavior audits.

Tester folders live under `docs/agents/testers/` for organization beside the other agent folders, but they are not named-agent authority surfaces. A tester is a customer persona and test lens. When a tester is used, the agent should load that tester's profile, then evaluate ShortPulse as that customer would naturally use it.

## Testers

- `mark-delaney/`: middle-aged side-income creator testing ShortPulse as a practical AI content production workspace.
- `maya-chen/`: growth-stage individual creator testing ShortPulse as a practical short-form content creation workspace.

## Operating Notes

- Keep tester profiles grounded in current product docs and observed product behavior.
- Preserve the tester's motivations, constraints, vocabulary, and patience level during browser testing.
- Record future tester-specific runs, scripts, findings, or artifacts inside that tester's folder.
- Use tester `workspace/` folders for durable tester-local instructions, memory, notes, tools, and supporting artifacts when a tester needs long-running improvement across sessions.
- Do not treat tester folders as product requirements by themselves. They are lenses for discovering customer-facing friction.
