# Terms Privacy Refund Finalization Audit

Purpose: Austerity retained audit record for the June 21, 2026 finalization pass on ShortPulse's Terms of Service, Privacy Policy, and Refund Policy documents.

Status: internal Austerity audit. Superseded by `2026-06-21-policy-rewrite-research-and-decision-record.md` for the later placeholder-removal, DMCA, privacy, refund, and international-posture polish pass.

## Documents Updated

- `docs/agents/austerity/workspace/drafts/2026-06-21-shortpulse-terms-of-service-draft.md`
- `docs/agents/austerity/workspace/drafts/2026-06-21-shortpulse-privacy-policy-draft.md`
- `docs/agents/austerity/workspace/drafts/2026-06-21-shortpulse-refund-policy-draft.md`

## Source Classes Used

- Current repo behavior: billing-pricing catalog, billing/credits SOP, security checklist, Supabase auth setup, Austerity memory, and Austerity UGC AI synthesis.
- Current external legal/provider research: U.S. Copyright Office AI/DMCA resources, FTC Take It Down Act guidance, California CCPA guidance, EU AI Act, EU DSA, UK ICO AI/data-protection guidance, OpenAI terms/usage policies, ElevenLabs use policy, Fal terms, and Stripe customer/subscription-management documentation.
- Draft policy recommendation: Austerity's legal-policy drafting judgment for clauses that require business approval or counsel review.

## Audit Findings

- The previous documents were strong research drafts but still carried source ledgers, publication blockers, unfinished scaffolding, and internal audit notes inside the policy body.
- Terms needed stronger customer-facing AI output caveats, user-rights warranties, provider-flowdown language, platform-disclosure language, DMCA-style notice content, repeat-infringer handling, and NCII/child-safety reporting language.
- Privacy needed cleaner AI-provider processing language, stronger voice/face/likeness/sensitive-data handling, clearer sale/share/targeted-advertising posture, retention categories, state privacy rights, and international posture.
- Refund needed tighter alignment with Stripe subscriptions, credits, storage add-ons, generation reservations/captures, failed-generation restoration, abandonment, chargebacks, and mandatory consumer-law exceptions.

## Changes Made

- Replaced the three draft documents with polished policy text for later business/legal fill-in.
- Removed old source ledgers, publication blocker lists, unfinished scaffolding, and Austerity audit sections from the policy bodies.
- At the time of this audit, factual business/legal values still required confirmation. The later rewrite record supersedes this section with resolved policy text and remaining external-action notes.
- Set the refund review request window to 14 days, with mandatory-law carveouts.
- Kept the service posture adult-only, authenticated, private-workspace-first, and AI-provider-integrated.
- Kept output rights conditional and avoided promises of uniqueness, copyrightability, non-infringement, platform acceptance, or commercial/legal fitness.
- Added/retained mandatory-law carveouts so consumer rights override the no-refund default where required.

## Superseded Open Items

This report's original open items have been superseded by the later rewrite decision record. Remaining external actions now are:

- register and maintain the DMCA designated agent if ShortPulse wants DMCA safe-harbor protection;
- confirm the operational email aliases are created and monitored;
- have licensed counsel review entity identity, governing law, venue, consumer-law exceptions, subscription disclosures, privacy posture, and any future arbitration/class-action waiver language.

## Validation

- `git diff --check -- docs/agents/austerity`
- `npm -C frontend run docs:check`

Both checks passed on June 21, 2026.

## Residual Risk

These policies were legally stronger than the prior drafts at the time of this audit. The later rewrite decision record is the current Austerity retained reference for the updated drafts, PDFs, remaining external actions, and counsel-review boundary. Public route implementation, production URL proof, and footer-link launch closeout remain separate work.
