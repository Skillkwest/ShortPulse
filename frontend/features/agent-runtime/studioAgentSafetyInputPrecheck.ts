/**
 * Input safety precheck that can rewrite or refuse provider-bound text before execution.
 */
import type { AgentContext, AgentMessage } from "../../prefabs/agent";
import type {
  SafetyEnvironment,
  SafetyModality,
  SafetyPolicyDocumentV2,
} from "./safetyPolicy/types";
import {
  DEFAULT_SAFETY_REWRITE_RECHECK_MODE,
  shouldBlockAfterRewrite,
  type SafetyRewriteRecheckMode,
} from "./safetyPolicy/rewriteRecheckPolicy";
import {
  evaluateStudioAgentSafetyText,
  rewriteStudioAgentSafetyTextDeterministic,
  type StudioAgentSafetyDecisionMeta,
} from "./safetyPolicy/textSafetyEvaluator";

export type StudioAgentSafetyInputPrecheckOutcome = "pass" | "rewritten" | "refusal";

export type StudioAgentSafetyInputPrecheckField =
  | "latest_user_turn"
  | "history_user_turn"
  | "active_prompt"
  | "last_assistant_message"
  | "reference_prompt_snippet"
  | "reference_caption"
  | "canonical_prompt";

export type StudioAgentSafetyInputPrecheckFieldMode = "enforce" | "rewrite_only" | "shadow" | "off";

const DEFAULT_SAFETY_INPUT_PRECHECK_FIELD_MODES: Record<
  StudioAgentSafetyInputPrecheckField,
  StudioAgentSafetyInputPrecheckFieldMode
> = {
  latest_user_turn: "enforce",
  history_user_turn: "rewrite_only",
  active_prompt: "rewrite_only",
  last_assistant_message: "rewrite_only",
  reference_prompt_snippet: "rewrite_only",
  reference_caption: "rewrite_only",
  canonical_prompt: "enforce",
};

const PRECHECK_FIELD_NAMES: StudioAgentSafetyInputPrecheckField[] = [
  "latest_user_turn",
  "history_user_turn",
  "active_prompt",
  "last_assistant_message",
  "reference_prompt_snippet",
  "reference_caption",
  "canonical_prompt",
];

const PRECHECK_FIELD_MODES = new Set<StudioAgentSafetyInputPrecheckFieldMode>([
  "enforce",
  "rewrite_only",
  "shadow",
  "off",
]);

export type StudioAgentSafetyInputPrecheckResult<TContext extends AgentContext = AgentContext> = {
  outcome: StudioAgentSafetyInputPrecheckOutcome;
  messages: AgentMessage[];
  context: TContext;
  canonicalPrompt: string | null;
  rewrittenFieldCount: number;
  providerCallSkipped: boolean;
  decision?: StudioAgentSafetyDecisionMeta;
  scopeTelemetry: {
    refusalField: StudioAgentSafetyInputPrecheckField | null;
    rewrittenFields: StudioAgentSafetyInputPrecheckField[];
    nonBlockingSignalCount: number;
    fieldModes: Record<
      StudioAgentSafetyInputPrecheckField,
      StudioAgentSafetyInputPrecheckFieldMode
    >;
  };
};

type MutablePrecheckState = {
  rewrittenFieldCount: number;
  outcome: StudioAgentSafetyInputPrecheckOutcome;
  dominantDecision?: StudioAgentSafetyDecisionMeta;
  refusalField: StudioAgentSafetyInputPrecheckField | null;
  rewrittenFieldNames: Set<StudioAgentSafetyInputPrecheckField>;
  nonBlockingSignalCount: number;
};

const ACTION_PRIORITY: Record<StudioAgentSafetyDecisionMeta["action"], number> = {
  allow: 0,
  rewrite: 1,
  refuse: 2,
};

const mergeDominantDecision = (
  current: StudioAgentSafetyDecisionMeta | undefined,
  next: StudioAgentSafetyDecisionMeta
): StudioAgentSafetyDecisionMeta => {
  if (!current) return next;
  const currentPriority = ACTION_PRIORITY[current.action];
  const nextPriority = ACTION_PRIORITY[next.action];
  if (nextPriority > currentPriority) return next;
  if (nextPriority < currentPriority) return current;
  if (next.source === "hard_floor" && current.source !== "hard_floor") return next;
  if (next.source === "absolute_zero" && current.source === "profile") return next;
  return current;
};

