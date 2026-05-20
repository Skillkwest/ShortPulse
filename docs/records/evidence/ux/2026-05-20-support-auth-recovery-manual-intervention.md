# Support Auth Recovery Manual Intervention

Purpose: retain a support-derived UX evidence packet that shows how Ayla should classify an account-recovery issue when a customer-facing auth flow fails badly enough that self-serve recovery turns into manual operator work.

## Surface

- password reset support
- signup confirmation support
- account-access recovery triage

## Observed behavior

During live production support work, a user could not complete self-serve auth recovery because the email flow was directing them to the wrong host.

The practical support outcome was:

- the user asked for help regaining access
- normal reset/confirmation guidance was no longer enough
- manual operator intervention became necessary to restore progress

This is the kind of support case that can look like a generic "login problem" if it is not classified correctly.

## Likely hesitation or trust issue

This is a trust and recovery issue first.

From the customer’s perspective, the product taught the wrong lesson:

- the recovery email may not be safe to trust
- clicking the next step may not work
- self-serve account recovery may not be dependable

At that point, support is not only answering a question. Support is trying to restore confidence while also deciding whether the issue is still within support authority.

## Supporting evidence

### Support-side evidence

- The customer issue started as a normal account-access request and escalated because the reset/confirmation path itself was unreliable.
- Manual operator work replaced the expected self-serve recovery flow.
- The case therefore crossed the boundary from ordinary support guidance into product-trust failure and operational escalation.

### Product contract evidence

- [docs/ux-decision-framework.md](../../../ux-decision-framework.md) defines recovery as a first-class trust surface and says users fear getting stuck in auth or recovery flows.
- [docs/product-instrumentation.md](../../../product-instrumentation.md) treats repeated reset attempts and auth-failure completion gaps as high-value hesitation signals.
- [docs/agents/ayla/ux-playbook.md](../../../agents/ayla/ux-playbook.md) says production-host recovery failures are trust incidents and should be escalated clearly when support authority is exceeded.
- [docs/sops/sop_auth_recovery_trust_smoke.md](../../../sops/sop_auth_recovery_trust_smoke.md) defines wrong-host auth links in production as a release-blocking trust failure.

### Related retained packet

- [docs/records/evidence/ux/2026-05-20-auth-recovery-public-origin-trust.md](./2026-05-20-auth-recovery-public-origin-trust.md) captures the same production-origin failure from the broader product-trust perspective.

## Recommended decision

Treat support cases like this as a classified recovery-trust incident, not a generic account ticket.

For Ayla, the right operating behavior is:

1. tell the user the normal recovery flow is not trustworthy right now if the host or callback is wrong
2. stop repeating self-serve steps once it is clear they are not resolving the issue
3. escalate with evidence when manual intervention or engineering review is required
4. retain the case as UX/support evidence if the failure teaches a reusable trust lesson

This keeps support from over-promising and keeps the issue legible for engineering and admin follow-up.

## Follow-up metric

The most useful measurements for this class of issue are:

- password reset request -> completion rate
- repeated reset attempts per user/session
- support requests requiring manual auth restoration
- number of support cases where the auth link host is wrong or suspicious

Expected improvement after a real fix:

- fewer manual recovery interventions
- fewer repeated support contacts for the same recovery issue
- lower operator need to intervene in ordinary account-access flows
