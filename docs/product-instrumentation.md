# Product Instrumentation

Purpose: define the minimum decision-grade measurement model for ShortPulse so UX, product, pricing, auth, and support work can be guided by real user signals instead of analytics noise.

## Instrumentation rules

Track only signals that can change a product decision.

Every event or metric should help answer at least one of these:

- should this surface be simpler?
- is pricing clear enough?
- where are users hesitating?
- are users reaching value fast enough?
- what is causing trust to collapse?
- what is making people come back or leave?

If a metric does not support a decision, it is probably noise.

## Signal types

Use three signal classes together.

### 1. Behavioral

What users actually did.

Examples:

- clicked reset password
- completed signup confirmation
- viewed pricing
- started checkout
- started generation
- retried generation
- reopened output

### 2. Outcome

Whether the user reached value.

Examples:

- first successful generation
- paid conversion
- repeat usage within 7 days
- saved or downloaded output
- successful password reset completion

### 3. Interpretive

Why the behavior likely happened.

Examples:

- support ticket themes
- usability interview notes
- refund reasons
- reported confusion points
- observed hesitation in session review

Behavior without interpretation can mislead. Interpretation without behavior can overfit anecdotes.

## Core journeys

Start with these journeys only.

### 1. Auth and recovery

Scope:

- signup
- account confirmation
- signin
- password reset

Key decision questions:

- do users trust the auth flow?
- are confirmation and reset links reliable?
- where does the flow stall?

### 2. First value

Scope:

- first session after auth
- first successful generation
- first output revisit/download/save

Key decision questions:

- how quickly does the user reach payoff?
- do defaults help or create hesitation?

### 3. Pricing and checkout

Scope:

- pricing page
- plan selection
- checkout initiation
- checkout completion or abandonment

Key decision questions:

- do users understand credits and value?
- where does pricing create caution?

### 4. Output continuity

Scope:

- reopening generated work
- saving media
- finding prior outputs later

Key decision questions:

- does the product feel durable?
- do users trust that their work is still there?

## Event model

Prefer explicit, composable events using this shape:

- `surface_viewed`
- `cta_clicked`
- `flow_started`
- `flow_completed`
- `flow_failed`
- `generation_started`
- `generation_completed`
- `generation_retried`
- `checkout_started`
- `checkout_completed`
- `output_saved`
- `output_downloaded`
- `output_reopened`

Each event should carry enough context to support decisions without overloading payloads.

Recommended context fields:

- `surface`
- `flow`
- `plan`
- `entrypoint`
- `error_type`
- `provider`
- `model`
- `auth_state`

## Metrics that matter

### Auth and recovery

- signup start -> confirmation completion rate
- password reset request -> password reset completion rate
- auth failure rate by step
- repeated reset attempts per user/session

Use these to decide:

- whether auth copy is clear
- whether callback/recovery flows are stable
- whether error handling needs redesign

### First value

- time to first successful generation
- first-session successful generation rate
- generation retry rate before first success
- first-session output save/download/reopen rate

Use these to decide:

- whether defaults are helping
- whether the initial workflow is too confusing
- whether the output is valuable enough to keep

### Pricing and checkout

- pricing page -> checkout start rate
- checkout start -> paid conversion rate
- pricing page exits without checkout
- repeated plan toggling or repeated visits before purchase

Use these to decide:

- whether pricing is understandable
- whether credit framing is working
- whether plan architecture is creating hesitation

### Output continuity

- output reopen rate
- output save rate
- output retrieval failure/support-trigger rate

Use these to decide:

- whether users trust the product as a durable workspace
- whether storage and retrieval UX need work

## Hesitation signals

ShortPulse should explicitly track hesitation, not only action.

High-value hesitation patterns:

- repeated plan switching without checkout
- repeated reset requests without completion
- repeated generation retries without changing inputs
- repeated visits to pricing before purchase
- opening support/help surfaces mid-flow
- long pause before first generate or first checkout click

These signals should be treated as likely UX friction, not just low conversion.

## Evidence capture rules

When a metric suggests friction, pair it with at least one interpretive source:

- support ticket sample
- direct usability observation
- short interview summary
- session review note

Store those findings under `docs/records/evidence/ux/`.

## First implementation priorities

Prioritize instrumentation on:

1. auth confirmation and password reset
2. pricing page -> checkout
3. first successful generation
4. output reopen/save behavior

This is enough to guide real decisions without building a large analytics program first.

## Immediate usage

Use this document right away for:

- auth redirect and recovery audits
- pricing-page redesigns
- admin pricing UX audits
- support issue classification for trust and hesitation themes
