/**
 * Agent-output bubble linking hook.
 * Maps assistant message ids to optimistic output ids and derives thumbnail/link state.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AgentOutputBubbleMediaState } from "../../../../prefabs/agent";
import type { StudioOutput } from "../../types";

const STALE_LINK_PRUNE_AGE_MS = 5 * 60 * 1000;
export const STAGED_AGENT_OUTPUT_MESSAGE_ID = "staged-agent-output";
const EMPTY_ASSISTANT_BUBBLE_MEDIA: Record<string, AgentOutputBubbleMediaState> = {};

type LinkEntry = {
  outputId: string;
  linkedAtMs: number;
};

/**
 * Derives bubble-media state from linked outputs and registers new links after generate submits.
 */
export const useAgentOutputBubbleLinking = ({ outputs }: { outputs: StudioOutput[] }) => {
  const [outputLinksByMessageId, setOutputLinksByMessageId] = useState<Record<string, LinkEntry>>(
    {}
  );

  const registerOutputLink = useCallback(
    ({ messageId, optimisticOutputId }: { messageId: string; optimisticOutputId: string }) => {
      const normalizedMessageId = messageId.trim();
      const normalizedOutputId = optimisticOutputId.trim();
      if (!normalizedMessageId || !normalizedOutputId) return;
      setOutputLinksByMessageId((prev) => ({
        ...prev,
        [normalizedMessageId]: {
          outputId: normalizedOutputId,
          linkedAtMs: Date.now(),
        },
      }));
    },
    []
  );

  useEffect(() => {
    if (Object.keys(outputLinksByMessageId).length === 0) return;
    const pruneTimer = globalThis.setTimeout(() => {
      const nowMs = Date.now();
      const outputIds = new Set(outputs.map((output) => output.id));
      setOutputLinksByMessageId((prev) => {
        let changed = false;
        const nextEntries = Object.entries(prev).filter(([, entry]) => {
          if (outputIds.has(entry.outputId)) return true;
          if (nowMs - entry.linkedAtMs < STALE_LINK_PRUNE_AGE_MS) return true;
          changed = true;
          return false;
        });
        if (!changed) return prev;
        return Object.fromEntries(nextEntries);
      });
    }, 0);

    return () => {
      globalThis.clearTimeout(pruneTimer);
    };
  }, [outputLinksByMessageId, outputs]);

  const outputById = useMemo(() => {
    const map = new Map<string, StudioOutput>();
    outputs.forEach((output) => {
      map.set(output.id, output);
    });
    return map;
  }, [outputs]);

  const assistantBubbleMedia = useMemo<Record<string, AgentOutputBubbleMediaState>>(() => {
    const entries = Object.entries(outputLinksByMessageId);
    if (!entries.length) return EMPTY_ASSISTANT_BUBBLE_MEDIA;
    const resolved: Record<string, AgentOutputBubbleMediaState> = {};
    entries.forEach(([messageId, entry]) => {
      const output = outputById.get(entry.outputId);
      if (!output) {
        resolved[messageId] = {
          outputId: entry.outputId,
          thumbnailUrl: null,
          state: "pending",
        };
        return;
      }
      if (output.taskState === "fail") {
        resolved[messageId] = {
          outputId: entry.outputId,
          thumbnailUrl: null,
          state: "failed",
        };
        return;
      }
      const thumbnailUrl = output.previewUrl ?? output.resultUrls?.[0] ?? null;
      if (thumbnailUrl) {
        resolved[messageId] = {
          outputId: entry.outputId,
          thumbnailUrl,
          state: "ready",
        };
        return;
      }
      resolved[messageId] = {
        outputId: entry.outputId,
        thumbnailUrl: null,
        state: output.taskState === "success" ? "failed" : "pending",
      };
    });
    return resolved;
  }, [outputById, outputLinksByMessageId]);

  return {
    assistantBubbleMedia,
    registerOutputLink,
  };
};
