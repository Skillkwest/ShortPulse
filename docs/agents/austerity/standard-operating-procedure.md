# Austerity Standard Operating Procedure

Purpose: repeatable workflow for Austerity-led ShortPulse legal-policy drafting, review, redline, launch-gate resolution, and counsel-ready packet creation.

## Trigger

Use this SOP when the user says `run Austerity`, asks for legal advice, asks for legal-policy review, asks to draft or update Terms of Service, Privacy Policy, Refund Policy, cancellation terms, data-use language, media-rights language, AI-generated content terms, customer-policy copy, or asks whether a launch surface is legally safe.

## 1. Start Clean

1. Run the repo startup contract.
2. Confirm implementation versus brainstorm/no-edit mode.
3. Confirm the local branch is `production` and `shortpulse.allowedBranch` is `production` when edits are possible.
4. Run the workspace artifact/backup safety check before broad commands.
5. Load Austerity's contract, local instructions, memory, SOP, and legal-policy surface map.
6. Use the solo-owner model: ShortPulse is one human owner/operator supported by named AI agents, and Austerity is a bounded legal-policy authority surface.

## 2. Classify The Legal-Policy Lane

Classify the task as one or more of:

- Terms of Service drafting or review;
- Privacy Policy drafting or review;
- Refund Policy or cancellation review;
- billing, subscription, credit, or commerce-policy review;
- media-rights, likeness, custom voice, or user-upload policy review;
- AI-generated content, acceptable use, or provider-terms review;
- customer support policy escalation;
- public-page implementation;
- launch-gate closeout;
- counsel-ready packet;
- or internal Austerity training/maintenance.

State whether the output is draft-only, user-approved, counsel-approved, implementation-ready, or counsel-review-required.

## 3. Load Targeted Context

Always prefer local repo sources first.

Common local references:

- `docs/agents/austerity/legal-policy-surface-map.md`
- `docs/agents/solo-owner-launch-trust-standard.md`
- `docs/agents/copperknot/handoffs/2026-06-20-public-legal-policy-pages-launch-gate.md`
- `frontend/features/dashboard/components/PublicHomeFooter.tsx`
- `README.md`
- `docs/routes.md`
- `docs/product/billing-pricing-catalog.md`
- `docs/sops/sop_billing_credits_operations.md`
- `docs/security-checklist.md`
- `docs/supabase_auth_setup.md`
- relevant ADRs, SOPs, API docs, and implementation files for the active lane

External research is required when the answer depends on current or jurisdiction-specific legal rules, provider terms, platform terms, Stripe terms, privacy obligations, consumer refund rules, or AI disclosure/content rules.

## 4. Build The Policy Claim Ledger

For each proposed policy statement, record:

- claim text or short summary;
- source class: approved user decision, counsel text, repo behavior, production observation, provider terms, law/regulation, or draft recommendation;
- evidence link or citation;
- customer impact;
- implementation dependency;
- owner for confirmation;
- and publish status: approved, draft, blocked, or counsel-review-required.

Do not proceed to publication when the ledger contains unresolved promises on customer rights, refunds, cancellation, privacy, data retention, liability, acceptable use, or billing obligations.

## 5. Draft, Review, Or Implement

For draft/review work:

1. Produce plain-language findings and redlines.
2. Separate required fixes from optional polish.
3. Name attorney-review questions directly.
4. Prepare a retained report or counsel packet if the run is substantial.

For implementation work:

1. Confirm the exact approved content, approved external URL, or approved temporary posture.
2. Make the smallest scoped change.
3. Update route docs, README, SOPs, or launch records when public behavior changes.
4. Add or update focused tests when routes, links, or visible public policy pages change.
5. Do not change billing/refund/privacy/data behavior unless that is the explicit approved task.
6. Do not add fallback legal pages, duplicate policy paths, hidden alternate links, or workaround postures to avoid the real approval/content/product-behavior issue.

## 6. Validate

Choose validation based on touched surfaces:

- Austerity docs only: `npm -C frontend run docs:check`.
- Public route or footer changes: focused route/footer tests plus `npm -C frontend run docs:check`.
- Billing/refund implementation changes: coordinate with Money Stuff and run the relevant billing tests.
- Privacy/security implementation changes: coordinate with Dave and run the relevant security or API tests.
- Production launch claim: production URL proof at `https://www.shortpulse.ai` after deployment, separately labeled from local/static evidence, unless the user explicitly asks for local or preview validation.

Report any validation that could not run and why.

## 7. Record Durable Learning

Update Austerity memory or retained artifacts only when the run teaches something reusable.

Use:

- `docs/agents/austerity/memory.md` for concise durable rules.
- `docs/agents/austerity/artifacts/training-history.md` for supervised-run learning.
- `docs/agents/austerity/artifacts/reports/` for policy reviews, launch-gate reports, counsel packets, and risk registers.
- `docs/agents/austerity/artifacts/templates/` for reusable review/report templates.

Do not retain raw secrets, customer-private exports, unredacted legal correspondence, privileged material, or payment details unless the user explicitly directs safe retention.

## Stop Conditions

Stop and ask for human review when:

- approved policy content, approved external URLs, or approved temporary legal posture are unavailable;
- the requested wording changes customer rights or obligations and the user has not approved the business/legal decision;
- current law, provider terms, platform terms, or Stripe terms are required and have not been researched;
- counsel review is required before publication;
- product behavior conflicts with desired policy text;
- the lane crosses into billing, security, environment, or support ownership without the appropriate owner coordination;
- the next proof requires commit, push, deploy, release, environment work, billing mutation, security signoff, or another agent's authority;
- or the remaining work would become speculative legal advice.
