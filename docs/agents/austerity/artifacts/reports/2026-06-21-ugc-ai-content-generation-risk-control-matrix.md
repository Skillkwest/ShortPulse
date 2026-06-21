# UGC AI Content Generation Risk Control Matrix

Purpose: Austerity operating matrix translating the June 21, 2026 UGC AI legal research brief into ShortPulse product, policy, and launch controls.

Status: internal Austerity artifact. Counsel review required before public launch claims or jurisdiction-specific legal decisions.

Companion brief: `docs/agents/austerity/artifacts/reports/2026-06-21-ugc-ai-content-generation-legal-research-brief.md`

## Control Summary

ShortPulse should treat UGC AI content generation as a layered legal-risk system:

1. user rights and consent;
2. content safety and illegal-content response;
3. privacy and sensitive data;
4. AI output/IP limitations;
5. provider/platform flowdown;
6. consumer billing/refund law;
7. international launch constraints;
8. public hosting/sharing escalation.

The private-workspace posture is the safest default. Every move toward public sharing, youth access, adult/sexual output, celebrity/public-figure simulation, targeted advertising, or international acquisition adds a separate legal gate.

## P0 Controls Before Public Legal Pages

| Risk domain       | ShortPulse trigger                                   | Required control                                                                                                                                                                      | Current posture from research                                              |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Terms             | users upload/generate/store content                  | Terms must cover account responsibility, user content license, AI output caveats, provider terms, acceptable use, termination, liability, indemnity, copyright process, governing law | draft exists; publication blockers remain                                  |
| Privacy           | prompts, uploads, media, voices, billing, telemetry  | Privacy Policy must disclose categories, purposes, providers, AI processing, retention, rights, sensitive data, sale/share posture                                                    | draft exists; sale/share, provider, retention, biometric blockers remain   |
| Refunds           | subscriptions, credits, storage, generation failures | Refund Policy must match Stripe, credits, storage, failures, abandoned flows, no-cash-value posture, legal exceptions                                                                 | draft exists; refund window and jurisdiction blockers remain               |
| Age posture       | AI media, billing, privacy, voices                   | 18+ eligibility unless youth compliance is built                                                                                                                                      | recommended but needs final user/counsel approval                          |
| Media rights      | upload/generation uses third-party material          | versioned media-rights acceptance, user warranties, no rights violations                                                                                                              | repo has media agreement gate; policy language needed                      |
| Voice/likeness    | custom voices, real people, faces, identity material | affirmative consent/legal-right confirmation, ownership ledger, no deception/sexualization/impersonation                                                                              | repo has custom voice ownership authority; policy language needed          |
| Provider flowdown | OpenAI/Fal/Kie/ElevenLabs use                        | Terms/AUP must bind users to provider rules and applicable law                                                                                                                        | draft Terms includes provider flowdown                                     |
| Copyright         | user uploads/outputs can infringe                    | DMCA/copyright contact, designated agent if seeking safe harbor, takedown/counter-notice process, repeat-infringer policy                                                             | blocker                                                                    |
| Illegal content   | CSAM, NCII, fraud, harassment, scams                 | AUP prohibitions, abuse report intake, escalation records                                                                                                                             | policy draft has prohibitions; operational SOPs not yet proven             |
| Subscriptions     | recurring plans and storage add-ons                  | clear recurring terms, affirmative purchase consent, easy cancellation, Stripe behavior proof, state auto-renewal review                                                              | policy draft has cancellation/refund language; jurisdiction review remains |

## P1 Controls Before Public Sharing Or Gallery Features

