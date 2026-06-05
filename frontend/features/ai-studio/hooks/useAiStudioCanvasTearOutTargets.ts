import { useMemo } from "react";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";

export type CanvasTearOutPoint = {
  clientX: number;
  clientY: number;
};

export type CanvasTearOutComposerTarget = {
  id: string;
  element: HTMLElement | null;
  canAccept: (payload: AgentComposerDirectDropPayload) => boolean;
  accept: (payload: AgentComposerDirectDropPayload) => void;
  setActive?: (active: boolean) => void;
};

export type CanvasTearOutResolvedComposerTarget = {
  id: string;
  target: CanvasTearOutComposerTarget;
  rect: DOMRect;
};

export type CanvasTearOutComposerTargetRegistry = {
  registerTarget: (target: CanvasTearOutComposerTarget) => () => void;
  resolveTargetAtPoint: (
    point: CanvasTearOutPoint,
    payload: AgentComposerDirectDropPayload
  ) => CanvasTearOutResolvedComposerTarget | null;
  setActiveTarget: (id: string | null) => void;
  clearActiveTarget: () => void;
  getActiveTargetId: () => string | null;
};

const isPointInsideRect = (point: CanvasTearOutPoint, rect: DOMRect) =>
  point.clientX >= rect.left &&
  point.clientX <= rect.right &&
  point.clientY >= rect.top &&
  point.clientY <= rect.bottom;

export const createCanvasTearOutComposerTargetRegistry =
  (): CanvasTearOutComposerTargetRegistry => {
    const targets = new Map<string, CanvasTearOutComposerTarget>();
    let activeTargetId: string | null = null;

    const setActiveTarget = (id: string | null) => {
      if (activeTargetId === id) return;
      if (activeTargetId) {
        targets.get(activeTargetId)?.setActive?.(false);
      }
      activeTargetId = id;
      if (activeTargetId) {
        targets.get(activeTargetId)?.setActive?.(true);
      }
    };

    return {
      registerTarget: (target) => {
        const previous = targets.get(target.id);
        if (previous && activeTargetId === target.id) {
          previous.setActive?.(false);
        }
        targets.set(target.id, target);
        if (activeTargetId === target.id) {
          target.setActive?.(true);
        }
        return () => {
          const current = targets.get(target.id);
          if (current !== target) return;
          if (activeTargetId === target.id) {
            current.setActive?.(false);
            activeTargetId = null;
          }
          targets.delete(target.id);
        };
      },
      resolveTargetAtPoint: (point, payload) => {
        const orderedTargets = Array.from(targets.values()).reverse();
        for (const target of orderedTargets) {
          if (!target.element || !target.canAccept(payload)) continue;
          const rect = target.element.getBoundingClientRect();
          if (isPointInsideRect(point, rect)) {
            return {
              id: target.id,
              target,
              rect,
            };
          }
        }
        return null;
      },
      setActiveTarget,
      clearActiveTarget: () => setActiveTarget(null),
      getActiveTargetId: () => activeTargetId,
    };
  };

export const useAiStudioCanvasTearOutTargets = () =>
  useMemo(() => createCanvasTearOutComposerTargetRegistry(), []);
