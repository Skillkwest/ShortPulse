import { describe, expect, it, vi } from "vitest";
import {
  createCanvasTearOutComposerTargetRegistry,
  type CanvasTearOutComposerTarget,
} from "../useAiStudioCanvasTearOutTargets";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";

const textPayload: AgentComposerDirectDropPayload = {
  kind: "text",
  text: "Prompt text",
};

const unsupportedPayload: AgentComposerDirectDropPayload = {
  kind: "unsupported",
  mediaKind: "video",
};

const createElementWithRect = (rect: Partial<DOMRect>) => {
  const element = {
    getBoundingClientRect: vi.fn(() => ({
      left: rect.left ?? 0,
      top: rect.top ?? 0,
      right: rect.right ?? 100,
      bottom: rect.bottom ?? 100,
      width: rect.width ?? 100,
      height: rect.height ?? 100,
      x: rect.x ?? rect.left ?? 0,
      y: rect.y ?? rect.top ?? 0,
      toJSON: () => ({}),
    })),
  };
  return element as unknown as HTMLElement;
};

const createTarget = (
  overrides: Partial<CanvasTearOutComposerTarget> = {}
): CanvasTearOutComposerTarget => ({
  id: "target",
  element: createElementWithRect({ left: 10, top: 20, right: 110, bottom: 120 }),
  canAccept: (payload) => payload.kind !== "unsupported",
  accept: vi.fn(),
  setActive: vi.fn(),
  ...overrides,
});

describe("createCanvasTearOutComposerTargetRegistry", () => {
  it("resolves an accepting target by pointer position", () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const target = createTarget();

    registry.registerTarget(target);

    const resolved = registry.resolveTargetAtPoint({ clientX: 50, clientY: 60 }, textPayload);

    expect(resolved?.id).toBe("target");
    expect(resolved?.target).toBe(target);
  });

  it("does not resolve unsupported payloads or points outside the target", () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    registry.registerTarget(createTarget());

    expect(
      registry.resolveTargetAtPoint({ clientX: 50, clientY: 60 }, unsupportedPayload)
    ).toBeNull();
    expect(registry.resolveTargetAtPoint({ clientX: 500, clientY: 600 }, textPayload)).toBeNull();
  });

  it("uses the most recently registered matching target first", () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const firstTarget = createTarget({ id: "first", accept: vi.fn() });
    const secondTarget = createTarget({ id: "second", accept: vi.fn() });

    registry.registerTarget(firstTarget);
    registry.registerTarget(secondTarget);

    const resolved = registry.resolveTargetAtPoint({ clientX: 50, clientY: 60 }, textPayload);

    expect(resolved?.id).toBe("second");
  });

  it("toggles target active state and clears it on unregister", () => {
    const registry = createCanvasTearOutComposerTargetRegistry();
    const setActive = vi.fn();
    const target = createTarget({ setActive });
    const unregister = registry.registerTarget(target);

    registry.setActiveTarget("target");
    expect(setActive).toHaveBeenLastCalledWith(true);
    expect(registry.getActiveTargetId()).toBe("target");

    unregister();

    expect(setActive).toHaveBeenLastCalledWith(false);
    expect(registry.getActiveTargetId()).toBeNull();
  });
});
