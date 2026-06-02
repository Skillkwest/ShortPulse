/**
 * Project workspace quick-slot diagnostics tests.
 * Verifies restore telemetry counts summarize quick slots and canvas media authority.
 */
import { describe, expect, it } from "vitest";
import { buildProjectWorkspaceQuickSlotDiagnostics } from "../projectWorkspaceQuickSlotDiagnostics";
import { serializeAiStudioSessionCanvasState } from "../sessionSnapshotCanvas";

describe("buildProjectWorkspaceQuickSlotDiagnostics", () => {
  it("summarizes quick-slot and canvas media authority without media URLs", () => {
    const diagnostics = buildProjectWorkspaceQuickSlotDiagnostics({
      outputs: {
        active: [
          {
            id: "out-library-1",
            mediaSource: "library",
            savedMediaIds: ["media-1"],
          },
        ],
        archived: [],
        curatedReferenceIds: ["out-library-1", "out-missing-1"],
        removedFromAllRefsIds: [],
      },
      canvas: serializeAiStudioSessionCanvasState({
        items: [
          {
            id: "canvas-image-1",
            kind: "image",
            x: 10,
            y: 20,
            z: 1,
            selected: false,
            outputId: "out-library-1",
            sourceSurface: "curated",
            mediaId: "media-1",
            src: "https://signed.shortpulse.test/image.png",
            alt: "Image",
            width: 320,
            height: 180,
          },
          {
            id: "canvas-image-2",
            kind: "image",
            x: 40,
            y: 50,
            z: 2,
            selected: false,
            outputId: null,
            sourceSurface: null,
            mediaId: null,
            src: "https://external.example.com/image.png",
            alt: "External",
            width: 320,
            height: 180,
          },
        ],
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: { x: 0, y: 0, zoom: 1 },
        railCamera: { x: 0, y: 0, zoom: 1 },
      }),
    });

    expect(diagnostics).toEqual(
      expect.objectContaining({
        active_count: 1,
        quick_slot_count: 2,
        quick_slot_missing_count: 1,
        quick_slot_library_count: 1,
        quick_slot_saved_media_count: 1,
        canvas_item_count: 2,
        canvas_media_item_count: 2,
        canvas_media_id_count: 1,
        canvas_output_id_count: 1,
        canvas_missing_media_authority_count: 1,
        canvas_url_count: 2,
      })
    );
  });
});
