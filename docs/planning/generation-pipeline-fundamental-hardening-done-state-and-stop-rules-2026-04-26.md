# Generation Pipeline Fundamental Hardening Done State And Stop Rules (2026-04-26)

Last updated: 2026-04-26  
Status: Active control document  
Master plan: `docs/planning/generation-pipeline-fundamental-hardening-master-plan-2026-04-26.md`

## Done State
The program is done when all of the following are true:
1. the weak high-risk branches in scope have direct characterization coverage
2. accepted generation submissions are durably recoverable after provider acceptance
3. `terminal_success_no_media` behaves consistently across the in-scope terminal paths
4. recoverable terminal observations are not silently downgraded to ignored `missing_generation`
5. owned/generated media authority is internally durable and storage-backed for current writes
6. one canonical internal output-slot convergence path exists for output/media/publication/projection repair
7. no intended UI, UX, route-contract, or payload changes were introduced
8. remaining work would be optional cleanup, retirement, or redesign rather than fundamental hardening

## Stop Rule
Stop immediately once the done state is achieved.

At that point:
1. do not continue by adjacency
2. do not open compatibility-retirement work unless it has its own fresh repo-backed problem statement
3. do not split files or reorganize modules unless a separate task justifies it

## Reporting Rule
After each task in this program, report:
1. `Done state: achieved` or `Done state: not achieved`
2. what moved relative to the done-state criteria
3. the remaining blockers to done
4. the suggested next steps if work remains

## Failing The Stop Rule
If a proposed next task does not directly improve one of the done-state criteria, the correct action is to stop rather than continue.
