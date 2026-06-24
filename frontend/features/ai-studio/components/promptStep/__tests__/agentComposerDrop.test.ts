import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { prepareReferenceDrag } from "../../../utils/dragDrop";
import {
  resolveAgentComposerDrop,
  resolveAgentComposerPanelDropKind,
  resolveAgentComposerTextDropInsertion,
  resolveDroppedPromptTextEdit,
} from "../agentComposerDrop";

const emptyFileList = { length: 0, item: () => null } as unknown as FileList;

const createMutableTransfer = () => {
  const store = new Map<string, string>();
  return {
    files: emptyFileList,
    get types() {
      return Array.from(store.keys());
    },
    getData: (type: string) => store.get(type) ?? "",
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    setDragImage: vi.fn(),
    effectAllowed: "all",
  } as unknown as DataTransfer;
};

describe("agentComposerDrop", () => {
  it("classifies canvas-exported prompt drags as text drops", () => {
    const transfer = createMutableTransfer();
    transfer.setData("text/prompt", "Dragged canvas prompt");
    transfer.setData("text/plain", "Dragged canvas prompt");

    expect(resolveAgentComposerPanelDropKind(transfer)).toBe("text");
    expect(resolveAgentComposerDrop(transfer)).toEqual({
      droppedPromptText: "Dragged canvas prompt",
      droppedImageUrl: null,
      isVideoReference: false,
    });
  });

  it("classifies canvas-exported media drags as media drops", () => {
    const transfer = createMutableTransfer();
    const currentTarget = document.createElement("article");
    const image = document.createElement("img");
    image.className = "reference-card-image";
    image.setAttribute("src", "https://cdn.shortpulse.test/canvas-export.png");
    currentTarget.appendChild(image);

    prepareReferenceDrag(
      {
        currentTarget,
        dataTransfer: transfer,
      } as unknown as React.DragEvent<HTMLElement>,
      {
        id: "output-image-export-1",
        prompt: "Canvas export image",
        previewText: "Canvas export image",
        mode: "image",
        aspect: "16:9",
        model: "Test model",
        status: "ready",
        timestamp: "now",
        taskState: "success",
        mediaSource: "generated",
        previewUrl: "https://cdn.shortpulse.test/canvas-export.png",
        resultUrls: ["https://cdn.shortpulse.test/canvas-export.png"],
        savedMediaIds: ["saved-media-image-export-1"],
      } as never,
      {
        dragImage: currentTarget,
        sourceSurface: "all-refs",
      }
    );

    expect(resolveAgentComposerPanelDropKind(transfer)).toBe("media");
    expect(resolveAgentComposerDrop(transfer)).toEqual({
      droppedPromptText: null,
      droppedImageUrl: "https://cdn.shortpulse.test/canvas-export.png",
      isVideoReference: false,
    });
  });

  it("classifies internal prompt-reference drags as text drops for the open Create zone", () => {
    const transfer = createMutableTransfer();
    const currentTarget = document.createElement("article");

    prepareReferenceDrag(
      {
        currentTarget,
        dataTransfer: transfer,
      } as unknown as React.DragEvent<HTMLElement>,
      {
        id: "output-prompt-export-1",
        prompt: "Prompt-only reference text",
        previewText: "Prompt-only reference text",
        mode: "text",
        aspect: "1:1",
        model: "Test model",
        status: "ready",
        timestamp: "now",
      } as never,
      {
        dragImage: currentTarget,
        sourceSurface: "all-refs",
      }
    );

    expect(resolveAgentComposerPanelDropKind(transfer)).toBe("text");
    expect(resolveAgentComposerDrop(transfer)).toEqual({
      droppedPromptText: "Prompt-only reference text",
      droppedImageUrl: null,
      isVideoReference: false,
    });
  });

  it("replaces composer text by default for dropped prompt text", () => {
    expect(
      resolveDroppedPromptTextEdit({
        composerText: "Existing draft",
        droppedPromptText: " Dropped prompt ",
        selectionStart: 4,
        selectionEnd: 4,
        editMode: "replace",
      })
    ).toEqual({
      prompt: "Dropped prompt",
      caret: "Dropped prompt".length,
    });
  });

  it("inserts dropped prompt text at the current selection in insert mode", () => {
    expect(
      resolveDroppedPromptTextEdit({
        composerText: "Existing draft",
        droppedPromptText: " dropped ",
        selectionStart: 8,
        selectionEnd: 8,
        editMode: "insert",
      })
    ).toEqual({
      prompt: "Existingdropped draft",
      caret: "Existingdropped".length,
    });
  });

  it("uses replacement mode for composer text drops unless insert mode is requested", () => {
    const transfer = createMutableTransfer();
    transfer.setData("text/prompt", "Dropped composer prompt");
    transfer.setData("text/plain", "Dropped composer prompt");

    expect(
      resolveAgentComposerTextDropInsertion({
        transfer,
        composerText: "Existing draft",
        selectionStart: 8,
        selectionEnd: 8,
        editMode: "replace",
      })
    ).toEqual({
      prompt: "Dropped composer prompt",
      caret: "Dropped composer prompt".length,
    });
    expect(
      resolveAgentComposerTextDropInsertion({
        transfer,
        composerText: "Existing draft",
        selectionStart: 8,
        selectionEnd: 8,
        editMode: "insert",
      })
    ).toEqual({
      prompt: "ExistingDropped composer prompt draft",
      caret: "ExistingDropped composer prompt".length,
    });
  });
});
