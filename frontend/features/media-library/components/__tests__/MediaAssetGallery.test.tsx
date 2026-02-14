import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { MediaAssetGallery } from "../MediaAssetGallery";

type MediaRow = {
  id: string;
  filename: string;
  file_type: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

describe("MediaAssetGallery", () => {
  it("wires card, file actions, and load-more interactions", () => {
    const file: MediaRow = {
      id: "file-1",
      filename: "first.png",
      file_type: "image/png",
      signedUrl: "https://signed/first.png",
      status: "ready",
    };
    const toggleSelect = vi.fn();
    const openModal = vi.fn();
    const downloadFile = vi.fn(async () => {});
    const requestDeleteFile = vi.fn();
    const fetchMediaTabPage = vi.fn(async () => {});

    render(
      <MediaAssetGallery
        activeMediaQuery="cat"
        activeMediaTab="uploaded_images"
        aspectMap={{}}
        downloadFile={downloadFile}
        fetchMediaTabPage={fetchMediaTabPage}
        files={[file]}
        getMediaCardRef={() => () => {}}
        handleImageLoad={vi.fn()}
        handleMediaPreviewError={vi.fn()}
        handleVideoMeta={vi.fn()}
        hasMoreMediaPages
        isVideoFile={(fileType) => fileType.startsWith("video/")}
        loadMoreSentinelRef={createRef<HTMLDivElement>()}
        loadingMoreMedia={false}
        openModal={openModal}
        requestDeleteFile={requestDeleteFile}
        selectedIds={[]}
        toggleSelect={toggleSelect}
      />
    );

    const mediaImage = screen.getByAltText("first.png");
    const mediaCard = mediaImage.closest(".media-card");
    expect(mediaCard).not.toBeNull();
    if (mediaCard) {
      fireEvent.click(mediaCard);
      fireEvent.doubleClick(mediaCard);
    }
    expect(toggleSelect).toHaveBeenCalledWith(file);
    expect(openModal).toHaveBeenCalledWith(file);

    fireEvent.click(screen.getByRole("button", { name: "Download file: first.png" }));
    expect(downloadFile).toHaveBeenCalledWith(file);

    fireEvent.click(screen.getByRole("button", { name: "Delete file: first.png" }));
    expect(requestDeleteFile).toHaveBeenCalledWith(file);

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(fetchMediaTabPage).toHaveBeenCalledWith("uploaded_images", { query: "cat" });
  });
});
