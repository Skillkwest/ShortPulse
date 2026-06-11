/**
 * Unit coverage for pending output metadata bootstrap helpers.
 * Locks workflow reload payload construction that sits between submit preflight and persistence.
 */
import { describe, expect, it } from "vitest";

import { buildSubmissionWorkflowReloadSnapshot } from "../outputBootstrap";

describe("taskSubmission outputBootstrap", () => {
  it("carries Expert Edit slot metadata into image workflow reload payloads", () => {
    const workflowReload = buildSubmissionWorkflowReloadSnapshot({
      outputMode: "image",
      originTool: "edit",
      panelKind: "edit",
      projectId: "project-1",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      displayPrompt: "Use @img10 as the wardrobe reference.",
      submissionPrompt: "Use Figure 2 as the wardrobe reference.",
      aspect: "9:16",
      imageResolution: "2K",
      referenceInputs: ["https://example.com/primary.png", "https://example.com/ref-10.png"],
      internalMediaRefs: [],
      expertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        secondarySlots: [{ slotIndex: 9, referenceInputIndex: 1 }],
      },
      videoReferenceMode: "standard",
      durationSeconds: null,
    });

    expect(workflowReload?.payload).toEqual(
      expect.objectContaining({
        kind: "image",
        submitTool: "edit",
        referenceInputs: ["https://example.com/primary.png", "https://example.com/ref-10.png"],
        expertEditReferences: {
          version: 1,
          maxSecondarySlotCount: 10,
          primaryReferenceInputIndex: 0,
          secondarySlots: [{ slotIndex: 9, referenceInputIndex: 1 }],
        },
      })
    );
  });
});
