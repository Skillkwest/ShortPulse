/**
 * Characterization fixtures for Reference Grid -> Styles drag packets.
 * Mirrors the user-reported passing and failing source classes.
 */
type TransferMap = Record<string, string>;

const buildTransfer = ({
  files = [],
  types,
  values,
}: {
  files?: File[];
  types: string[];
  values: TransferMap;
}): DataTransfer =>
  ({
    files,
    types,
    getData: (type: string) => values[type] ?? "",
    dropEffect: "copy",
    effectAllowed: "copy",
  }) as unknown as DataTransfer;

export const passingLocalUploadStyleDropTransfer = (): DataTransfer =>
  buildTransfer({
    files: [new File(["mock-image-bytes"], "desktop-image.png", { type: "image/png" })],
    types: ["Files"],
    values: {},
  });

export const failingGeneratedInternalStyleDropTransfer = (): DataTransfer =>
  buildTransfer({
    files: [],
    types: [
      "text/reference-origin",
      "text/reference-output-id",
      "text/reference-source-surface",
      "text/reference-url",
      "text/plain",
    ],
    values: {
      "text/reference-origin": "ai-studio-reference-grid",
      "text/reference-output-id": "generated-out-1",
      "text/reference-source-surface": "all-refs",
      "text/reference-url": "https://cdn.example.com/generated-preview-stale.png",
      "text/plain": "generated prompt",
    },
  });

export const failingMediaLibraryInternalStyleDropTransfer = (): DataTransfer =>
  buildTransfer({
    files: [],
    types: [
      "text/reference-origin",
      "text/reference-output-id",
      "text/reference-media-id",
      "text/reference-source-surface",
      "text/reference-url",
      "text/plain",
    ],
    values: {
      "text/reference-origin": "ai-studio-reference-grid",
      "text/reference-output-id": "library-out-1",
      "text/reference-media-id": "media-library-1",
      "text/reference-source-surface": "all-refs",
      "text/reference-url": "https://cdn.example.com/library-preview-stale.png",
      "text/plain": "library prompt",
    },
  });
