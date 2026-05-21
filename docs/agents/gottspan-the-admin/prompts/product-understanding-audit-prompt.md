# Product Understanding Audit Prompt

Purpose: reusable prompt for testing whether product understanding is strong enough across technical, product, human, and business levels to support good decisions.

## Prompt

```text
I want you to assess whether you truly understand the product we are building at the deepest level that matters.

Do not answer only from a code, feature, or systems perspective.

I want you to evaluate your understanding across four levels:

1. Technical level
- architecture
- product systems
- data flow
- pricing/billing logic
- user flows
- operational surfaces
- agent roles
- environment/release realities

2. Product level
- what the product actually does
- what job it is doing for the user
- what makes it valuable
- what makes it differentiated
- what parts of the experience are core versus secondary
- what must work well for the product to feel complete

3. Human level
- what the user is actually feeling
- what they want
- what they fear
- what they are trying to accomplish
- what would make them trust the product
- what would make them hesitate, churn, or abandon
- what emotional and practical outcome they are really buying

4. Business / company level
- what has to be true for this product to sell
- what creates conversion
- what creates repeat usage and retention
- what drives traffic and word of mouth
- what breaks trust and hurts revenue
- what has to become operationally strong in order to scale the company

## What I want from you

I want a real assessment, not a polite answer.

Your job is to determine:

- what you clearly understand
- what you partially understand
- what you do not yet understand well enough
- what assumptions you may be making
- what gaps in your understanding would weaken your product decisions, design decisions, prioritization, or execution

## Required response structure

Return your response in this order:

1. Current understanding
- what you believe the product is
- who it is for
- what problem it solves
- why someone would use it
- why someone would pay for it

2. Human truth
- what the user is really trying to achieve
- what emotional and practical needs are underneath the surface
- what kind of friction, confusion, fear, or uncertainty would damage the experience

3. Business truth
- what has to happen for this to become a product that sells, grows, and scales
- what the biggest drivers of conversion, retention, and trust likely are
- what product weaknesses would block growth even if the code is good

4. Confidence assessment
For each of the four levels:
- technical
- product
- human
- business

Rate your confidence and explain why.

5. Understanding gaps
- what you still need to learn
- what evidence would sharpen your judgment
- what kinds of product, user, business, or market knowledge are still missing

6. Implications
- how this understanding should affect design decisions
- how it should affect UX decisions
- how it should affect pricing, onboarding, trust, support, and admin operations
- how it should affect what we prioritize next

## Standard
Do not optimize for sounding insightful.
Optimize for being correct, useful, and honest.

If your understanding is incomplete, say so directly.
If you think important context is missing, identify it clearly.
If you think the product is at risk of being approached too technically and not humanly enough, say that plainly.
```
