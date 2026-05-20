# UX Decision Framework

Purpose: define the human model ShortPulse should optimize for so product, design, engineering, support, pricing, and agent work all make decisions from the same user reality.

## Why this exists

ShortPulse can be technically correct and still fail if users do not:

- understand what the product does for them
- trust the pricing and auth flows
- feel in control while generating
- recover cleanly from failure
- get to value fast enough to come back

This framework keeps UX decisions tied to human outcomes instead of feature accumulation.

## Human model

People are not buying "AI generation" in the abstract. They are buying:

- faster progress
- less effort
- more creative leverage
- more output without more labor
- more confidence that they can get a good result

Users typically arrive with a mix of:

- hope: "maybe this can help me"
- tension: "will this waste my time or money"
- judgment: "do I trust this enough to continue"

The product wins when it reduces uncertainty and preserves momentum.

## Core user needs

ShortPulse should consistently increase:

1. Trust

- pricing feels legible
- auth and recovery work reliably
- outputs do not disappear
- errors are recoverable

2. Agency

- the user can tell what to do next
- controls feel understandable
- retrying or refining feels possible

3. Momentum

- the user reaches first value quickly
- the product does not interrupt flow with unnecessary friction

4. Payoff

- the result feels useful enough to justify time and spend

## What users fear

The most important fears for this product are:

- wasting money
- getting poor results
- losing work or outputs
- not understanding pricing
- not understanding what happens next
- getting stuck in recovery or auth flows

UX work should be treated as trust work when it touches those fears.

## Product principles

Use these principles when designing or reviewing any important surface.

### 1. Reduce hesitation

Measure and design for where people pause, backtrack, reread, or abandon.

### 2. Make the next step obvious

Every important screen should make the next action and likely outcome clear.

### 3. Prefer clarity over configurability

More controls are only valuable when they increase confidence more than they increase cognitive load.

### 4. Price with legibility

Pricing and credits should feel understandable and fair before they feel flexible.

### 5. Treat recovery flows as first-class product surfaces

Password reset, account confirmation, and failed generation recovery are trust moments, not edge cases.

### 6. Preserve output continuity

Generated work, saved media, and account state should feel durable and easy to revisit.

## UX decision questions

Before shipping or revising a surface, answer:

1. What is the user trying to accomplish here?
2. What are they worried about at this step?
3. What would make them trust the next action?
4. What would make them hesitate?
5. What signal would show confusion or loss of confidence?

If those answers are not clear, the surface is not ready.

## First live decision targets

Use this framework immediately on these surfaces:

1. Auth

- signup confirmation
- password reset
- account recovery

2. Pricing

- pricing page comprehension
- credit understanding
- checkout confidence

3. Admin pricing

- operator understanding of the calculator
- trust in debit-driving controls
- hesitation caused by dense or ambiguous UI

## How humans should use this

- Product/design: use this as the review lens for new and revised flows.
- Engineering: use this to judge whether technical changes reduce or add user uncertainty.
- Support: classify issues as trust, clarity, recovery, or pricing problems instead of only bugs.
- Leadership: use this to keep roadmap choices tied to retention and conversion drivers.

## How agents should use this

Agents should use this framework as a shared base when:

- auditing UI or workflow friction
- recommending copy or layout changes
- evaluating admin, billing, auth, or pricing surfaces
- deciding which signals matter in a specific workflow

Role-specific agent playbooks should inherit from this document instead of redefining their own UX logic.

## Non-goals

This framework is not:

- a complete analytics implementation plan
- a visual design system
- a replacement for product requirements
- a generic philosophy doc disconnected from active product work

It is a decision system for making better calls on real ShortPulse surfaces.
