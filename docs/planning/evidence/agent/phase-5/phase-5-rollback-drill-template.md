# Phase 5 Rollback Drill Template

Date: YYYY-MM-DD  
Operator: @handle  
Environment: staging | production-canary  
Scenario: latency | contract-break | refusal-spike | continuity-failure | legacy-wrapper-failure

## Drill Goal
Validate rollback execution path and recovery SLO for the selected scenario.

## Trigger Condition
- Synthetic/observed condition:
- Threshold breached:
- Detection source:

## Execution Timeline (UTC)
| Time | Action | Owner | Result |
| --- | --- | --- | --- |
| | Trigger declared | | |
| | Rollback action executed | | |
| | Verification checks run | | |
| | Recovery confirmed | | |

## Verification Checklist
1. Rollback command/flag change documented.
2. Critical metrics returned within budget.
3. Required CI checks for fallback SHA/flag state are green.
4. Incident packet completed.
5. Follow-up owner and due date assigned.

## Recovery Metrics
- Time to mitigation (minutes):
- Time to recovery (minutes):
- Target met (Yes/No):

## Evidence Links
- Metrics dashboard:
- CI run(s):
- Incident packet:
- Tracker update:

## Lessons / Actions
- What worked:
- What failed:
- Permanent improvements:
