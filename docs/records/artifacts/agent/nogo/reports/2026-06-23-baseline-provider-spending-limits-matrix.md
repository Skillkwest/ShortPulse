# Baseline Provider Spending Limits Matrix

Date: 2026-06-23  
Owner surface: Nogo  
Status: initial baseline recommendation

## Purpose

Set the first ShortPulse provider spend-limit baseline for Kie, Fal, ElevenLabs, and OpenAI.

This matrix is an operating baseline, not a final production budget. It should be edited after live provider exports, credit receipts, and active-user behavior are available.

## Evidence Basis

- User-supplied anchor: the user plus Scott have spent over `$400` in the month.
- Interpretation: `$400+` across two people is heavy founder/testing intensity, not a safe normal-user average.
- Prior repo-local pricing analysis: Kie video is the highest variable provider-spend risk; Fal image/Lip Sync is second; ElevenLabs audio and OpenAI text/image helpers should be capped meaningfully but lower by default.
- No live provider dashboard export was inspected for this matrix.

## Baseline Assumptions

- Provider caps are emergency brakes.
- Normal spend control should come from ShortPulse credits, plan limits, per-user generation limits, abuse controls, and provider telemetry.
- Monthly hard caps should generally be `2x-3x` expected spend.
- Daily hard caps should generally be about `2x` average daily monthly allowance, rounded to practical dashboard numbers.
- Baseline provider split:
  - Kie: `65%`
  - Fal: `20%`
  - ElevenLabs: `10%`
  - OpenAI: `5%`

## Recommended Monthly Hard Caps

| Active-user scenario | Total monthly hard cap |       Kie |       Fal | ElevenLabs |   OpenAI |
| -------------------: | ---------------------: | --------: | --------: | ---------: | -------: |
|         User + Scott |               `$1,000` |    `$650` |    `$200` |     `$100` |    `$50` |
|      20 active users |               `$5,000` |  `$3,250` |  `$1,000` |     `$500` |   `$250` |
|      50 active users |              `$12,000` |  `$7,800` |  `$2,400` |   `$1,200` |   `$600` |
|     100 active users |              `$22,000` | `$14,300` |  `$4,400` |   `$2,200` | `$1,100` |
|     300 active users |              `$65,000` | `$42,250` | `$13,000` |   `$6,500` | `$3,250` |

## Recommended Kie Daily Hard Caps

Kie deserves its own daily limit because video can create the largest fast-burn scenario.

| Active-user scenario | Kie monthly hard cap | Average daily allowance | Recommended Kie daily hard cap |
| -------------------: | -------------------: | ----------------------: | -----------------------------: |
|         User + Scott |        `$650-$1,000` |           `$22-$33/day` |                     `$100/day` |
|      20 active users |             `$3,250` |              `$108/day` |                     `$250/day` |
|      50 active users |             `$7,800` |              `$260/day` |                     `$600/day` |
|     100 active users |            `$14,300` |              `$477/day` |                   `$1,100/day` |
|     300 active users |            `$42,250` |            `$1,408/day` |                   `$3,000/day` |

## Alert Threshold Policy

Monthly provider alerts:

| Alert     | Threshold | Meaning                                                     |
| --------- | --------: | ----------------------------------------------------------- |
| Heads-up  |     `30%` | Spend is real enough to inspect mix.                        |
| Attention |     `50%` | Compare provider spend to credits/revenue and heavy users.  |
| Urgent    |     `75%` | Decide whether to raise caps or throttle before disruption. |
| Stop-near |     `90%` | Treat as urgent operator action before hard cap.            |

Kie daily alerts for current user-plus-Scott baseline:

| Alert     |     Amount |
| --------- | ---------: |
| Heads-up  |  `$40/day` |
| Attention |  `$65/day` |
| Urgent    |  `$85/day` |
| Hard stop | `$100/day` |

## Interpretation

The user-plus-Scott row is intentionally much higher than a simple daily average because testing days spike. The 20/50/100/300 rows assume some blend of power users and normal active users, but still keep enough headroom that provider hard caps do not become the primary entitlement system.

If real paid users behave like the user plus Scott, these caps will need to move upward quickly. If the `$400+` month was mostly provider-debugging, retries, failed generations, or broad model exploration, these caps may be generous.

## Refresh Triggers

Refresh this matrix when any of these occur:

- provider dashboard exports become available,
- ShortPulse has seven days of real paid-user generation data,
- Kie/Fal/ElevenLabs/OpenAI pricing changes,
- new high-cost models are enabled,
- helper flows are made billable or removed,
- provider spend diverges from the baseline split by more than `10 percentage points`,
- or a provider cap is hit during normal non-bug usage.

## Open Questions

- What share of the `$400+` month was Kie versus Fal versus ElevenLabs versus OpenAI?
- What share was successful customer-like generation versus testing, retries, provider debugging, or failed runs?
- Which provider dashboards support hard daily caps versus monthly caps versus only prepaid balance controls?
- What active-user definition should Nogo use: signed-in users, paying users, credit-consuming users, or weekly active creators?
