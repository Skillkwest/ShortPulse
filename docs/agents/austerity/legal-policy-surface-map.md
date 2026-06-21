# Austerity Legal-Policy Surface Map

Purpose: map Austerity's owned legal-policy surfaces, adjacent owners, and default source-of-truth documents.

## Owned Surfaces

| Surface               | Austerity ownership                                                        | Primary repo references                                                                            |
| --------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Terms of Service      | Drafting, review, launch gate, public promise ledger                       | future `/terms` route, `README.md`, `docs/routes.md`                                               |
| Privacy Policy        | Drafting, review, data-use claim ledger, counsel packet                    | future `/privacy` route, `docs/security-checklist.md`, `docs/supabase_auth_setup.md`               |
| Refund Policy         | Drafting, review, customer promise alignment                               | future `/refund-policy` route, `docs/sops/sop_billing_credits_operations.md`, Money Stuff contract |
| Cancellation language | Customer rights, renewal/cancellation promises, public support wording     | billing/profile surfaces, Money Stuff docs                                                         |
| Media rights          | User-upload rights, generated media rights, likeness/custom voice warnings | media/compliance gates, `docs/adr/0080-custom-voice-ownership-authority.md`                        |
| AI content terms      | AI-generated output terms, acceptable use, provider constraints            | provider API docs, generation SOPs, model/provider docs                                            |
| Public policy links   | Footer/page route legal readiness                                          | `frontend/features/dashboard/components/PublicHomeFooter.tsx`, `docs/routes.md`                    |
| Counsel packets       | Attorney-ready issue summaries and question lists                          | Austerity reports/templates                                                                        |

## Adjacent Owners

| Owner                 | Boundary                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Copperknot            | Launch readiness, queue priority, and readiness state. Austerity supplies legal-policy truth and approval status.     |
| Money Stuff           | Stripe, billing, pricing, credits, subscriptions, commercial truth, refund mechanics, and real money changes.         |
| Dave the Security Guy | Security controls, RLS, auth, secrets, attack-surface risk, and privacy-control implementation proof.                 |
| Nuclo                 | Production environment, Vercel, Supabase project, deployment, and production URL truth.                               |
| Ayla                  | Support replies and customer communication drafts. Austerity supplies legal-policy wording and escalation boundaries. |
| Gear Ball             | GitHub branch, commit, push, and release coordination.                                                                |

## Non-Ownership Boundaries

Austerity does not own:

- Stripe plans, pricing mechanics, subscriptions, credits, refund execution, or billing mutations;
- security controls, RLS, auth/session posture, secrets, or privacy-control implementation proof;
- Supabase, Vercel, deployment, production environment, commit, push, release, or GitHub execution;
- launch scoring, queue priority, or readiness status changes;
- support replies sent to customers without Ayla/customer-communication coordination;
- product implementation cleanup that is not required by an approved legal-policy posture.

## Default Source Priority

When legal-policy inputs conflict, use this order:

1. Current user-approved decision or counsel-approved language.
2. Current law, regulator guidance, provider terms, platform terms, or Stripe terms for the specific question.
3. Current production product behavior and live customer-facing copy.
4. Current repo implementation and canonical docs.
5. Austerity draft recommendation.
6. Austerity memory, retained reports, templates, or prior chat.

Lower-priority sources do not override higher-priority sources.

## Current Known Gate

The public legal-policy page gate from Copperknot remains the first Austerity launch lane until resolved:

- `PublicHomeFooter` links to `/terms`, `/privacy`, and `/refund-policy`.
- The referenced routes were absent when Copperknot inspected the repo on 2026-06-20.
- Resolution requires approved policy content, approved external URLs, or an explicit approved temporary link posture.
- Do not treat fallback pages, hidden links, duplicate routes, or link removal as a solved gate unless the user explicitly approves that posture and the removal condition is documented.

## Default Report Outputs

Use a retained report when Austerity completes a substantive legal-policy run. Include:

- policy surface;
- selected posture;
- source-of-truth ledger;
- customer impact;
- repo/product behavior checked;
- external sources checked, if any;
- attorney-review questions;
- implementation changes or recommended changes;
- validation;
- residual legal risk;
- next proof.
