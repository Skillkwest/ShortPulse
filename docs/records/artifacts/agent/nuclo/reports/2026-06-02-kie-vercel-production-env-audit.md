# 2026-06-02 Kie Vercel Production Env Audit

Purpose: capture Nuclo's read-only Vercel production environment audit for the June 2, 2026 Kie/Kling video-generation auth failure lane so another agent can continue from a clean evidence packet.

## Scope

- Date: `2026-06-02`
- Mode: inspection only
- Branch: `production`
- Surface: Vercel production environment variables and repo runtime env precedence for Kie submit auth
- Requested outcome: determine whether production Kie auth failure is caused by env shadowing, wrong submit target, missing key, or a remaining unknown

## Why This Audit Was Run

ShortPulse video generation through Kie/Kling was failing in production with an auth-style provider error. The immediate question was whether the production Vercel environment was wired correctly for:

- `KIE_API_KEY`
- `SHORTPULSE_KIE_API_KEY`
- `SHORTPULSE_KIE_SUBMIT_URLS`
- `SHORTPULSE_KIE_STATUS_BASE_URLS`

This report focuses on the environment/config layer only. It does not claim a final provider root cause beyond what the env evidence supports.

## Repo Runtime Contract Verified

Live repo code currently resolves Kie auth and submit targets this way:

- `frontend/lib/server/providerIntegration/providerRuntimeConfig.ts`
  - Kie auth prefers `KIE_API_KEY`
  - then falls back to `SHORTPULSE_KIE_API_KEY`
- same file resolves submit targets from:
  - `SHORTPULSE_KIE_SUBMIT_URLS` when present
  - otherwise the model catalog default
- catalog default for `kie-ai/kling-3.0` remains:
  - `https://api.kie.ai/api/v1/jobs/createTask`

Implication:

- if both key names are present, `KIE_API_KEY` would win
- if no submit override is set, production should use the official Kie `createTask` endpoint

## Commands Used

Secrets redacted. Commands shown in shape only.

```bash
vercel env ls --format json
```

```bash
vercel env pull /tmp/nuclo-kie2/prod.env --environment production
```

```bash
vercel env pull /tmp/nuclo-kie/preview.env --environment preview --git-branch staging-preview
```

```bash
vercel env pull /tmp/nuclo-kie/dev.env --environment development
```

## Vercel Inventory Findings

`vercel env ls --format json` showed:

- `KIE_API_KEY`
  - no rows found
- `SHORTPULSE_KIE_API_KEY`
  - one `production` row
  - one branch-specific `preview` row for `staging-preview`
  - one shared `preview` + `development` row
- `SHORTPULSE_KIE_SUBMIT_URLS`
  - no rows found
- `SHORTPULSE_KIE_STATUS_BASE_URLS`
  - no rows found

Important updated detail:

- the `production` `SHORTPULSE_KIE_API_KEY` row has a recent `updatedAt` timestamp, which is consistent with operator attention on this variable

## Effective Env Pull Findings

### Production pull

Observed in `/tmp/nuclo-kie2/prod.env`:

- `SHORTPULSE_KIE_API_KEY`
  - line present
  - pulled value observed as empty string
- `KIE_API_KEY`
  - not present
- `SHORTPULSE_KIE_SUBMIT_URLS`
  - not present
- control sanity checks:
  - `ELEVENLABS_API_KEY` pulled non-empty
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` pulled non-empty

### Preview pull (`staging-preview`)

Observed in `/tmp/nuclo-kie/preview.env`:

- `SHORTPULSE_KIE_API_KEY`
  - line present
  - pulled value observed as empty string
- `KIE_API_KEY`
  - not present
- `SHORTPULSE_KIE_SUBMIT_URLS`
  - not present

### Development pull

Observed in `/tmp/nuclo-kie/dev.env`:

- `SHORTPULSE_KIE_API_KEY`
  - line present
  - pulled value observed as non-empty
- `KIE_API_KEY`
  - not present
- `SHORTPULSE_KIE_SUBMIT_URLS`
  - not present

## Result Table

| Question | Result |
| --- | --- |
| Is there a live `KIE_API_KEY` vs `SHORTPULSE_KIE_API_KEY` shadowing collision in production? | No direct evidence of that. `KIE_API_KEY` is absent from Vercel inventory. |
| Is production overriding the Kie submit URL? | No. `SHORTPULSE_KIE_SUBMIT_URLS` is absent, so runtime should fall back to the catalog default. |
| What is the expected production Kie submit URL right now? | `https://api.kie.ai/api/v1/jobs/createTask` |
| Does Vercel inventory show a production `SHORTPULSE_KIE_API_KEY` row? | Yes. |
| Does `vercel env pull` show a non-empty production `SHORTPULSE_KIE_API_KEY` value? | No. The pulled value was observed as empty string. |
| Is this empty-pull behavior isolated to production? | No. Preview showed the same empty-pull behavior; development did not. |

## Interpretation

### High-confidence conclusions

- This is not currently a `KIE_API_KEY` precedence bug.
- This is not currently a `SHORTPULSE_KIE_SUBMIT_URLS` override bug.
- Production Kling/Kie submit should still be targeting the official Kie `createTask` endpoint.

### Most important unresolved contradiction

There is a contradiction between:

1. operator statement in-thread that the ShortPulse Kie API key is correctly set in Vercel, and
2. CLI-observed `vercel env pull` output showing:
   - production `SHORTPULSE_KIE_API_KEY=""`
   - preview `SHORTPULSE_KIE_API_KEY=""`
   - development `SHORTPULSE_KIE_API_KEY` non-empty

Because other secrets pulled normally in the same session, Nuclo cannot simply assume `vercel env pull` blanked every sensitive value generically. At the same time, the operator statement means this should not be treated as final proof that the dashboard value is absent or wrong without a direct dashboard-side recheck or a live post-deploy smoke.

## Best Current Read

As of this audit, the highest-confidence env-layer statement is:

- production does not show a key-name shadowing problem
- production does not show a submit-URL override problem
- there is a live contradiction around the effective `SHORTPULSE_KIE_API_KEY` value in production that still needs reconciliation

In plain language:

- the original "wrong sibling key wins" theory is no longer the lead suspect
- the lead env concern is now whether production is actually serving a usable Kie key at runtime

## Recommended Next Checks For The Receiving Agent

1. Treat the key-name precedence theory as downgraded.
2. Verify the production `SHORTPULSE_KIE_API_KEY` directly from the Vercel dashboard/operator surface rather than relying only on `vercel env pull`.
3. Trigger or inspect a fresh production deploy after confirming the key value, because `NEXT_PUBLIC_*` and server env consumers both depend on deployment/runtime freshness.
4. Run one controlled production Kling 3.0 smoke submit on `https://www.shortpulse.ai`.
5. If the smoke still fails after confirmed non-empty runtime key, move to the next seams:
   - provider-side account/auth state
   - Kie key/account mismatch
   - route-level payload/provider behavior

## Owner Recommendation

Primary next owner:

- the agent working the Kie/Kling runtime failure lane

Nuclo recommendation to that owner:

- do not spend more time on `KIE_API_KEY` shadowing unless a new inventory row appears
- do not spend more time on submit-URL override unless a new override row appears
- focus next on reconciling the effective production key value versus dashboard claim, then do a live production smoke

## Residual Risk

Moderate.

Reasons:

- Vercel inventory and pulled env behavior do not fully agree with the operator's dashboard-level claim
- env correctness alone still does not prove provider account health
- no live generation smoke was run in this Nuclo audit pass

## No-Change Statement

No repo code, Vercel configuration, or Supabase state was mutated in this audit. This report is evidence only.
