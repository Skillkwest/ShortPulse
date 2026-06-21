# Terms Privacy Refund Finalization Audit

Purpose: Austerity retained audit record for the June 21, 2026 finalization pass on ShortPulse's Terms of Service, Privacy Policy, and Refund Policy publication-candidate documents.

Status: internal Austerity audit. The three policy documents are polished publication candidates, not live public routes and not counsel signoff.

## Documents Updated

- `docs/agents/austerity/workspace/drafts/2026-06-21-shortpulse-terms-of-service-draft.md`
- `docs/agents/austerity/workspace/drafts/2026-06-21-shortpulse-privacy-policy-draft.md`
- `docs/agents/austerity/workspace/drafts/2026-06-21-shortpulse-refund-policy-draft.md`

## Source Classes Used

- Current repo behavior: billing-pricing catalog, billing/credits SOP, security checklist, Supabase auth setup, Austerity memory, and Austerity UGC AI synthesis.
- Current external legal/provider research: U.S. Copyright Office AI/DMCA resources, FTC Take It Down Act guidance, California CCPA guidance, EU AI Act, EU DSA, UK ICO AI/data-protection guidance, OpenAI terms/usage policies, ElevenLabs use policy, Fal terms, and Stripe customer/subscription-management documentation.
- Draft policy recommendation: Austerity's legal-policy drafting judgment for clauses that require business approval or counsel review.

## Audit Findings

- The previous documents were strong research drafts but still carried source ledgers, publication blockers, TBD language, and internal audit notes inside the policy body.
- Terms needed stronger customer-facing AI output caveats, user-rights warranties, provider-flowdown language, platform-disclosure language, DMCA-style notice content, repeat-infringer handling, and NCII/child-safety reporting language.
- Privacy needed cleaner AI-provider processing language, stronger voice/face/likeness/sensitive-data handling, clearer sale/share/targeted-advertising posture, retention categories, state privacy rights, and international posture.
- Refund needed tighter alignment with Stripe subscriptions, credits, storage add-ons, generation reservations/captures, failed-generation restoration, abandonment, chargebacks, and mandatory consumer-law exceptions.

## Changes Made

- Replaced the three draft documents with publication-candidate policy text.
- Removed old source ledgers, publication blocker lists, TBD scaffolding, and Austerity audit sections from the policy bodies.
- Preserved only factual placeholders that cannot be safely invented from the repo:
  - legal entity;
  - support/legal/privacy/billing/copyright/safety contact emails;
  - mailing address;
  - governing law and venue.
- Set the refund review request window to 14 days, with mandatory-law carveouts.
- Kept the service posture adult-only, authenticated, private-workspace-first, and AI-provider-integrated.
- Kept output rights conditional and avoided promises of uniqueness, copyrightability, non-infringement, platform acceptance, or commercial/legal fitness.
- Added/retained mandatory-law carveouts so consumer rights override the no-refund default where required.

## Remaining Publication Fill-Ins

Before these documents become public policy pages, the user or counsel must confirm:

- legal entity name;
- legal mailing address;
- support, legal, privacy, billing, copyright, and safety email addresses;
- governing law and venue;
- whether arbitration/class waiver language should be added or deliberately omitted;
- whether launch is U.S.-only or actively international;
- final cookie/tracking/provider inventory;
- final privacy retention posture;
- Stripe portal cancellation/proration behavior in production.

## Validation

- `git diff --check -- docs/agents/austerity`
- `npm -C frontend run docs:check`

Both checks passed on June 21, 2026.

## Residual Risk

These policies are polished and legally stronger than the prior drafts, but they should not be published without filling the remaining business/legal placeholders and doing counsel review. Public route implementation, production URL proof, and footer-link launch closeout remain separate work.
