/**
 * Unit coverage for reference-grid clipboard controller helpers.
 * Verifies URL parsing, media-file normalization, and paste-surface targeting behavior.
 */
import { describe, expect, it } from "vitest";
import {
  collectClipboardMediaFiles,
  extractDroppedPromptText,
  getMediaReferenceFromHtml,
  getMediaReferenceFromUriList,
  getReferencePasteSurfaces,
  inferClipboardMimeTypeFromUrl,
  isEditableElement,
  isMediaUrl,
  isNodeInsideAnySurface,
  normalizeClipboardText,
  parseUrlCandidate,
} from "../referenceGridClipboard";

const createTransfer = (values: Record<string, string>): DataTransfer =>
  ({
    getData: (type: string) => values[type] ?? "",
    files: [],
    items: [],
    types: Object.keys(values),
  }) as unknown as DataTransfer;

describe("referenceGridClipboard", () => {
  it("parses valid URL candidates and rejects non-http protocols", () => {
    expect(parseUrlCandidate(" https://example.com/a.png ")).toBe("https://example.com/a.png");
    expect(parseUrlCandidate("javascript:alert('x')")).toBeNull();
    expect(parseUrlCandidate(window.location.href)).toBeNull();
  });

  it("extracts dropped prompt text while excluding media URLs", () => {
    const promptTransfer = createTransfer({
      "text/prompt": " cinematic mountain vista prompt ",
    });
    const mediaTransfer = createTransfer({
      "text/plain": "https://cdn.example.com/shot.png",
    });

    expect(extractDroppedPromptText(promptTransfer)).toBe("cinematic mountain vista prompt");
    expect(extractDroppedPromptText(mediaTransfer)).toBeNull();
  });

  it("collects deduped clipboard media files with normalized mime type", () => {
    const duplicatedFile = new File(["abc"], "reference.png", { type: "" });
    const transfer = {
      files: [duplicatedFile, duplicatedFile],
      items: [
        { kind: "file", type: "image/png", getAsFile: () => duplicatedFile },
        { kind: "file", type: "image/png", getAsFile: () => duplicatedFile },
      ],
      getData: () => "",
    } as unknown as DataTransfer;

    const files = collectClipboardMediaFiles(transfer);
    expect(files).toHaveLength(1);
    expect(files[0]?.type).toBe("image/png");
    expect(files[0]?.name).toBe("reference.png");
  });

  it("resolves media URL references from uri-list and html payloads", () => {
    const uriListReference = getMediaReferenceFromUriList(
      ["# comment", "https://cdn.example.com/media/asset.mp4"].join("\n")
    );
    const htmlReference = getMediaReferenceFromHtml(
      '<div><img src="https://cdn.example.com/images/frame.jpg" /></div>'
    );

    expect(uriListReference).toMatchObject({
      url: "https://cdn.example.com/media/asset.mp4",
      mimeType: "video/*",
    });
    expect(htmlReference).toMatchObject({
      url: "https://cdn.example.com/images/frame.jpg",
      mimeType: "image/*",
    });
  });

  it("tracks paste surfaces and editable-target detection", () => {
    const shell = document.createElement("section");
    shell.className = "ai-shell-right";
    const column = document.createElement("section");
    column.className = "reference-column";
    const panel = document.createElement("div");
    const editable = document.createElement("textarea");
    const contentNode = document.createElement("div");

    panel.appendChild(contentNode);
    column.appendChild(panel);
    shell.appendChild(column);
    document.body.appendChild(shell);

    const surfaces = getReferencePasteSurfaces(panel);
    expect(surfaces).toHaveLength(3);
    expect(isNodeInsideAnySurface(contentNode, surfaces)).toBe(true);
    expect(isEditableElement(editable)).toBe(true);
    expect(isEditableElement(contentNode)).toBe(false);
  });

  it("keeps media-url + mime inference behavior stable", () => {
    expect(normalizeClipboardText("  hi  ")).toBe("hi");
    expect(isMediaUrl("https://cdn.example.com/image.webp")).toBe(true);
    expect(inferClipboardMimeTypeFromUrl("https://cdn.example.com/movie.webm")).toBe("video/*");
    expect(inferClipboardMimeTypeFromUrl("https://cdn.example.com/readme.txt")).toBeNull();
  });
});
