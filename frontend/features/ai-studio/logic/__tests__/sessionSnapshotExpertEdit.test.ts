import { describe, expect, it } from "vitest";
import { buildAiStudioSessionSnapshot } from "../sessionSnapshot";
import { AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES } from "../sessionSnapshotCanvas";
import {
  parseAiStudioSessionExpertEditState,
  serializeAiStudioSessionExpertEditState,
} from "../sessionSnapshotExpertEdit";
import type { ExpertEditSessionState } from "../../components/edit/expertEditSessionState";

const createExpertEditState = (alpha: Uint8ClampedArray, width: number, height: number) =>
  ({
    version: 2,
    layers: {
      layerIdCounter: 2,
      foundationLayerId: "layer-1",
      selectedLayerIndex: 0,
      layers: [
        {
          id: "layer-1",
          name: "layer 1",
          imageUrl: "https://cdn.shortpulse.dev/base.png",
          opacity: 100,
          isAutoNamed: true,
          ownsImageUrl: false,
          transform: {
            translateXRatio: 0,
            translateYRatio: 0,
            scale: 1,
            rotationDeg: 0,
          },
        },
      ],
    },
    markup: {
      strokes: [],
    },
    inpaint: {
      snapshot: {
        layers: [
          {
            layerId: "layer-1",
            width,
            height,
            alpha,
          },
        ],
      },
    },
  }) satisfies ExpertEditSessionState;

const baseSnapshotInput = (expertEditSessionState: ExpertEditSessionState) => ({
  sessionId: "expert-edit-persistence-session",
  updatedAt: "2026-05-15T12:00:00.000Z",
  mode: "image" as const,
  selectedTool: "edit" as const,
  prompt: "Refine the portrait lighting",
  model: "fal-ai/bytedance/seedream/v4.5/image-edit",
  aspect: "9:16",
  expertCreateMode: "standard" as const,
  activePulsePresetId: null,
  pulseSessionInstanceId: null,
  referenceImageUrl: null,
  extraImageUrls: [null, null, null] as [null, null, null],
  editReferenceText: "",
  videoReferenceText: "",
  videoReferenceMode: "standard" as const,
  videoDurationSeconds: 6,
  videoResolution: "1080p",
  imageResolution: "model_default",
  videoGenerateAudio: false,
  videoCameraFixed: false,
  videoAutoFix: false,
  klingNegativePrompt: "",
  klingCfgScale: 0.5,
  klingWorkflowMode: "single" as const,
  klingShotType: "customize" as const,
  klingVoiceIds: ["", ""] as [string, string],
  klingMultiPrompts: [],
  klingElements: [],
  motionReferenceVideoUrl: null,
  outputs: [],
  archivedOutputs: [],
  activeOutputId: null,
  curatedReferenceIds: [],
  removedFromAllRefsIds: [],
  agentMessages: [],
  agentInput: "",
  latestAgentPrompt: null,
  promptOrigin: "manual" as const,
  chatModeEnabled: false,
  pulseWorkflowSession: null,
  canvasState: undefined,
  expertEditSessionState,
});

const getSnapshotBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

describe("sessionSnapshotExpertEdit", () => {
  it("roundtrips encoded inpaint masks through JSON persistence", () => {
    const alpha = new Uint8ClampedArray([0, 255, 96, 0, 12, 0, 255, 0, 0]);
    const state = createExpertEditState(alpha, 3, 3);

    const persisted = JSON.parse(JSON.stringify(serializeAiStudioSessionExpertEditState(state)));
    const restored = parseAiStudioSessionExpertEditState(persisted);

    expect(restored).not.toBeNull();
    expect(Array.from(restored?.inpaint.snapshot.layers[0]?.alpha ?? [])).toEqual(
      Array.from(alpha)
    );
  });

  it("restores legacy objectified typed-array masks from existing JSON rows", () => {
    const alpha = new Uint8ClampedArray([0, 255, 255, 0]);
    const legacySnapshot = JSON.parse(
      JSON.stringify({
        schemaVersion: 1,
        state: createExpertEditState(alpha, 2, 2),
      })
    );

    const restored = parseAiStudioSessionExpertEditState(legacySnapshot);

    expect(restored).not.toBeNull();
    expect(Array.from(restored?.inpaint.snapshot.layers[0]?.alpha ?? [])).toEqual(
      Array.from(alpha)
    );
  });

  it("keeps high-resolution sparse masks below the project autosave byte cap", () => {
    const width = 2472;
    const height = 4395;
    const alpha = new Uint8ClampedArray(width * height);
    const stripeStartX = 1208;
    const stripeWidth = 18;
    for (let y = 240; y < height - 240; y += 1) {
      const rowOffset = y * width;
      for (let x = stripeStartX; x < stripeStartX + stripeWidth; x += 1) {
        alpha[rowOffset + x] = 255;
      }
    }

    const state = createExpertEditState(alpha, width, height);
    const serialized = serializeAiStudioSessionExpertEditState(state);
    const restored = parseAiStudioSessionExpertEditState(JSON.parse(JSON.stringify(serialized)));
    const snapshot = buildAiStudioSessionSnapshot(baseSnapshotInput(state));
    const expertEditBytes = getSnapshotBytes(snapshot.expertEdit);
    const totalBytes = getSnapshotBytes(snapshot);
    const restoredAlpha = restored?.inpaint.snapshot.layers[0]?.alpha ?? new Uint8ClampedArray();
    const centerStripeIndex =
      Math.trunc(height / 2) * width + stripeStartX + Math.trunc(stripeWidth / 2);
    const edgeZeroIndex = Math.trunc(height / 2) * width + stripeStartX - 10;
    const farZeroIndex = 10 * width + 10;

    expect(snapshot.expertEdit?.schemaVersion).toBe(2);
    expect(restoredAlpha.length).toBe(alpha.length);
    expect(restoredAlpha[centerStripeIndex]).toBe(255);
    expect(restoredAlpha[edgeZeroIndex]).toBe(0);
    expect(restoredAlpha[farZeroIndex]).toBe(0);
    expect(expertEditBytes).toBeLessThan(300_000);
    expect(totalBytes).toBeLessThan(AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES);
  });

  it("uses run-length encoding for dense full-frame masks", () => {
    const width = 1024;
    const height = 1024;
    const alpha = new Uint8ClampedArray(width * height);
    alpha.fill(255);

    const serialized = serializeAiStudioSessionExpertEditState(
      createExpertEditState(alpha, width, height)
    );
    const layer = serialized.state.inpaint.snapshot.layers[0];
    const restored = parseAiStudioSessionExpertEditState(JSON.parse(JSON.stringify(serialized)));

    expect(layer && typeof layer.alpha === "object" && "encoding" in layer.alpha).toBe(true);
    expect(
      layer && typeof layer.alpha === "object" && "encoding" in layer.alpha
        ? layer.alpha.encoding
        : null
    ).toBe("rle-base64-v1");
    expect(getSnapshotBytes(serialized)).toBeLessThan(5_000);
    expect(restored?.inpaint.snapshot.layers[0]?.alpha[width * height - 1]).toBe(255);
  });
});
