# Next-Agent Handoff: Agent Safety Trust Boundaries

Lane id: `architecture-audit-02-agent-safety-trust-boundaries`

Status: high priority; execute in validated phases after overlap clears.

## Copy/Paste Assignment

Repair the concrete AI Studio agent safety gaps at the canonical server/runtime boundary: full-input safety inspection, real image preflight, untrusted-content role separation, controlled media transport, and recoverable Standard prompt publication. Preserve Safe Completion behavior and do not redesign Create/Pulse UX.

## Required Context

Read first:

- `AGENTS.md`
- `docs/sops/sop_ai_studio_agent.md`
- `docs/sops/sop_ai_studio_agent_safety_control_plane.md`
- `docs/sops/sop_ai_studio_agent_chat_ops.md`
- `docs/adr/0006-ai-studio-agent-api.md`
- `docs/adr/0028-agent-safety-control-plane-and-modality-profiles.md`
- `docs/adr/0099-ai-studio-create-safe-completion-contract.md`

Inspect first:

- `frontend/features/agent-runtime/safetyPolicy/`
- `frontend/features/agent-runtime/studioAgentSafetyInputPrecheck.ts`
- `frontend/features/agent-runtime/pulseStudioAgentRuntime/`
- `frontend/features/agent-runtime/studioAgentPulseRuntime.ts`
- `frontend/features/agent-runtime/studioAgentVisionSummaries.ts`
- `frontend/features/agent-runtime/standardStudioAgentRuntime/`
- `frontend/prefabs/agent/mediaUrlPolicy.ts`
- Standard prompt admin/control-plane route and migration

## Confirmed Problems

- Safety normalization truncates to 4,000 characters while an allowed field returns the original untruncated value.
- The declared `image_preflight` policy has no pre-provider runtime consumer.
- Pulse embeds user/context/reference material into system-role messages.
- Arbitrary HTTPS media URLs can be forwarded to the model provider, including bearer-style signed URLs.
- Standard prompt publication overwrites one live row without immutable versions, rollback, or a size/safety publication gate.

## Owned Write Surface

- agent runtime and safety-policy modules named above
- server agent request guards and media transport contract
- agent safety/prompt control-plane migration if required
- focused agent runtime, route, policy, and compiler tests
- safety SOP/ADR updates required by the final contract

## Avoid Surface

- generation billing, provider retry, or customer credits
- broad prompt rewriting across built-in/custom Pulses
- visible Create/Pulse redesign
- client-only safety controls
- state-changing external tools or new search capabilities

## Phased Execution

### Phase 1: hard-floor length invariant

- Either reject fields beyond the enforceable maximum or inspect the entire bounded input in chunks.
- The most restrictive chunk decides.
- Never inspect a prefix while forwarding an uninspected suffix.

### Phase 2: real image preflight

- Select the approved moderation implementation and failure mode.
- Evaluate before provider vision dispatch.
- Bind thresholds to the active policy version.
- Fail closed when the advertised production control is unavailable, unless an ADR explicitly says otherwise.

### Phase 3: trust-role separation and media transport

- Keep code/control-plane policy in system messages.
- Represent user transcript, context, references, OCR, captions, and workflow observations as untrusted user/tool/observation content.
- Accept bounded data URLs or resolve caller-owned storage server-side and re-encode bytes; do not forward arbitrary signed URLs.

### Phase 4: prompt publication safety

- Immutable versions, expected-version publication, maximum size/token limits, static invariants, audit event, preview/test, and rollback.

## Acceptance Criteria

- A prohibited suffix after 4,000 safe characters is refused or rewritten according to policy.
- Image bytes cannot reach vision before the active image-preflight decision.
- Compiler tests prove untrusted fields are absent from system-role content.
- Arbitrary HTTPS and Supabase signed URLs are rejected or normalized through owned transport.
- Safe Completion remains code-owned and refusal/error outputs remain non-actionable.
- Built-in Pulse definitions remain server-resolved.

## Validation And Proof

- Run focused safety evaluator, precheck, Standard/Pulse runtime, vision, request-guard, prompt control-plane, and safe-completion suites.
- Add adversarial long-input, role-injection, signed-URL, unavailable-moderation, and policy-version regressions.
- Run touched-file type checking and docs checks.
- Production proof requires current policy/env resolution plus non-spend hostile-input canaries; do not use customer content.

## Stop Rules

- Stop if the moderation provider/product policy is undecided.
- Stop before enabling web search or new tools.
- Do not treat regex expansion as a complete prompt-injection defense.
- Do not broaden into every model/provider safety implementation.
