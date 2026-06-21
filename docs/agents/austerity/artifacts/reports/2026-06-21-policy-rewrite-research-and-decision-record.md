# ShortPulse Policy Rewrite Research And Decision Record

Date: June 21, 2026

Owner: Austerity

Scope: Research and rewrite support for the ShortPulse Terms of Service, Privacy Policy, and Refund Policy after the requested final policy polish pass.

## Source Set

- U.S. Copyright Office DMCA Designated Agent Directory: https://www.copyright.gov/dmca-directory/
- U.S. Copyright Office Section 512 resources: https://www.copyright.gov/512/
- U.S. Copyright Office AI resources and registration guidance links: https://www.copyright.gov/ai/
- FTC click-to-cancel business guidance: https://www.ftc.gov/business-guidance/blog/2024/10/click-cancel-ftcs-amended-negative-option-rule-what-it-means-your-business
- California automatic renewal consumer alert: https://oag.ca.gov/news/press-releases/attorney-general-bonta-issues-consumer-alert-california%E2%80%99s-automatic-renewal-law
- California CCPA consumer-rights page: https://oag.ca.gov/privacy/ccpa
- Colorado Attorney General universal opt-out page: https://coag.gov/opt-out/
- Stripe Customer Portal documentation: https://docs.stripe.com/customer-management
- OpenAI business/API data-use guidance: https://help.openai.com/en/articles/5722486-how-your-data-is-used-to-improve-model-performance
- Fal terms, privacy policy, acceptable-use policy: https://fal.ai/legal/terms-of-service, https://fal.ai/legal/privacy-policy, https://fal.ai/legal/acceptable-use-policy
- ElevenLabs terms, privacy policy, prohibited-use policy: https://elevenlabs.io/terms-of-use, https://elevenlabs.io/privacy-policy, https://elevenlabs.io/use-policy
- Kie.ai terms and privacy policy: https://kie.ai/terms-of-use, https://kie.ai/privacy-policy
- Supabase privacy policy and DPA page: https://supabase.com/privacy, https://supabase.com/legal/dpa
- Vercel privacy notice and DPA: https://vercel.com/legal/privacy-notice, https://vercel.com/legal/dpa
- European Data Protection Board international-transfer guide: https://www.edpb.europa.eu/sme-data-protection-guide/international-data-transfers_en

## Decisions Applied

1. Placeholder replacement.
   - Replaced legal entity placeholder with "ShortPulse, the operator of the Service" because no formal legal-entity name was available in the repo context.
   - Replaced contact placeholders with operational aliases: support@shortpulse.ai, billing@shortpulse.ai, privacy@shortpulse.ai, legal@shortpulse.ai, copyright@shortpulse.ai, and safety@shortpulse.ai.
   - Removed the mailing-address placeholder rather than inventing a physical address.

2. Publication language.
   - Removed all public-candidate labeling from the three public policy drafts.
   - Removed unresolved finalization labels from public-facing documents.

3. Commercial AI output use.
   - Added a plain-English commercial-use section in the Terms.
   - Posture: ShortPulse does not claim ownership of outputs merely because generated through ShortPulse, but the user remains responsible for rights clearance, consent, disclosure, platform rules, and commercial legal review.
   - Rationale: U.S. copyright guidance remains cautious on AI-generated material and human authorship; the policy should avoid guaranteeing copyrightability or commercial clearance.

4. No-training vs product-improvement language.
   - Terms and Privacy now distinguish:
     - no current use of private workspace content to train ShortPulse-owned foundation models;
     - no intentional opt-in to third-party provider model training when ShortPulse has a provider setting or account-level choice;
     - allowed use of logs, status, cost, error, safety, support, aggregated, and deidentified information for product improvement.
   - Rationale: OpenAI states business/API inputs and outputs are not used for training by default unless opted in, but other providers may have their own terms and retention practices.

5. Provider/data-processing table.
   - Added a Privacy Policy provider table for Supabase, Stripe, Vercel/hosting, OpenAI, Fal, Kie.ai, ElevenLabs, YouTube/tutorial embeds, support/logging/analytics/operations tools, and professional advisers.
   - Rationale: repo context showed these provider surfaces. The table avoids claiming an exhaustive subprocessor register.

6. DMCA.
   - Added copyright notice and counter-notice requirements plus a ShortPulse Copyright Agent intake email.
   - Added a clear statement that DMCA safe-harbor status should not be claimed until the operator completes and maintains the U.S. Copyright Office online designated-agent registration.
   - Rationale: the Copyright Office states a service provider must publish designated-agent information and provide the same information to the Copyright Office through the online system.

7. Checkout cancellation/refund alignment.
   - Terms and Refund Policy now align on:
     - subscriptions renew automatically until canceled;
     - cancellation stops future renewals according to the active billing configuration;
     - cancellation does not automatically refund past/current charges, credit packs, add-ons, taxes, or used credits;
     - upgrades may be immediate/prorated, downgrades may be end-of-period;
     - Stripe Billing Portal is the secure management/cancellation path for eligible Stripe-managed subscriptions.
   - Rationale: repo billing SOP says Stripe Billing Portal configuration is part of the customer-facing subscription-change contract, and Stripe supports subscription cancellation immediately or at period end through the portal.

8. Cookies/tracking and privacy rights.
   - Finalized a first-party operational/telemetry/attribution posture.
   - Stated ShortPulse is not currently designed for third-party ad cookies, retargeting pixels, lookalike audiences, sale/share, or targeted advertising.
   - Added privacy request intake, verification, appeal language, California rights, and U.S. state universal opt-out posture.

9. Retention.
   - Retention section now names account/profile, media/projects/outputs, billing/tax/payment, logs/telemetry/error records, takedown/abuse/safety/fraud records, and backups.
   - Posture remains criteria-based rather than fixed-day retention because the repo does not yet expose final retention automation for every category.

10. International posture.
   - Added U.S.-first launch posture.
   - Added notice that data may be processed in the United States and provider countries.
   - Added that ShortPulse should not be treated as an enterprise GDPR, UK GDPR, Swiss FADP, or other international compliance solution without a separate written agreement addressing controller/processor, legal basis, transfer, DPA, and subprocessor terms.

11. Governing law, venue, arbitration, and consumer exceptions.
   - Terms use Arizona law and Maricopa County, Arizona venue as the operator-default based on current workspace/user context.
   - Terms do not include mandatory arbitration or a class-action waiver.
   - Terms and Refund Policy preserve non-waivable consumer, privacy, payment, cancellation, refund, and statutory rights.
   - Rationale: arbitration/class waiver language can be high-risk and state/consumer-specific; it should be added only after licensed counsel approves the exact clause and exceptions.

## External Actions Not Completed In Repo

- DMCA safe-harbor registration: not completed. The operator must register the designated agent in the U.S. Copyright Office online DMCA Designated Agent Directory and keep the registration current.
- Counsel review: not completed. Licensed counsel should review the final entity name, physical notice address if any, Arizona governing law/Maricopa venue, no-arbitration/no-class-waiver posture, consumer-law exceptions, subscription disclosures, privacy rights coverage, and international launch posture.
- Email alias verification: not completed. Confirm support@shortpulse.ai, billing@shortpulse.ai, privacy@shortpulse.ai, legal@shortpulse.ai, copyright@shortpulse.ai, and safety@shortpulse.ai exist and are monitored before public launch.

## Files Updated

- `docs/agents/austerity/workspace/drafts/2026-06-21-shortpulse-terms-of-service-draft.md`
- `docs/agents/austerity/workspace/drafts/2026-06-21-shortpulse-privacy-policy-draft.md`
- `docs/agents/austerity/workspace/drafts/2026-06-21-shortpulse-refund-policy-draft.md`
