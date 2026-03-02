/**
 * Input safety precheck that can rewrite or refuse provider-bound text before execution.
 */
import type { AgentContext, AgentMessage } from "../../prefabs/agent";
import type { SafetyEnvironment, SafetyModality } from "./safetyPolicy/types";
import {
  evaluateStudioAgentSafetyText,
  rewriteStudioAgentSafetyTextDeterministic,
  type StudioAgentSafetyDecisionMeta,
} from "./safetyPolicy/textSafetyEvaluator";

export type StudioAgentSafetyInputPrecheckOutcome = "pass" | "rewritten" | "refusal";

export type StudioAgentSafetyInputPrecheckResult<TContext extends AgentContext = AgentContext> = {
  outcome: StudioAgentSafetyInputPrecheckOutcome;
  messages: AgentMessage[];
  context: TContext;
  canonicalPrompt: string | null;
  rewrittenFieldCount: number;
  providerCallSkipped: boolean;
  decision?: StudioAgentSafetyDecisionMeta;
};

type MutablePrecheckState = {
  rewrittenFieldCount: number;
  outcome: StudioAgentSafetyInputPrecheckOutcome;
  dominantDecision?: StudioAgentSafetyDecisionMeta;
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

const evaluateInputField = ({
  value,
  modality,
  profileId,
  environment,
  devAbsoluteZeroEnabled,
  state,
}: {
  value: string;
  modality: SafetyModality;
  profileId?: string | null;
  environment: SafetyEnvironment;
  devAbsoluteZeroEnabled: boolean;
  state: MutablePrecheckState;
}): { ok: true; value: string } | { ok: false } => {
  const initial = evaluateStudioAgentSafetyText({
    text: value,
    modality,
    profileId,
    environment,
    devAbsoluteZeroEnabled,
  });
  state.dominantDecision = mergeDominantDecision(state.dominantDecision, initial.decision);
  if (initial.decision.action === "allow") {
    return { ok: true, value };
  }
  if (initial.decision.action === "refuse") {
    state.outcome = "refusal";
    return { ok: false };
  }

  const rewritten = rewriteStudioAgentSafetyTextDeterministic(initial.normalizedText);
  const rewrittenEvaluation = evaluateStudioAgentSafetyText({
    text: rewritten,
    modality,
    profileId,
    environment,
    devAbsoluteZeroEnabled,
  });
  state.dominantDecision = mergeDominantDecision(
    state.dominantDecision,
    rewrittenEvaluation.decision
  );
  if (rewrittenEvaluation.decision.action !== "allow") {
    state.outcome = "refusal";
    return { ok: false };
  }
  if (rewritten !== value) {
    state.rewrittenFieldCount += 1;
    state.outcome = "rewritten";
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
}: {
  enabled: boolean;
  messages: AgentMessage[];
  context: TContext;
  canonicalPrompt: string | null;
  modality: SafetyModality;
  profileId?: string | null;
  environment: SafetyEnvironment;
  devAbsoluteZeroEnabled?: boolean;
}): StudioAgentSafetyInputPrecheckResult<TContext> => {
  if (!enabled) {
    return {
      outcome: "pass",
      messages,
      context,
      canonicalPrompt,
      rewrittenFieldCount: 0,
      providerCallSkipped: false,
    };
  }

  const nextMessages = messages.map((message) => ({ ...message }));
  const nextContext = cloneContext(context);
  let nextCanonicalPrompt = canonicalPrompt;
  const state: MutablePrecheckState = {
    rewrittenFieldCount: 0,
    outcome: "pass",
    dominantDecision: undefined,
  };

  for (const message of nextMessages) {
    if (message.role !== "user") continue;
    const checked = evaluateInputField({
      value: message.content,
      modality,
      profileId,
      environment,
      devAbsoluteZeroEnabled,
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
      };
    }
    message.content = checked.value;
  }

  if (typeof nextContext.activePrompt === "string" && nextContext.activePrompt.trim().length) {
    const checked = evaluateInputField({
      value: nextContext.activePrompt,
      modality,
      profileId,
      environment,
      devAbsoluteZeroEnabled,
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
      modality,
      profileId,
      environment,
      devAbsoluteZeroEnabled,
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
      };
    }
    nextContext.lastAssistantMessage = checked.value;
  }

  if (Array.isArray(nextContext.references)) {
    for (const reference of nextContext.references) {
      if (typeof reference.promptSnippet === "string" && reference.promptSnippet.trim().length) {
        const checked = evaluateInputField({
          value: reference.promptSnippet,
          modality,
          profileId,
          environment,
          devAbsoluteZeroEnabled,
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
          };
        }
        reference.promptSnippet = checked.value;
      }
      if (typeof reference.caption === "string" && reference.caption.trim().length) {
        const checked = evaluateInputField({
          value: reference.caption,
          modality,
          profileId,
          environment,
          devAbsoluteZeroEnabled,
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
          };
        }
        reference.caption = checked.value;
      }
    }
  }

  if (typeof nextCanonicalPrompt === "string" && nextCanonicalPrompt.trim().length) {
    const checked = evaluateInputField({
      value: nextCanonicalPrompt,
      modality,
      profileId,
      environment,
      devAbsoluteZeroEnabled,
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
  };
};
