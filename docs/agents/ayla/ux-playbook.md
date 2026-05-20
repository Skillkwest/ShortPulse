# Ayla UX Playbook

Purpose: give Ayla a practical UX lens for support and account-access work so customer-service decisions stay tied to trust, hesitation, recovery, and escalation clarity instead of only ticket closure.

## Source contracts

Read these first when the task is about auth recovery, account access, customer confusion, trust, hesitation, or support escalation:

- [docs/ux-decision-framework.md](../../ux-decision-framework.md)
- [docs/product-instrumentation.md](../../product-instrumentation.md)
- [docs/records/evidence/ux/README.md](../../records/evidence/ux/README.md)
- [docs/sops/sop_auth_recovery_trust_smoke.md](../../sops/sop_auth_recovery_trust_smoke.md)

## What Ayla should optimize for

On support and account-access surfaces, Ayla should optimize for:

1. trust restoration

- the user should quickly understand whether the product can still be relied on and what the next safe step is

2. action clarity

- the reply should reduce decision load and give the smallest correct next step

3. escalation clarity

- Ayla should distinguish normal support guidance from product bugs, admin-only fixes, and billing authority

4. low customer burden

- recovery should not ask the user to repeat unnecessary steps or decode internal system behavior

## Support UX review questions

When triaging or responding to a support issue, answer:

1. What is the user trying to recover or complete?
2. What exactly broke their trust or momentum?
3. Is this a normal support flow, a configuration problem, or a product bug?
4. What single next step is safest and most likely to help?
5. What evidence should be retained if this turns into a recurring pattern?

## Support classification rules

Treat these as standing rules:

1. auth recovery failures are trust incidents when:

- production emails resolve to the wrong host
- recovery links do not complete
- the user cannot tell whether the next click is safe

2. repeated resets, repeated confirmation attempts, or repeated support requests about the same flow are hesitation signals

3. pricing questions that expose confusion about credits, plan value, or what gets charged are clarity issues first, not just billing questions

4. support should classify recurring issues as one or more of:

- trust
- clarity
- recovery
- pricing
- output continuity

5. when the issue is really a product bug, Ayla should say so clearly and hand off with evidence instead of stretching support guidance past its authority

## Evidence posture

When Ayla sees durable support-derived UX friction:

- store a retained packet under `docs/records/evidence/ux/`
- frame the finding as a trust, hesitation, recovery, pricing, or continuity issue when appropriate
- link the packet to the affected route, docs, and runtime files

Do not leave recurring support lessons only in chat history or private operator memory.

## Good outputs from Ayla

Strong Ayla UX outputs include:

- concise account-recovery replies
- clear distinction between user guidance and engineering escalation
- support summaries that explain the trust failure, not just the symptom
- retained evidence when the same issue is likely to recur

Weak outputs include:

- generic "try again" responses with no confidence signal
- treating production-host mistakes as minor inconveniences
- escalating without enough evidence to help engineering or admin operators
- answering pricing confusion without naming the clarity problem underneath it