const cloneContext = <TContext extends AgentContext>(context: TContext): TContext =>
  ({
    ...context,
    references: Array.isArray(context.references)
      ? context.references.map((reference) => ({ ...reference }))
      : context.references,
  }) as TContext;

const parseFieldModes = (
  rawValue?: string | null
): Partial<
  Record<StudioAgentSafetyInputPrecheckField, StudioAgentSafetyInputPrecheckFieldMode>
> => {
  if (typeof rawValue !== "string") return {};
  const normalized = rawValue.trim();
  if (!normalized.length) return {};
  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const next: Partial<
      Record<StudioAgentSafetyInputPrecheckField, StudioAgentSafetyInputPrecheckFieldMode>
    > = {};
    for (const fieldName of PRECHECK_FIELD_NAMES) {
      const modeCandidate = record[fieldName];
      if (typeof modeCandidate !== "string") continue;
      const normalizedMode = modeCandidate.trim().toLowerCase();
      if (!PRECHECK_FIELD_MODES.has(normalizedMode as StudioAgentSafetyInputPrecheckFieldMode)) {
        continue;
      }
      next[fieldName] = normalizedMode as StudioAgentSafetyInputPrecheckFieldMode;
    }
    return next;
  } catch {
    return {};
  }
};

/**
 * Resolves precheck field modes from shared and route-scoped JSON env overrides.
 */
export const resolveStudioAgentSafetyInputPrecheckFieldModes = ({
  sharedRawValue,
  scopedRawValue,
}: {
  sharedRawValue?: string | null;
  scopedRawValue?: string | null;
}): Partial<
  Record<StudioAgentSafetyInputPrecheckField, StudioAgentSafetyInputPrecheckFieldMode>
> => ({
  ...parseFieldModes(sharedRawValue),
  ...parseFieldModes(scopedRawValue),
});

const buildScopeTelemetry = ({
  state,
  fieldModes,
}: {
  state: MutablePrecheckState;
  fieldModes: Record<StudioAgentSafetyInputPrecheckField, StudioAgentSafetyInputPrecheckFieldMode>;
}) => ({
  refusalField: state.refusalField,
  rewrittenFields: Array.from(state.rewrittenFieldNames),
  nonBlockingSignalCount: state.nonBlockingSignalCount,
  fieldModes,
});

const evaluateInputField = ({
  value,
  field,
  mode,
  modality,
  profileId,
  environment,
  devAbsoluteZeroEnabled,
  policyDocument,
  rewriteRecheckMode,
  state,
}: {
  value: string;
  field: StudioAgentSafetyInputPrecheckField;
  mode: StudioAgentSafetyInputPrecheckFieldMode;
  modality: SafetyModality;
  profileId?: string | null;
  environment: SafetyEnvironment;
  devAbsoluteZeroEnabled: boolean;
  policyDocument?: SafetyPolicyDocumentV2 | null;
  rewriteRecheckMode: SafetyRewriteRecheckMode;
  state: MutablePrecheckState;
}): { ok: true; value: string } | { ok: false } => {
  if (mode === "off") {
    return { ok: true, value };
  }

  const initial = evaluateStudioAgentSafetyText({
    text: value,
    modality,
    profileId,
    environment,
    devAbsoluteZeroEnabled,
    policyDocument,
  });
  const isEnforcedLane = mode === "enforce";
  if (isEnforcedLane) {
    state.dominantDecision = mergeDominantDecision(state.dominantDecision, initial.decision);
  }
  if (initial.decision.action === "allow") {
    return { ok: true, value };
  }
  if (isEnforcedLane && initial.decision.action === "refuse") {
    state.outcome = "refusal";
    state.refusalField = field;
    return { ok: false };
  }
  if (mode === "shadow") {
    state.nonBlockingSignalCount += 1;
    return { ok: true, value };
  }

  const rewritten = rewriteStudioAgentSafetyTextDeterministic(initial.normalizedText);
  const rewrittenEvaluation = evaluateStudioAgentSafetyText({
    text: rewritten,
    modality,
    profileId,
    environment,
    devAbsoluteZeroEnabled,
    policyDocument,
  });
  if (isEnforcedLane) {
    state.dominantDecision = mergeDominantDecision(
      state.dominantDecision,
      rewrittenEvaluation.decision
    );
  }
  if (
    isEnforcedLane &&
    shouldBlockAfterRewrite({
      mode: rewriteRecheckMode,
      action: rewrittenEvaluation.decision.action,
      category: rewrittenEvaluation.decision.category,
    })
  ) {
    state.outcome = "refusal";
    state.refusalField = field;
    return { ok: false };
  }
  state.nonBlockingSignalCount += 1;
  if (rewritten !== value) {
    state.rewrittenFieldCount += 1;
    state.outcome = "rewritten";
    state.rewrittenFieldNames.add(field);
  }
  return { ok: true, value: rewritten };
};

