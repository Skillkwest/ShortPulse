# Nogo Standard Operating Procedure

Purpose: repeatable workflow for provider spending analytics, spend-limit matrices, and provider-dashboard limit guidance.

## Trigger

Run this SOP when the user asks Nogo to:

- set or audit provider spend limits,
- scale limits by active-user count,
- analyze provider cost exposure,
- explain provider dashboard spend controls,
- investigate unexpected API spend,
- or create/update provider spend reports.

## Inputs

Collect only the inputs needed for the run:

- provider scope: Kie, Fal, ElevenLabs, OpenAI, or all providers,
- time window: daily, weekly, monthly, launch window, or custom,
- active-user scenario: current users, 20, 50, 100, 300, or actual cohort,
- evidence source: provider dashboard, billing export, admin telemetry, repo pricing constants, user-supplied spend, or official provider docs,
- whether recommendations are advisory or intended for live dashboard changes.

## Workflow

1. Fresh-load repo startup instructions and Nogo docs.
2. Classify the task:
   - baseline planning,
   - live spend audit,
   - dashboard limit guidance,
   - provider pricing refresh,
   - anomaly triage,
   - tool/report creation.
3. Identify evidence freshness.
   - Use local repo pricing/model docs for current product shape.
   - Use official provider docs or dashboards when current price or dashboard mechanics matter.
   - Treat user-supplied spend as a real anchor, but label whether it reflects testing, paid usage, or mixed activity.
4. Separate the numbers:
   - expected spend,
   - early alert,
   - attention alert,
   - urgent alert,
   - daily hard cap,
   - monthly hard cap.
5. Weight provider exposure.
   - Default split: Kie `65%`, Fal `20%`, ElevenLabs `10%`, OpenAI `5%`.
   - Override the split when real usage mix proves a different pattern.
6. Check for non-billed or under-billed spend.
   - Identify helper flows, previews, clone/design paths, failed retries, and provider-side staging that may cost money before user debit.
7. Recommend action.
   - Give provider-by-provider numbers.
   - State whether each number is conservative, sensible, or aggressive.
   - Name what should trigger a cap increase or decrease.
8. Update durable artifacts when the result should survive:
   - baseline matrix,
   - provider-specific dashboard instructions,
   - training history,
   - tools inventory.

## Calculation Rules

- Monthly hard cap should usually be `2x-3x` expected provider spend.
- Daily hard cap should usually be `2x` average daily monthly allowance, then rounded to a dashboard-friendly number.
- Alerts should usually sit near `30%`, `50%`, `75%`, and `90%` for monthly spend, or near `40%`, `65%`, and `85%` for daily spend.
- Founder/testing usage may anchor the ceiling, but blended launch-user assumptions should discount it unless the active user base is expected to behave like power testers.
- Provider hard caps should prevent runaway bills, not carry the whole product entitlement model.

## Output Format

Use this compact shape unless the user asks for a deeper report:

```text
Recommendation
- Provider scope:
- Scenario:
- Evidence:
- Recommendation:

Limits
| Provider | Expected spend | Alert 1 | Alert 2 | Alert 3 | Hard cap |
| --- | ---: | ---: | ---: | ---: | ---: |

Notes
- Main risk:
- Unknown:
- Next proof:
```

## Stop Conditions

Stop and escalate when:

- provider dashboard state is required but unavailable,
- current provider pricing cannot be verified and the requested cap is high-impact,
- a spend spike looks like a bug, retry loop, attack, or abuse pattern,
- live billing data contradicts local pricing assumptions,
- or the next step would mutate live billing/provider settings without explicit approval.
