# ADR 0071: AI Studio Create Mode-Owned Runtime Roots

- Date: 2026-04-30
- Status: Accepted
- Deciders: Frontend Engineering
- Related:
  - `docs/adr/0061-ai-studio-standard-vs-pulse-runtime-isolation-contract.md`
  - `docs/adr/0070-project-workspace-conversational-runtime-exclusion.md`
  - `docs/sops/sop_ai_studio_create_properties_generation_wiring.md`
  - `docs/sops/sop_ai_studio_pulse_mode.md`

## Context

ADR 0061 established that Standard and Pulse must be separate Create operating modes. The remaining implementation risk was that `frontend/pages/ai-studio.tsx` still owned shared Create state above the mode boundary, so a Pulse draft, transcript, workflow session, or hidden context could still influence Standard mode through shared props, generation commands, restore payloads, or chat surfaces.

## Decision

AI Studio Create now treats the mode switch as the runtime ownership boundary:

```tsx
expertCreateMode === "pulse" ? (
  <PulseCreateRuntimeRoot />
) : (
  <StandardCreateRuntimeRoot />
);
```

After this decision, each mounted root owns its mode-specific agent runtime, composer input, prompt setter, request transport, response parser, primary submit command, and persistence payload. The page body and presenter can consume a discriminated runtime contract, but they must not instantiate both Create agent hooks or carry a mixed Standard/Pulse prop bag.

The former right-side Create `AgentChatPanel` rail is retired. Create chat remains inside the active mode-owned composer. Standard chat-mode preference is owned by the Standard runtime only. Pulse never receives that toggle or stored value.

Snapshot persistence follows the same authority:

- Standard snapshots clear Pulse prompt/runtime/workflow fields.
- Pulse snapshots require explicit Pulse workspace and preset/session authority.
- Project workspace restore excludes conversational runtime state.
- `agentRuntimes.pulsePresetId` is metadata only and cannot reactivate Pulse without workspace authority.

## Consequences

Positive:

1. Custom Pulse drafts and hidden workflow state cannot appear in Standard composer props or Standard route payloads.
2. Standard direct chat, explicit apply-to-composer, and primary generate can evolve without Pulse workflow branches.
3. Pulse artifact generation reads Pulse workflow state only and never falls back to Standard composer input.
4. Boundary tests can enforce imports and static ownership rather than relying only on runtime behavior.

Tradeoffs:

1. `frontend/pages/ai-studio.tsx` remains a large composition root while the split is stabilized.
2. Some neutral low-level helpers still use legacy names such as `setSharedPrompt`; callers must pass mode-owned setters until those APIs are renamed.
3. Legacy bridge modules remain for compatibility tests and non-active paths, but active Create routes must not import them.

## Validation

The decision is implemented correctly when:

1. `frontend/pages/ai-studio.tsx` renders exactly one Create runtime root for the current mode.
2. Active Create paths do not import `useAiStudioAgentBridge` or generic mode-switching `useAiAgent` hooks.
3. Standard route requests reject Pulse context and Pulse route requests reject Standard context.
4. Pulse route requests reject mismatched `clientSessionNamespace` preset identity.
5. Switching from Pulse back to Standard preserves Standard composer input and never shows Pulse draft input.
6. Project restore does not hydrate Pulse conversational runtime state.
