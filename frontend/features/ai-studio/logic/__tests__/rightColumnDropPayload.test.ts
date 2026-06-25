/**
 * Characterization tests for AI Studio right-column drop payload resolution.
 * Guards shell DnD behavior while the parser lives outside the page component.
 */
import { describe, expect, it } from "vitest";
import {
  resolveRightColumnDropMode,
  resolveRightColumnDropPayload,
} from "../rightColumnDropPayload";

const emptyFileList = { length: 0, item: () => null } as unknown as FileList;

const makeTransfer = (
  data: Record<string, string>,
  files: FileList = emptyFileList
): DataTransfer =>
  ({
    files,
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? "",
  }) as unknown as DataTransfer;

const makeFileList = (files: File[]): FileList => {
  const fileList = files as unknown as FileList;
  Object.defineProperty(fileList, "length", { value: files.length });
  Object.defineProperty(fileList, "item", {
    value: (index: number) => files[index] ?? null,
  });
  return fileList;
};

describe("rightColumnDropPayload", () => {
  it("resolves media URL hints as media drops", () => {
    const transfer = makeTransfer({
      "text/uri-list": "https://cdn.example.com/reference.png",
    });

    expect(resolveRightColumnDropMode(transfer)).toBe("media");
    expect(resolveRightColumnDropPayload(transfer)).toEqual({
      kind: "media",
      reference: {
        url: "https://cdn.example.com/reference.png",
        mimeType: "image/*",
      },
    });
  });

  it("resolves plain prompt text without treating the current page URL as media", () => {
    const transfer = makeTransfer({
      "text/uri-list": window.location.href,
      "text/plain": "cinematic lighting prompt",
    });

    expect(resolveRightColumnDropMode(transfer)).toBe("media");
    expect(resolveRightColumnDropPayload(transfer)).toEqual({
      kind: "text",
      text: "cinematic lighting prompt",
    });
  });

  it("resolves file drops as file payloads", () => {
    const files = makeFileList([new File(["avatar"], "avatar.png", { type: "image/png" })]);
    const transfer = makeTransfer({ Files: "" }, files);

    expect(resolveRightColumnDropMode(transfer)).toBe("media");
    const payload = resolveRightColumnDropPayload(transfer);
    expect(payload.kind).toBe("files");
    if (payload.kind === "files") {
      expect(payload.files.length).toBe(1);
      expect((payload.files as unknown as File[])[0]?.name).toBe("avatar.png");
    }
  });
});
