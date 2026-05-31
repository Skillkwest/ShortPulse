# Admin-Priced Billed Credit Migration Plan

Date: 2026-05-30  
Owner surface: Money Stuff  
Status: active compact master plan

## Purpose

Define the smallest durable migration plan that moves AI usage pricing off shared-policy billed-credit authority and onto the admin pricing grid's canonical `Billed credits` variant rows.

This plan exists to prevent a partial cutover where button display, guardrails, observability, and actual debit drift away from each other.

## Locked Authority

The following rule is already accepted and should not be re-debated during implementation:

- canonical AI usage price authority = admin pricing grid `Billed credits` variant rows
- generate button display must read that canonical variant row
- actual server debit must read that same canonical variant row
- missing variant rows must fail closed

Canonical authority references:

- `docs/adr/0088-admin-priced-billed-credit-authority.md`
- `docs/agents/Money Stuff/README.md`
- `docs/sops/sop_billing_credits_operations.md`

## Done Means

This migration is complete only when, for every billed AI usage lane:

1. the visible billed-credit amount comes from the canonical admin-priced variant row
2. the required-credit/guardrail path uses that same value
3. submit metadata records that same value
4. server debit charges that same value
5. missing rows fail closed instead of falling back to pricing math
6. pricing observability mismatch rows are empty in healthy traffic for that lane

## In Scope

- billed AI usage pricing only
- canonical billed-credit lookup design
- button display authority
- server debit authority
- fail-closed behavior for missing billed rows
- mismatch observability alignment

## Out Of Scope

- subscription plan pricing
- credit package pricing
- storage add-on pricing
- Scott's admin pricing page implementation and UX ownership
- provider contract negotiation
- Stripe recurring catalog behavior

## Source Of Truth

- admin pricing authority: `/admin/pricing`
- admin pricing state route: `frontend/pages/api/admin/pricing/state.ts`
- runtime Create/Edit/Video/Sound pricing consumers in AI Studio
- server debit authority path: `frontend/lib/server/api/generationBilling.ts`

## Proof Required Before Full Closeout

- repo audit showing no billed lane still depends on shared-policy billed-credit authority
- targeted tests for lookup, fail-closed behavior, and display/debit parity
- production verification on at least one real billed path per migrated lane
- `/admin/generation-trace` spot-check showing no display-vs-debit mismatch for migrated paths

## Migration Strategy

Use one compact master plan with lane-by-lane implementation.

Do not migrate one surface in isolation.

For each lane, switch these together:

1. visible button cost
2. required-credit guardrail
3. optimistic/submit metadata
4. server debit
5. mismatch observability

## Canonical Lookup Contract

Every billed action must resolve one canonical variant row from the real priced configuration.

The lookup key must be based on the actual billed operation, not just what the panel looks like.

Minimum expected dimensions across lanes:

- surface
- workflow or tool
- operation type
- model id
- aspect
- resolution or quality tier
- duration when duration affects price
- audio on/off when audio affects price
- input image count when references affect price
- input video count when video references affect price
- input fidelity when edit pricing depends on it

No billed lane should be allowed to guess missing dimensions locally.

## Migration Order

### Lane 1: Create

Why first:

- live production audit already proved drift here
- Create has the most visible user trust impact
- Create forces the real variant-key design because some Create submits become edit-priced operations

Create migration must include:

- standard text-to-image Create
- character-mode Create branches
- reference-driven Create branches
- model picker credit chips
- primary `Generate` button
- create submit metadata
- create debit path

### Lane 2: Edit

Migrate after Create parity is complete.

Include:

- main Edit CTA
- inline regenerate/edit child paths
- any edit-specific variant dimensions such as fidelity or input-image count

### Lane 3: Video

Migrate after Edit.

Include:

- main Video CTA
- duration
- resolution
- audio
- image/video input counts where applicable

### Lane 4: Sound

Migrate last.

Include:

- Music
- Sound Effects
- Voiceover
- Voice Changer

## Fail-Closed Rule

If no canonical billed-credit variant row exists for a billed configuration:

- disable the billed action
- show a clear operator-style message
- do not estimate
- do not fallback
- do not charge

## Deprecated Authority Paths

These must be retired as final billed-credit authority during migration:

- shared-policy billed-credit math
- client-side local billed-credit formulas
- server-side billed-credit formulas that can diverge from admin-priced rows

Temporary migration-era plumbing is allowed only if it is clearly transitional and not the final authority.

## Immediate Next Slice

Start with a Create-only implementation plan that does three things:

1. define the exact canonical Create variant key
2. identify every Create display and debit consumer that must switch together
3. map current production drift findings against that key before code changes begin

## Current Recommendation

Do not start Edit, Video, or Sound migration work until the Create lane has:

- one canonical billed-credit lookup path
- display/debit parity
- fail-closed behavior
- production spot-check proof
