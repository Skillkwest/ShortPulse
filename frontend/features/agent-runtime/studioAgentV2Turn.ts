import type {
  AgentContext,
  AgentMessage,
  AgentReferenceSummary,
  AgentResponse,
} from "../../prefabs/agent";
import {
  isExplicitEditRequest,
  preservesContext,
  shouldRetryExplicitNoOp,
} from "../ai-agent/logic/studioAgentCanonical";
import {
  runThinkerFormatterTurn,
  type ThinkerFormatterTurnResult,
} from "../ai-agent/logic/studioAgentThinkerFormatter";
import {
  isStudioAgentRefusalResponse,
  parseStudioAgentJson,
} from "./studioAgentResponseNormalization";
import { buildStudioAgentPulseSystemMessage } from "./studioAgentPulseRuntime";
import { labelUntrustedImageObservation } from "./studioAgentUntrustedContent";

type StageMarker = (stage: string, startedAt: number) => void;

type StudioAgentV2TurnFailure = {
  ok: false;
  status: number;
  stage: string;
  detail: string;
};

type StudioAgentV2TurnSuccess = {
  ok: true;
  result: {
    parsed: AgentResponse;
    nextCanonical: string | null;
    usage: AgentResponse["usage"];
    semanticStatus: string | null;
    retryUsed: boolean;
    repairUsed: boolean;
    repairCount: number;
  };
};

export type StudioAgentV2TurnResult = StudioAgentV2TurnFailure | StudioAgentV2TurnSuccess;

const buildThinkerMessages = (
  payload: unknown,
  prompt: string,
  pulseSystemMessage?: string | null
) => [
  { role: "system", content: prompt },
  ...(pulseSystemMessage ? [{ role: "system" as const, content: pulseSystemMessage }] : []),
  { role: "user", content: JSON.stringify(payload) },
];

const buildFormatterMessages = (semantic: unknown, prompt: string) => [
  { role: "system", content: prompt },
  { role: "user", content: JSON.stringify(semantic) },
];

const toFailure = (
  result: Exclude<ThinkerFormatterTurnResult, { ok: true }>
): StudioAgentV2TurnFailure => ({
  ok: false,
  status: result.status,
  stage: result.stage,
  detail: result.detail,
});

