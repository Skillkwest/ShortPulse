# System Handoff Template

Purpose: provide one reusable handoff format for execution agents working from the systems catalog.

## Template

### Title

`Next-Agent Handoff: <system or lane>`

### Copy/Paste Use

- This document is written to be pasted directly into another agent.
- Treat it as an execution packet, not as brainstorming context.
- Do not re-audit the whole repo before starting unless this packet explicitly requires it.

### Why this task

- Current system:
- Current score:
- Ship floor:
- Why this is worth doing now:

### Recommended agent profile

- Example: runtime reliability, workflow modularization, persistence contracts, security boundary audit

### Scoped task

State the smallest high-ROI task that should move the system toward the ship bar.

### In scope

- list concrete concerns that are allowed

### Out of scope

- list adjacent concerns that should not be pulled in by momentum

### Required context

Read first:

- system docs
- SOPs
- ADRs
- known-issues items if relevant

Inspect first:

- file paths
- route paths
- tests

### Questions to answer

1. 
2. 
3. 

### Expected output

- bounded patch, or
- findings packet with reduced next scope

### Suggested validation

- targeted tests
- docs check
- build or lint only when relevant

### Done state

- what must be true before the agent stops

### Stop rules

- when to stop instead of broadening into adjacent systems

### Closeout And Archive

- Return one of:
  - bounded patch complete
  - findings packet complete
  - blocked with evidence
- End with:
  - what changed
  - what was verified
  - residual risk
  - exact recommended next step
- After the handoff result is returned to the user, the receiving agent should treat its lane as complete and ready to archive unless the user explicitly continues that same lane.