| Risk domain             | Added trigger                                                 | Required control                                                                                                   | Why it matters                                               |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| DMCA                    | public/user-hosted content                                    | designated agent, public notice path, repeat-infringer policy, takedown/counter-notice workflow                    | Section 230 does not cover copyright                         |
| DSA                     | EU-accessible hosted/public UGC                               | notice-and-action mechanism, clear terms, illegal-content process, moderation transparency                         | applies beyond very large platforms for hosting services     |
| UK OSA                  | UK user-to-user/public sharing or pornographic content        | illegal-content risk assessment, children's access assessment if likely accessed by children, age/content controls | user-to-user and pornographic capability can trigger duties  |
| Take It Down Act / NCII | intimate real or AI-forged content reports                    | notice/removal path, target 48-hour response, preservation/appeal discipline                                       | U.S. FTC enforcement started in 2026                         |
| CSAM/NCMEC              | actual awareness of child exploitation material or enticement | CyberTipline escalation SOP, preservation rules, minimal handling procedure                                        | mandatory reporting if aware                                 |
| Moderation appeals      | content/account enforcement                                   | user notices, internal records, appeal/review channel                                                              | required or expected in several regimes and needed for trust |
| Repeat offenders        | repeated IP/abuse violations                                  | repeat-infringer and abuse-account termination policy                                                              | core DMCA and platform-safety hygiene                        |

## P2 Controls Before International Paid Acquisition

| Jurisdiction | Main legal areas                                                                           | ShortPulse control before active launch                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| EU/EEA       | EU AI Act, DSA, GDPR, consumer withdrawal, unfair commercial practices                     | AI/deepfake disclosure posture, DSA hosting review, GDPR lawful basis/DPIA/provider transfer review, EU consumer refund/cancellation review |
| UK           | UK GDPR, Online Safety Act, ASA/CMA advertising rules, explicit deepfake offences          | AI/privacy assessment, OSA applicability review, synthetic-ad disclosure guidance, intimate-image abuse controls                            |
| Canada       | privacy regulators' generative AI principles, PIPEDA/provincial privacy                    | privacy-by-design, consent/notice, safeguards, rights process, no assumption that AIDA absence means no duties                              |
| Australia    | Privacy Act sensitive/biometric information, eSafety image-based abuse                     | consent-sensitive face/voice handling, image-based-abuse reporting path, child/age safeguards if relevant                                   |
| China        | generative AI/deep synthesis rules, labeling, content controls, filing/security assessment | exclude/geofence unless dedicated China counsel and compliance launch plan exists                                                           |
| U.S. states  | privacy, biometric, auto-renewal, digital replicas, publicity rights                       | state privacy threshold review, biometric review, subscription law review, consent-first voice/likeness posture                             |

## Feature Gate Matrix

| Feature or posture                           | Legal status                 | Minimum gate before launch                                                                                                                |
| -------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Private AI Studio generation                 | allowed with controls        | Terms/Privacy/Refund/AUP, rights gate, provider flowdown, credit/refund clarity                                                           |
| Private media storage                        | allowed with controls        | privacy/security disclosures, deletion/retention terms, private storage and RLS proof                                                     |
| Custom voice cloning                         | high risk                    | explicit consent/legal right, ownership ledger, provider policy compliance, no deception/sexualization                                    |
| Realistic face/likeness generation           | high risk                    | rights/consent warranties, publicity/privacy warnings, no impersonation/deceptive/adult misuse                                            |
| Celebrity/public figure simulation           | very high risk               | default prohibit unless licensed or counsel-reviewed narrow use                                                                           |
| Minor likeness generation                    | very high risk               | default prohibit sexual/exploitative use; require guardian permission for allowed non-sensitive use                                       |
| Adult/sexual generation                      | very high risk               | default prohibit until age assurance, consent, moderation, provider, and counsel review                                                   |
| Public gallery/community                     | separate launch gate         | DMCA, NCII, CSAM, DSA/OSA review, moderation, reporting, appeals                                                                          |
| Export to social/ad platforms                | allowed with caveats         | remind users to disclose realistic AI media and comply with platform ad/synthetic media rules                                             |
| Targeted advertising/retargeting             | privacy gate                 | sale/share/targeted-ad disclosure, opt-outs, GPC/UOOM where required                                                                      |
| Use user content for model training          | privacy/IP gate              | default no unless opt-in, provider/data rights, deletion, retention, and privacy posture redesigned                                       |
| AI voice calls or political/election content | communications/election gate | default prohibit deceptive or unauthorized use; require TCPA, election-law, platform, and AI-disclosure compliance before any allowed use |
| EU/UK active marketing                       | international gate           | EU AI Act/GDPR/DSA/consumer review; UK GDPR/OSA/ASA review                                                                                |
| China availability                           | blocked by default           | dedicated China counsel and compliance plan                                                                                               |