export const executeStudioAgentV2Turn = async ({
  apiKey,
  openAiUrl,
  thinkerModel,
  formatterModel,
  thinkerPrompt,
  formatterPrompt,
  timeoutMs,
  orchestration,
  context,
  messages,
  selectedReferences,
  visionSummaryMap,
  effectiveCanonical,
  markStage,
}: {
  apiKey: string;
  openAiUrl: string;
  thinkerModel: string;
  formatterModel: string;
  thinkerPrompt: string;
  formatterPrompt: string;
  timeoutMs: number;
  orchestration: {
    flow: string;
    contextType?: string | null;
    textInput?: string | null;
    imageReferenceIds?: string[];
  };
  context: AgentContext;
  messages: AgentMessage[];
  selectedReferences: AgentReferenceSummary[];
  visionSummaryMap: Map<string, string>;
  effectiveCanonical: string | null;
  markStage: StageMarker;
}): Promise<StudioAgentV2TurnResult> => {
  const userInput = messages[messages.length - 1]?.content ?? "";
  const imageSummaries = selectedReferences
    .filter((reference) => reference.kind === "image")
    .map((reference) => {
      const rawSummary =
        visionSummaryMap.get(reference.id) ??
        reference.caption ??
        reference.promptSnippet ??
        undefined;
      const labeledSummary = labelUntrustedImageObservation(rawSummary);
      return {
        id: reference.id,
        summary: labeledSummary ?? undefined,
      };
    })
    .filter((entry) => typeof entry.summary === "string" && entry.summary.trim().length > 0);
  const pulseSystemMessage = buildStudioAgentPulseSystemMessage(context.pulse);

  const thinkerPayload = {
    input_flow: orchestration.flow,
    orchestration,
    context_type: orchestration.contextType,
    canonical_prompt: effectiveCanonical,
    user_input: userInput,
    text_agent_input: orchestration.textInput,
    edit_instructions:
      effectiveCanonical && userInput.trim().length
        ? `Edit the canonical prompt in place.\nCanonical prompt:\n${effectiveCanonical}\n\nUser change:\n${userInput}`
        : null,
    context_payload:
      orchestration.flow === "TEXT_ONLY"
        ? orchestration.textInput ||
          context.activePrompt ||
          context.references?.[0]?.promptSnippet ||
          ""
        : orchestration.flow === "IMAGE_ONLY"
          ? {
              image_summaries: imageSummaries,
            }
          : {
              text_seed: orchestration.textInput,
              image_summaries: imageSummaries,
              image_refs: orchestration.imageReferenceIds,
            },
    selected_reference_ids: context.selectedReferenceIds ?? [],
    selected_references: selectedReferences,
    focused_source: context.focusedSource ?? null,
    focused_reference_id: context.focusedReferenceId ?? null,
    mode_hint: context.modeHint ?? null,
    active_pulse: context.pulse ?? null,
  };

  const v2StartedAt = Date.now();
  const firstPass = await runThinkerFormatterTurn({
    apiKey,
    openAiUrl,
    thinkerModel,
    formatterModel,
    thinkerMessages: buildThinkerMessages(thinkerPayload, thinkerPrompt, pulseSystemMessage),
    buildFormatterMessages: (semantic) => buildFormatterMessages(semantic, formatterPrompt),
    parseAgentJson: parseStudioAgentJson,
    timeoutMs,
  });
  markStage("v2_turn", v2StartedAt);

  if (!firstPass.ok) {
    return toFailure(firstPass);
  }

  let parsed = firstPass.result.parsed;
  let nextCanonical = firstPass.result.nextCanonical ?? effectiveCanonical ?? null;
  let usage = firstPass.result.usage;
  let semanticStatus = firstPass.result.semanticStatus;
  const explicitEditRequest = isExplicitEditRequest(userInput);
  const bypassDriftGuard = explicitEditRequest;
  let retryUsed = false;
  let repairCount = firstPass.result.repairUsed ? 1 : 0;

  if (
    shouldRetryExplicitNoOp({
      userInput,
      effectiveCanonical,
      nextCanonical,
    })
  ) {
    retryUsed = true;
    const retryStartedAt = Date.now();
    const retryPass = await runThinkerFormatterTurn({
      apiKey,
      openAiUrl,
      thinkerModel,
      formatterModel,
      thinkerMessages: buildThinkerMessages(
        {
          ...thinkerPayload,
          retry_instruction:
            "Your previous draft did not apply the explicit user edit. Re-apply the user change to the canonical prompt now and return the full updated prompt.",
        },
        thinkerPrompt,
        pulseSystemMessage
      ),
      buildFormatterMessages: (semantic) => buildFormatterMessages(semantic, formatterPrompt),
      parseAgentJson: parseStudioAgentJson,
      timeoutMs,
    });
    markStage("v2_retry_turn", retryStartedAt);
    if (retryPass.ok) {
      parsed = retryPass.result.parsed;
      nextCanonical = retryPass.result.nextCanonical ?? nextCanonical;
      usage = retryPass.result.usage;
      semanticStatus = retryPass.result.semanticStatus;
      repairCount += retryPass.result.repairUsed ? 1 : 0;
    }
  }

  const preResolutionRefusal = isStudioAgentRefusalResponse({
    status: semanticStatus,
    response: parsed,
  });

  if (!preResolutionRefusal && effectiveCanonical && nextCanonical && !bypassDriftGuard) {
    if (!preservesContext(effectiveCanonical, nextCanonical)) {
      console.warn("[studio-agent] drift detected; restoring canonical prompt");
      parsed.actions = parsed.actions ?? {};
      parsed.actions.applyPrompt = effectiveCanonical;
      nextCanonical = effectiveCanonical;
    }
  }

  return {
    ok: true,
    result: {
      parsed,
      nextCanonical,
      usage,
      semanticStatus,
      retryUsed,
      repairUsed: repairCount > 0,
      repairCount,
    },
  };
};
