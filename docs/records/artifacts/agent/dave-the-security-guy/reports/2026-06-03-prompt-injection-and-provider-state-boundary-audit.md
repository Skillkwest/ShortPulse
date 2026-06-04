# Prompt Injection and Provider State Boundary Audit - 2026-06-03

Agent: Dave the Security Guy

Mode: launch-readiness security lane, root-cause first, local `production`

## Scope

Audited AI Studio external-input and prompt-authority surfaces after Nuclo's Supabase control-plane handoff:

- Standard and Pulse agent API route boundaries
- prompt-injection controls for user messages, Pulse context, image-derived text, and prompt references
- runtime prompt and Pulse built-in control-plane routes
- agent safety policy control-plane routes
- Standard Responses provider-state continuity

Mini Ecosystem was intentionally out of scope.

## Confirmed High-ROI Finding

### Standard Responses provider state accepted browser-held `previous_response_id`

Severity: High when `STUDIO_AGENT_STANDARD_RESPONSES_ENABLED=true` and chat fallback is disabled; dormant when the flag is off.

Confidence: High from current repo evidence.

Affected trust boundary: user account/private AI Studio context -> shared OpenAI provider state under ShortPulse's server API key.

Launch impact: A `previous_response_id` is a provider-side conversation-memory handle. Before this fix, the browser could send `conversationState.previousResponseId`, and the Standard runtime forwarded it as `previous_response_id` while also using `store: true`. Because the provider key is shared server authority, ShortPulse had no server-side user/session ownership proof before reusing the handle.

Root cause:

- `frontend/features/agent-runtime/studioAgentRouteEnvelope.ts` accepted Standard `conversationState.previousResponseId` from the request body.
- `frontend/features/agent-runtime/standardStudioAgentRuntime/runtime.ts` sent Standard Responses requests with provider storage enabled.
- The old Standard runtime also compacted replay based on the untrusted provider handle instead of always sending the server-visible transcript.

Why this fix was worth doing now: this is a real launch-readiness trust-boundary issue. It is not general hardening; it prevents a client-held provider memory handle from becoming a cross-session/cross-user context lever.

Canonical fix:

- Strip all client-supplied `conversationState` at the route envelope.
- Run Standard Responses transport statelessly with `store: false`.
- Do not return provider response IDs to the client.
- Remove the Standard compact-replay path that depended on client-held provider state.
- Update the Standard Responses flag documentation so future launch work does not revive the old trust model by accident.

## Other Audited Prompt-Authority Surfaces

No additional high/critical issue was confirmed in this lane:

- Standard runtime rejects Pulse payloads, inbound canonical prompts, Pulse session namespaces, and unsupported direct OpenAI bypass controls.
- Request message parsing allows only `user` and `assistant` roles.
- Pulse runtime rejects Standard payloads, retired preset IDs, preset/session mismatches, and inbound canonical prompts.
- Built-in Pulse instructions are overwritten from the server-side runtime catalog before execution; client spoofing of built-in instructions is not trusted.
- Image-derived text is sanitized and labeled as untrusted before being merged into prompt context.
- Runtime agent prompt and Pulse built-in admin routes require `requireAdminUser`.
- Agent safety policy version/activate/rollback routes require `requireAdminUser`, validate profile IDs, and block `dev_absolute_zero` in production.

## Validation

Passed:

```bash
npm -C frontend test -- --run tests/api/studio-agent.runtime.test.ts features/agent-runtime/__tests__/studioAgentRouteEnvelope.test.ts features/agent-runtime/__tests__/studioAgentOpenAiGateway.test.ts
```

Result: 3 files, 59 tests passed.

Also run:

```bash
npm -C frontend test -- --run features/agent-runtime/__tests__/studioAgentRequestGuards.test.ts features/agent-runtime/__tests__/studioAgentPulseRuntime.test.ts features/agent-runtime/__tests__/studioAgentUntrustedContent.test.ts features/agent-runtime/__tests__/studioAgentVisionSummaries.test.ts features/ai-agent/logic/__tests__/studioAgentOrchestration.test.ts features/ai-agent/logic/__tests__/studioAgentThinkerFormatter.test.ts tests/api/admin-agent-instructions-standard-system-prompt.test.ts tests/api/admin-agent-instructions-style-extract-prompt.test.ts tests/api/admin-agent-instructions-edit-system-presets.test.ts tests/api/admin-agent-instructions-pulse-builtins.test.ts tests/api/admin-agent-safety-policy-active.test.ts tests/api/admin-agent-safety-policy-version.test.ts tests/api/admin-agent-safety-policy-activate.test.ts tests/api/admin-agent-safety-policy-rollback.test.ts lib/server/api/__tests__/agentSafetyPolicyControlPlane.runtimeProfile.test.ts lib/server/api/__tests__/runtimeAgentPromptControlPlane.test.ts
```

Result: 15 files passed; 1 unrelated pre-existing/model-catalog expectation failed in `features/ai-agent/logic/__tests__/studioAgentThinkerFormatter.test.ts`, where the test expected `gpt-5.4-nano` but current runtime resolved `gpt-5.5`. That is not a security boundary regression and was not changed in this lane.

## Residual Risk

- Standard Responses long-session provider-state continuity is intentionally disabled. Re-enable only after adding server-side ownership binding for provider response handles, scoped at minimum to user ID and session identity.
- This was a local-code/test audit. Hosted env values and live production behavior were not mutated.

## Deferred

- Do not pursue generic prompt-hardening or CSP-style cleanup from this lane.
- Do not fix the unrelated thinker/formatter model expectation in this security run.

## Next Highest-ROI Step

Continue account-boundary work on any remaining routes that create or spend credits, attach provider outputs, or sign private storage. Stop when the next target is only adjacency or hygiene.
