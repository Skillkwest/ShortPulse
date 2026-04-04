/**
 * Workflow identity tests.
 * Protects canonical workflow resolution and legacy alias normalization.
 */
import { describe, expect, it } from "vitest";
import {
  isCanvasWorkflow,
  isCharacterWorkflow,
  isCreateWorkflow,
  isEditWorkflow,
  isSoundWorkflow,
  isVideoWorkflow,
  normalizeToolId,
  resolveWorkflowId,
} from "../workflowIdentity";

describe("workflowIdentity", () => {
  it("maps canonical tools and aliases to stable workflow ids", () => {
    expect(resolveWorkflowId("create")).toBe("create");
    expect(resolveWorkflowId("text")).toBe("create");
    expect(resolveWorkflowId("edit")).toBe("edit");
    expect(resolveWorkflowId("image")).toBe("edit");
    expect(resolveWorkflowId("video")).toBe("video");
    expect(resolveWorkflowId("kling")).toBe("video");
    expect(resolveWorkflowId("character")).toBe("character");
    expect(resolveWorkflowId("canvas")).toBe("canvas");
    expect(resolveWorkflowId(null)).toBe("none");
  });

  it("normalizes aliases to canonical tool ids", () => {
    expect(normalizeToolId("text")).toBe("create");
    expect(normalizeToolId("image")).toBe("edit");
    expect(normalizeToolId("kling")).toBe("video");
    expect(normalizeToolId("canvas")).toBe("canvas");
    expect(normalizeToolId(null)).toBeNull();
  });

  it("exposes workflow predicates", () => {
    expect(isCreateWorkflow("text")).toBe(true);
    expect(isEditWorkflow("image")).toBe(true);
    expect(isVideoWorkflow("kling")).toBe(true);
    expect(isCharacterWorkflow("canvas")).toBe(false);
    expect(isCanvasWorkflow("canvas")).toBe(true);
    expect(isSoundWorkflow("sound")).toBe(true);
    expect(isSoundWorkflow("music")).toBe(true);
    expect(isSoundWorkflow("create")).toBe(false);
  });
});
