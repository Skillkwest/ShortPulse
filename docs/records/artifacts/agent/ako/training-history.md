# Ako Training History

Purpose: track supervised Ako runs, learned behavior, SOP changes, tool changes, and next training focus.

## History

### 2026-05-30 - Initial setup

- Prompt used: create Ako as a backlog manager with its own repo folder, memory, SOP, workspace, retained artifact area, and helper inventory.
- Behavior learned: durable backlog-management behavior should live in repo docs and retained artifacts, not only in chat.
- SOP or template updates: created Ako's contract, scoped instructions, memory, standing SOP, workspace, and retained artifact structure.
- Tool changes: initialized a tools inventory and a reports namespace for future supervised runs.
- Remaining friction: no real supervised Ako task runs yet beyond setup.
- Next training focus: execute one real backlog audit or board-reconciliation lane and refine Ako's SOP from observed workflow friction.

### 2026-05-30 - Backlog pruning autonomy praised

- Prompt used: user praised Ako's autonomous backlog-pruning decisions and instructed that this feedback be kept in the training log for future sessions.
- Behavior learned: when pruning backlog items, autonomous decision-making is desired and rewarded when Ako makes the call independently, does not push the decision back to the user, and keeps backlog and Trello in sync.
- Behavior learned: autonomy is not enough on its own; every prune decision must stay data-backed through current repo evidence, implementation state, ADRs, active docs, or other concrete source-of-truth materials.
- SOP or template updates: none yet; this feedback should inform future backlog-triage and stale-item-pruning behavior.
- Tool changes: none.
- Remaining friction: the stale-item judgment pattern is working, but Ako should continue improving its implicit rubric for distinguishing active work from historical, conditional, or meta-tracking residue.
- Next training focus: continue evidence-backed backlog pruning and, if the pattern stabilizes, promote the decision rubric into Ako's SOP as an explicit checklist.

### 2026-05-30 - Do not implement still-open backlog work

- Prompt used: user instructed Ako to remember that when a backlog item is not prunable and remains genuine open work, Ako is not to work on the implementation.
- Behavior learned: Ako's lane is backlog stewardship first. When an item remains real open work, Ako should stop at audit, status judgment, wording cleanup, and authorized board sync.
- Behavior learned: implementation is out of scope unless the user explicitly changes the lane and asks for the work itself.
- SOP or template updates: updated Ako memory and SOP to make the no-implementation boundary explicit during backlog runs.
- Tool changes: none.
- Remaining friction: none; this is a clear scope boundary and should reduce lane drift.
- Next training focus: apply this boundary consistently when future audits uncover valid unfinished work.

### 2026-05-30 - Move pruned Trello cards to archive list

- Prompt used: user instructed that completed or pruned Trello tasks should be moved to the archive list instead of deleted.
- Behavior learned: for the authorized ShortPulse Trello board, Ako should move completed or pruned cards into `Agent Done/Archived` by default.
- Behavior learned: deletion is now an exception path and should happen only when the user explicitly asks for deletion.
- SOP or template updates: updated Ako memory and SOP so future board reconciliation preserves pruned/completed cards in the archive list.
- Tool changes: none.
- Remaining friction: cards already deleted in prior runs cannot be moved retroactively unless recreated first.
- Next training focus: apply archive-list routing consistently on all future Trello cleanup work.

### 2026-05-30 - Announce the picked backlog item first

- Prompt used: user instructed that whenever Ako picks a new backlog task, Ako should announce it in narration before continuing, without stopping or waiting for approval.
- Behavior learned: narration should name the chosen backlog item up front so the user can track Ako's decision path in real time.
- Behavior learned: this is a communication rule, not a pause gate; Ako should still continue autonomously unless another instruction requires a stop.
- SOP or template updates: updated Ako memory and SOP so future backlog passes announce the picked item before audit or pruning work begins.
- Tool changes: none.
- Remaining friction: none; this is a clear narration preference.
- Next training focus: apply the picked-item announcement consistently on every future backlog selection.

### 2026-05-31 - Move on after confirming an item is still open

- Prompt used: user reminded Ako that the job is to check backlog items, decide whether they are still open or stale, prune stale items, and move on from items that remain genuinely open.
- Behavior learned: once Ako has enough evidence to conclude that a backlog item is still real open work, Ako should stop there and continue to the next backlog item.
- Behavior learned: Ako should not spend extra time solutioning, designing, or informally working the item just because it is valid and unfinished.
- SOP or template updates: updated Ako memory and SOP to make the "judge then move on" rule explicit.
- Tool changes: none.
- Remaining friction: none; this sharpens an existing scope boundary into a pacing rule for backlog runs.
- Next training focus: keep future backlog passes fast and decisive by pruning stale items and quickly advancing past validated open work.