## Acceptable Use Baseline

ShortPulse's AUP should prohibit:

- illegal content or illegal activity;
- CSAM, grooming, child exploitation, and sexualized minors, including AI-generated material;
- nonconsensual intimate imagery, sexual deepfakes, nudification, and unauthorized sexualized likenesses;
- unauthorized voice, face, likeness, identity, celebrity, public figure, or private-person impersonation;
- deception, scams, phishing, fraud, fake endorsements, fake testimonials, and government/business impersonation;
- robocalls, robotexts, voter suppression, political impersonation, synthetic campaign deception, or misleading public-interest content without required consent, authority, and disclosures;
- harassment, threats, hate, abuse, extortion, and blackmail;
- rights infringement, including copyright, trademark, publicity, privacy, contract, confidentiality, and trade-secret violations;
- malware, credential theft, scraping, circumvention, rate-limit abuse, and service interference;
- regulated professional advice as final advice without qualified professional involvement;
- provider/platform policy evasion;
- output use that misleads people about whether content is real or AI-generated where disclosure is required.

## User-Facing Disclosures To Add

Recommended product copy locations:

- Upload/media gate: "Only upload media you own or have permission to use. Get consent for real people, voices, likenesses, and minors."
- Voice clone modal: "Only clone or use a voice if you are the speaker or have explicit permission/legal right."
- Generation/export surfaces: "Realistic AI-generated or altered content may require disclosure on platforms or under local law."
- Billing/credits: "Credits are not cash and output quality, uniqueness, copyrightability, or platform acceptance is not guaranteed."
- Public support/reporting: "Report copyright, privacy, impersonation, intimate-image abuse, or safety concerns here."

## Evidence To Preserve

For legal defensibility, preserve:

- media agreement version and acceptance timestamp;
- voice consent/ownership records;
- generation request IDs and provider task IDs;
- credit reservation/capture/release records;
- upload source, storage path, user ownership, and deletion events;
- takedown requests, action timestamps, counter-notices, appeals, and repeat-offender actions;
- privacy request intake and response records;
- refund request, Stripe invoice, credit ledger, and decision records;
- content-safety escalation records, with minimized access to harmful material.

## Austerity Review Checklist

Before approving any new AI content feature, ask:

- Does it involve real people, minors, voices, faces, likenesses, brands, copyrighted works, or sensitive data?
- Is it private workspace use, export-only use, or public hosted UGC?
- Does it create or alter realistic content that could mislead people?
- Does it touch adult, sexual, intimate, violent, political, health, finance, legal, or safety-sensitive domains?
- Does a provider prohibit or condition this use?
- Does a destination platform require AI/synthetic media disclosure?
- Does the privacy policy disclose the data categories, purposes, providers, retention, and rights?
- Does the refund/billing posture match actual Stripe and credit behavior?
- Does the feature increase international legal exposure?
- Is counsel review required before launch?

## Current Confidence

Decision-grade:

- ShortPulse needs consent-first media/voice/likeness rules.
- Public sharing is a separate legal launch gate.
- AI output rights must be caveated.
- DMCA/copyright, NCII, CSAM, privacy, and provider-flowdown controls are necessary.
- EU/UK/China launch adds non-trivial legal obligations and should not be passive.

Not yet decision-grade:

- exact governing law, arbitration, and class-waiver posture;
- exact refund/withdrawal terms for EU/UK and U.S. state subscription laws;
- exact AI political-ad, election deepfake, and TCPA/telemarketing flowdown language for users;
- whether ShortPulse processes legally regulated biometric identifiers;
- whether any marketing stack creates sale/share/targeted-ad obligations;
- final provider/subprocessor retention commitments;
- final public hosting duties without the actual public-sharing design.
