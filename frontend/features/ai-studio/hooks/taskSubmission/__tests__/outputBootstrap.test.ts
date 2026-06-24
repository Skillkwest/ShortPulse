/**
 * Unit coverage for pending output metadata bootstrap helpers.
 * Locks workflow reload payload construction that sits between submit preflight and persistence.
 */
import { describe, expect, it } from "vitest";

import { registerInternalMediaRefForUrl } from "../../../logic/referenceInputInternalMediaRegistry";
import {
  buildSubmissionWorkflowReloadSnapshot,
  reconcileExpertEditWorkflowReloadReferences,
} from "../outputBootstrap";

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

  it("reconciles local restore-only Expert Edit slots after preflight preparation", () => {
    const providerRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user-1/reference/primary.png",
    };
    const canvasRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user-1/reference/canvas-layer.png",
    };
    const restoreRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user-1/reference/secondary.png",
    };
    const expertEditReferences = reconcileExpertEditWorkflowReloadReferences({
      expertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        restorePrimaryCanvasSlots: [{ slotIndex: 0, sourceUrl: "blob:primary-canvas-layer" }],
        secondarySlots: [],
        restoreSecondarySlots: [{ slotIndex: 2, sourceUrl: "blob:secondary-local" }],
      },
      preparedReferenceInputs: [
        {
          originalUrl: "blob:primary-local",
          preparedUrl: "https://signed.example.com/primary.png",
          internalMediaRef: providerRef,
        },
      ],
      preparedRestoreOnlyReferenceInputs: [
        {
          originalUrl: "blob:primary-canvas-layer",
          preparedUrl: "https://signed.example.com/canvas-layer.png",
          internalMediaRef: canvasRef,
        },
        {
          originalUrl: "blob:secondary-local",
          preparedUrl: "https://signed.example.com/secondary.png",
          internalMediaRef: restoreRef,
        },
      ],
    });

    const workflowReload = buildSubmissionWorkflowReloadSnapshot({
      outputMode: "image",
      originTool: "edit",
      panelKind: "edit",
      projectId: "project-1",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      displayPrompt: "Refine the pose.",
      submissionPrompt: "Refine the pose.",
      aspect: "1:1",
      imageResolution: null,
      referenceInputs: ["https://signed.example.com/primary.png"],
      internalMediaRefs: [providerRef],
      expertEditReferences,
      videoReferenceMode: "standard",
      durationSeconds: null,
    });

    expect(workflowReload?.payload).toEqual(
      expect.objectContaining({
        kind: "image",
        referenceInputs: ["https://signed.example.com/primary.png"],
        expertEditReferences: {
          version: 1,
          maxSecondarySlotCount: 10,
          primaryReferenceInputIndex: 0,
          restorePrimaryCanvasSlots: [
            {
              slotIndex: 0,
              sourceUrl: "https://signed.example.com/canvas-layer.png",
              internalMediaRef: canvasRef,
            },
          ],
          secondarySlots: [],
          restoreSecondarySlots: [
            {
              slotIndex: 2,
              sourceUrl: "https://signed.example.com/secondary.png",
              internalMediaRef: restoreRef,
            },
          ],
        },
      })
    );
  });

  it("carries video reference sidecar metadata into workflow reload payloads", () => {
    const firstFrameRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/first-frame.png",
    };
    const lastFrameRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/last-frame.png",
    };
    const seedImageRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/seed-image.png",
    };
    const elementRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/element-profile.png",
    };
    const elementAudioRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/element-audio.mp3",
    };
    registerInternalMediaRefForUrl("https://example.com/video-seed-image.png", seedImageRef);
    registerInternalMediaRefForUrl("https://example.com/element-profile.png", elementRef);
    registerInternalMediaRefForUrl("https://example.com/element-audio.mp3", elementAudioRef);

    const workflowReload = buildSubmissionWorkflowReloadSnapshot({
      outputMode: "video",
      originTool: "video",
      panelKind: "video",
      projectId: "project-1",
      modelId: "fal-ai/bytedance/seedance/v2/text-to-video",
      displayPrompt: "A locked-off shot with restored refs.",
      submissionPrompt: "A locked-off shot with restored refs.",
      aspect: "16:9",
      imageResolution: null,
      referenceInputs: [
        "https://example.com/video-first-frame.png",
        "https://example.com/video-last-frame.png",
      ],
      internalMediaRefs: [firstFrameRef, lastFrameRef],
      videoReferenceMode: "keyframes",
      durationSeconds: 5,
      resolution: "720p",
      generateAudio: false,
      cameraFixed: true,
      autoFix: false,
      styleContext: {
        applied: true,
        styleId: "noir",
        styleName: "Noir",
        stylePrompt: "deep contrast and hard rim light",
      },
      seedance2InputMode: "multimodal",
      seedance2ReferenceImageUrls: ["https://example.com/video-seed-image.png"],
      seedance2ReferenceVideoUrls: ["https://example.com/video-seed-video.mp4"],
      seedance2ReferenceAudioUrls: ["https://example.com/video-seed-audio.mp3"],
      klingElements: [
        {
          id: "element-1",
          profileImageUrl: "https://example.com/element-profile.png",
          audioUrl: "https://example.com/element-audio.mp3",
        },
      ],
    });

    expect(workflowReload?.payload).toEqual(
      expect.objectContaining({
        kind: "video",
        styleContext: {
          applied: true,
          styleId: "noir",
          styleName: "Noir",
          stylePrompt: "deep contrast and hard rim light",
        },
        referenceInputs: [
          "https://example.com/video-first-frame.png",
          "https://example.com/video-last-frame.png",
        ],
        videoReferences: {
          version: 1,
          firstFrame: {
            sourceUrl: "https://example.com/video-first-frame.png",
            internalMediaRef: firstFrameRef,
          },
          lastFrame: {
            sourceUrl: "https://example.com/video-last-frame.png",
            internalMediaRef: lastFrameRef,
          },
          seedance2ReferenceImages: [
            {
              slotIndex: 0,
              sourceUrl: "https://example.com/video-seed-image.png",
              internalMediaRef: seedImageRef,
            },
          ],
          seedance2ReferenceVideos: [
            { slotIndex: 0, sourceUrl: "https://example.com/video-seed-video.mp4" },
          ],
          seedance2ReferenceAudio: [
            { slotIndex: 0, sourceUrl: "https://example.com/video-seed-audio.mp3" },
          ],
          klingElementSlots: [
            {
              slotIndex: 0,
              element: {
                id: "element-1",
                profileImageUrl: "https://example.com/element-profile.png",
                audioUrl: "https://example.com/element-audio.mp3",
                slotIndex: 0,
              },
              profileImageInternalMediaRef: elementRef,
              audioInternalMediaRef: elementAudioRef,
            },
          ],
        },
      })
    );
  });
});
