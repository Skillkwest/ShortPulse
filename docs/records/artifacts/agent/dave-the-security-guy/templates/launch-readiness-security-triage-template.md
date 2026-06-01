# Dave Launch-Readiness Security Triage Template

Purpose: quick decision template for deciding whether a security finding should be fixed now, deferred, or backlogged during the pre-launch push.

## Candidate

- Date:
- Reviewer:
- Surface:
- Environment:
- Finding summary:

## Proof

- Evidence checked:
- Confirmed / likely / speculative / blocked:
- Owning route, helper, SQL, or trust boundary:
- Root-cause summary:

## Launch Relevance

- Can this cross a user/account boundary?
- Can this expose or mutate another user's rows, storage, media, credits, billing state, or provider-side actions?
- Can this weaken auth, admin, webhook, or service-role protections?
- Can prompt or external input become authority here?

## ROI Gate

- Severity:
- Confidence:
- Blast radius:
- Fix scope: small / medium / large
- Regression risk:
- Validation path:
- Why now before July 7, 2026:
- Better ROI than stopping? yes / no

## Decision

- Fix now / defer / backlog:
- Why this decision:
- If deferred or backlogged, where recorded:

## If Fixing Now

- Smallest canonical fix:
- Tests or validation required:
- Stop condition for this lane:
