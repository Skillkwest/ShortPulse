# ShortPulse Legal Conformance Map

Date: 2026-06-22

Purpose: map current ShortPulse product behavior to Austerity's legal obligations and watch items for AI UGC, consent, privacy, billing/refunds, and public policy claims.

Authority: repo-behavior and legal-operations synthesis. This is not production proof and not counsel signoff.

## Current Product Shape

ShortPulse is currently best understood as:

- a Next.js/Supabase authenticated AI creative workspace;
- protected creation route `/ai-studio`;
- private user-scoped media storage and projects;
- AI generation workflows across image, video, audio, music, sound effects, voiceover, voice changer, text-to-voice, and voice clone;
- model/provider routes through OpenAI, Fal/Kie, and ElevenLabs;
- Stripe subscriptions, credit packs, recurring storage add-ons, and credit debits;
- account/profile billing controls and Stripe portal handoff;
- public legal policy pages `/terms`, `/privacy`, `/refund-policy`;
- admin legal publication surface `/admin/legal`;
- safety/intake routes such as `/api/report-issue` and support email posture in public policies.

Primary local evidence:

- `README.md`
- `docs/routes.md`
- `docs/adr/0093-legal-policy-control-plane.md`
- `frontend/lib/protectedRoutes.ts`
- `frontend/lib/server/api/protectedApiPaths.ts`
- `frontend/lib/compliance/mediaAgreement.ts`
- `frontend/pages/api/account/media-compliance.ts`
- `docs/product/billing-pricing-catalog.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/adr/0080-custom-voice-ownership-authority.md`
- `frontend/features/pricing/components/PricingRouteContent.tsx`

## Conformance Strengths

### Adult/private workspace posture

The Terms and Privacy Policy state 18+ posture. Protected routes include `/ai-studio`, `/profile`, `/admin`, `/report-issue`, and protected API prefixes for generation/media/account routes. This supports the adult authenticated private workspace posture.

Watch item: there is no hard age-verification system in the inspected surfaces. For current launch, policy can say 18+; broader youth/minor-safe claims would need product controls.

### Media rights gate

`MEDIA_COMPLIANCE_AGREEMENT` requires users to confirm:

- ownership or permission for media;
- consent for real people;
- parent/guardian permission for minors;
- no rights violations, impersonation, deception, or exploitation.

This is an excellent legal control for AI UGC, consent, likeness, and voice risk. It should remain a protected-route gate for AI Studio and any future media-generating route.

Watch item: the agreement is concise. If ShortPulse expands celebrity/public figure, synthetic influencer, client work, voice clone, or ad workflows, add workflow-specific consent prompts and records rather than relying only on this general gate.

### Custom voice ownership boundary

ADR 0080 correctly treats shared ElevenLabs inventory as insufficient to prove ownership. App-owned `user_owned_custom_voices` is the authority. Create/clone flows fail closed and roll back provider/sample artifacts when ownership persistence fails.

Legal effect: strong consent/privacy/IP posture for custom voices because a user can access/delete/use only voices ShortPulse records as theirs.

Watch item: custom voice workflows still need user-facing consent warnings at the point of clone/design where practical, especially for third-party voices and commercial uses.

### Legal control plane

ADR 0093 makes public legal pages runtime-backed by service-role legal policy control plane, with `frontend/content/legal/` as bootstrap seed only. `/admin/legal` publishes versioned global updates.

Legal effect: better version history and stale-write protection for public commitments.

Watch item: seed Markdown does not overwrite production DB runtime rows. Austerity must distinguish seed copy, admin draft, published runtime copy, and production URL proof.

### Billing source-of-truth split

Billing docs distinguish plan catalog, subscriber contracts, credit ledger, Stripe, internal comp, storage add-ons, and runtime model-pricing policy. Refund policy aligns with no automatic cash refunds for failed creative expectations and credit restoration for recognized failed generations.

Watch item: checkout/pricing copy inspected in `PricingRouteContent.tsx` currently says "Upgrade anytime. Downgrades apply at the next billing cycle." That is not enough by itself to satisfy the full Refund Policy disclosure posture around auto-renewal, cancellation path, non-refunds, and credit/storage treatment. The current legal documents are stronger than the visible pricing helper.

## Legal Watch Items

### 1. Checkout/refund/cancellation disclosure alignment

Risk: user-facing pricing and checkout disclosures may not repeat enough of the refund policy. Stripe Checkout may carry some disclosures, but ShortPulse should not rely only on Stripe for public pricing-page truth.

Recommended product requirement:

- Before recurring checkout, show plan name, price, billing interval, auto-renewal, cancellation path, and "canceling stops future renewals but does not automatically refund current period, used credits, credit packs, storage add-ons, taxes, or completed generation charges."
- Add links to Terms and Refund Policy near checkout CTA.
- Keep annual/monthly switch and downgrade copy aligned with actual Stripe portal behavior.

Owner: Austerity + Money Stuff.

### 2. AI disclosure and watermarking/readable provenance

Risk: EU AI Act Article 50 transparency obligations apply from 2026-08-02 for covered EU activity. Social/ad platforms increasingly require AI disclosure for synthetic or manipulated media.

Recommended product requirement:

- Do not market EU-ready AI compliance yet.
- Add a future product gate for AI-generated/deepfake labeling, metadata/watermarking/provenance, and export disclosure guidance.
- For now, Terms should continue making users responsible for required AI disclosures.

Owner: Austerity + product owner + Dave for implementation privacy/security implications.

### 3. NCII/deepfake takedown process

Risk: current product is private by default, but image/video sharing apps and public hosted content can trigger TAKE IT DOWN obligations. Even private generation can create reports.

Recommended product requirement:

- Keep `safety@shortpulse.ai` intake.
- Add an internal NCII response SOP before any public hosted UGC, community, gallery, public profile, collaboration, or share-link feature.
- If public sharing launches, implement a clear notice/removal flow, duplicate-copy handling, status tracking, and 48-hour operational SLA for valid requests.

Owner: Austerity + Dave + Ayla + Copperknot before public UGC launch.

### 4. DMCA safe harbor

Risk: public Terms currently say ShortPulse should not claim registered DMCA safe-harbor status until registration is complete. That is correct.

Recommended product requirement:

- If user-stored/public UGC becomes material, register a DMCA designated agent with the Copyright Office and publish matching website details.
- Maintain repeat-infringer policy and takedown/counter-notice SOP.

Owner: user/operator with Austerity counsel packet.

### 5. Privacy sensitive data and biometric posture

Risk: AI Studio processes face, voice, likeness, audio, visual, and other potentially sensitive media. Even if ShortPulse avoids biometric identification, laws may treat some voice/face data as sensitive personal information depending on use.

Recommended product requirement:

- Privacy Policy should continue avoiding biometric-identification promises unless Dave confirms implementation.
- Product should not perform face recognition, identity verification, emotion recognition, or biometric categorization without a new legal/privacy/security gate.
- Data retention and deletion behavior should be product-audited before stronger promises.

Owner: Austerity + Dave.

### 6. Public community/marketplace/galleries

Risk: public UGC shifts ShortPulse from private tool to platform. That changes DMCA, TIDA, DSA/UK OSA, moderation, appeal, repeat-offender, public safety, and illegal-content duties.

Recommended product requirement:

- Treat public hosted UGC as blocked by legal gate until there is an explicit platform compliance plan.
- Terms already reserve that extra terms/reporting/moderation may apply later; keep that language.

Owner: Copperknot launch gate + Austerity.

### 7. International expansion

Risk: Privacy Policy says U.S.-first and does not represent localization for all countries. That is correct.

Recommended product requirement:

- Avoid marketing ShortPulse as EU/UK/global-compliant before review.
- EU/UK launch needs GDPR/UK GDPR, DSA/OSA, AI Act labeling, cookies, consumer withdrawal, DPA/subprocessor, international transfer, and VAT/tax review.
- China availability should remain excluded unless dedicated China counsel and infrastructure compliance planning exists.

Owner: user/operator + Austerity counsel packet.

## Must-Preserve Policy Positions

- Adult-only 18+.
- Private workspace by default.
- No public hosted UGC by default.
- User is responsible for input rights, consent, third-party rights, platform rules, and disclosures.
- Conditional commercial use allowed, but no guarantee of copyrightability, uniqueness, non-infringement, platform acceptance, ad acceptance, or client approval.
- No training on private workspace content by ShortPulse-owned foundation models unless later expressly approved and disclosed.
- Product improvement may use account data, usage data, logs, support reports, provider status, safety events, aggregated/deidentified information, and similar operational data.
- Credits are not cash, gift cards, stored value, banked money, cryptocurrency, or deposit accounts.
- Refunds are discretionary/required-by-law/recognized-failure-review, not ordinary dissatisfaction with outputs.

## Counsel-Review Questions

- Should ShortPulse keep Arizona governing law and Maricopa County venue, add arbitration/class waiver, or keep no-arbitration posture?
- What exact automatic-renewal disclosures are required for ShortPulse's U.S. launch states and Stripe checkout configuration?
- Does the media-rights gate create sufficient consent evidence for current voice/likeness workflows, or should high-risk workflows require separate consent attestations?
- Does ShortPulse's processing of face/voice media create biometric-law exposure under Illinois, Texas, Washington, California, Colorado, or other state privacy laws based on current implementation?
- What retention/deletion promises can be made after Dave/Nuclo audit actual Supabase storage, backups, logs, provider retention, and legal-policy control plane records?
- Should ShortPulse register a DMCA agent before launch even if public sharing is not yet enabled?

## Stop Conditions For Austerity

Stop before making public or implementation claims if:

- the issue requires live production proof and only repo evidence exists;
- checkout/refund behavior conflicts with policy;
- public UGC or international expansion enters scope;
- biometric/voice/likeness analysis depends on exact technical implementation not yet inspected;
- or a customer right would change without user/counsel approval.