export const runStudioAgentSafetyInputPrecheck = <TContext extends AgentContext>({
  enabled,
  messages,
  context,
  canonicalPrompt,
  modality,
  profileId,
  environment,
  devAbsoluteZeroEnabled = false,
  policyDocument,
  rewriteRecheckMode = DEFAULT_SAFETY_REWRITE_RECHECK_MODE,
  fieldModes,
}: {
  enabled: boolean;
  messages: AgentMessage[];
  context: TContext;
  canonicalPrompt: string | null;
  modality: SafetyModality;
  profileId?: string | null;
  environment: SafetyEnvironment;
  devAbsoluteZeroEnabled?: boolean;
  policyDocument?: SafetyPolicyDocumentV2 | null;
  rewriteRecheckMode?: SafetyRewriteRecheckMode;
  fieldModes?: Partial<
    Record<StudioAgentSafetyInputPrecheckField, StudioAgentSafetyInputPrecheckFieldMode>
  >;
}): StudioAgentSafetyInputPrecheckResult<TContext> => {
  const resolvedFieldModes: Record<
    StudioAgentSafetyInputPrecheckField,
    StudioAgentSafetyInputPrecheckFieldMode
  > = {
    ...DEFAULT_SAFETY_INPUT_PRECHECK_FIELD_MODES,
    ...(fieldModes ?? {}),
  };

  if (!enabled) {
    const disabledState: MutablePrecheckState = {
      rewrittenFieldCount: 0,
      outcome: "pass",
      dominantDecision: undefined,
      refusalField: null,
      rewrittenFieldNames: new Set<StudioAgentSafetyInputPrecheckField>(),
      nonBlockingSignalCount: 0,
    };
    return {
      outcome: "pass",
      messages,
      context,
      canonicalPrompt,
      rewrittenFieldCount: 0,
      providerCallSkipped: false,
      scopeTelemetry: buildScopeTelemetry({
        state: disabledState,
        fieldModes: resolvedFieldModes,
      }),
    };
  }

  const nextMessages = messages.map((message) => ({ ...message }));
  const nextContext = cloneContext(context);
  let nextCanonicalPrompt = canonicalPrompt;
  const state: MutablePrecheckState = {
    rewrittenFieldCount: 0,
    outcome: "pass",
    dominantDecision: undefined,
    refusalField: null,
    rewrittenFieldNames: new Set<StudioAgentSafetyInputPrecheckField>(),
    nonBlockingSignalCount: 0,
  };

  let latestUserMessageIndex = -1;
  for (let index = 0; index < nextMessages.length; index += 1) {
    if (nextMessages[index]?.role === "user") latestUserMessageIndex = index;
  }

  for (let index = 0; index < nextMessages.length; index += 1) {
    const message = nextMessages[index];
    if (!message || message.role !== "user") continue;
    const field: StudioAgentSafetyInputPrecheckField =
      index === latestUserMessageIndex ? "latest_user_turn" : "history_user_turn";
    const checked = evaluateInputField({
      value: message.content,
      field,
      mode: resolvedFieldModes[field],
      modality,
      profileId,
      environment,
      devAbsoluteZeroEnabled,
      policyDocument,
      rewriteRecheckMode,
      state,
    });
    if (!checked.ok) {
      return {
        outcome: "refusal",
        messages: nextMessages,
        context: nextContext,
        canonicalPrompt: nextCanonicalPrompt,
        rewrittenFieldCount: state.rewrittenFieldCount,
        providerCallSkipped: true,
        decision: state.dominantDecision,
        scopeTelemetry: buildScopeTelemetry({
          state,
          fieldModes: resolvedFieldModes,
        }),
      };
    }
    message.content = checked.value;
  }

  if (typeof nextContext.activePrompt === "string" && nextContext.activePrompt.trim().length) {
    const checked = evaluateInputField({
      value: nextContext.activePrompt,
      field: "active_prompt",
      mode: resolvedFieldModes.active_prompt,
      modality,
      profileId,
      environment,
      devAbsoluteZeroEnabled,
      policyDocument,
      rewriteRecheckMode,
      state,
    });
    if (!checked.ok) {
      return {
        outcome: "refusal",
        messages: nextMessages,
        context: nextContext,
        canonicalPrompt: nextCanonicalPrompt,
        rewrittenFieldCount: state.rewrittenFieldCount,
        providerCallSkipped: true,
        decision: state.dominantDecision,
        scopeTelemetry: buildScopeTelemetry({
          state,
          fieldModes: resolvedFieldModes,
        }),
      };
    }
    nextContext.activePrompt = checked.value;
  }

  if (
    typeof nextContext.lastAssistantMessage === "string" &&
    nextContext.lastAssistantMessage.trim().length
  ) {
    const checked = evaluateInputField({
      value: nextContext.lastAssistantMessage,
      field: "last_assistant_message",
      mode: resolvedFieldModes.last_assistant_message,
      modality,
      profileId,
      environment,
      devAbsoluteZeroEnabled,
      policyDocument,
      rewriteRecheckMode,
      state,
    });
    if (!checked.ok) {
      return {
        outcome: "refusal",
        messages: nextMessages,
        context: nextContext,
        canonicalPrompt: nextCanonicalPrompt,
        rewrittenFieldCount: state.rewrittenFieldCount,
        providerCallSkipped: true,
        decision: state.dominantDecision,
        scopeTelemetry: buildScopeTelemetry({
          state,
          fieldModes: resolvedFieldModes,
        }),
      };
    }
    nextContext.lastAssistantMessage = checked.value;
  }

  if (Array.isArray(nextContext.references)) {
    for (const reference of nextContext.references) {
      if (typeof reference.promptSnippet === "string" && reference.promptSnippet.trim().length) {
        const checked = evaluateInputField({
          value: reference.promptSnippet,
          field: "reference_prompt_snippet",
          mode: resolvedFieldModes.reference_prompt_snippet,
          modality,
          profileId,
          environment,
          devAbsoluteZeroEnabled,
          policyDocument,
          rewriteRecheckMode,
          state,
        });
        if (!checked.ok) {
          return {
            outcome: "refusal",
            messages: nextMessages,
            context: nextContext,
            canonicalPrompt: nextCanonicalPrompt,
            rewrittenFieldCount: state.rewrittenFieldCount,
            providerCallSkipped: true,
            decision: state.dominantDecision,
            scopeTelemetry: buildScopeTelemetry({
              state,
              fieldModes: resolvedFieldModes,
            }),
          };
        }
        reference.promptSnippet = checked.value;
      }
      if (typeof reference.caption === "string" && reference.caption.trim().length) {
        const checked = evaluateInputField({
          value: reference.caption,
          field: "reference_caption",
          mode: resolvedFieldModes.reference_caption,
          modality,
          profileId,
          environment,
          devAbsoluteZeroEnabled,
          policyDocument,
          rewriteRecheckMode,
          state,
        });
        if (!checked.ok) {
          return {
            outcome: "refusal",
            messages: nextMessages,
            context: nextContext,
            canonicalPrompt: nextCanonicalPrompt,
            rewrittenFieldCount: state.rewrittenFieldCount,
            providerCallSkipped: true,
            decision: state.dominantDecision,
            scopeTelemetry: buildScopeTelemetry({
              state,
              fieldModes: resolvedFieldModes,
            }),
          };
        }
        reference.caption = checked.value;
      }
    }
  }

  if (typeof nextCanonicalPrompt === "string" && nextCanonicalPrompt.trim().length) {
    const checked = evaluateInputField({
      value: nextCanonicalPrompt,
      field: "canonical_prompt",
      mode: resolvedFieldModes.canonical_prompt,
      modality,
      profileId,
      environment,
      devAbsoluteZeroEnabled,
      policyDocument,
      rewriteRecheckMode,
      state,
    });
    if (!checked.ok) {
      return {
        outcome: "refusal",
        messages: nextMessages,
        context: nextContext,
        canonicalPrompt: nextCanonicalPrompt,
        rewrittenFieldCount: state.rewrittenFieldCount,
        providerCallSkipped: true,
        decision: state.dominantDecision,
        scopeTelemetry: buildScopeTelemetry({
          state,
          fieldModes: resolvedFieldModes,
        }),
      };
    }
    nextCanonicalPrompt = checked.value;
  }

  return {
    outcome: state.outcome,
    messages: nextMessages,
    context: nextContext,
    canonicalPrompt: nextCanonicalPrompt,
    rewrittenFieldCount: state.rewrittenFieldCount,
    providerCallSkipped: false,
    decision: state.dominantDecision,
    scopeTelemetry: buildScopeTelemetry({
      state,
      fieldModes: resolvedFieldModes,
    }),
  };
};
