import { describe, expect, it, vi } from "vitest";
import { mapHookContractsToPageContentProps } from "../contracts/pageContentAdapter";

describe("mapHookContractsToPageContentProps", () => {
  it("maps hook contracts to AiStudioPageContent props without mutation", () => {
    const propertiesCreate = { id: "create" } as unknown as Record<string, unknown>;
    const propertiesImage = { id: "image" } as unknown as Record<string, unknown>;
    const propertiesEditExpert = { expertEditEligible: true } as unknown as Record<string, unknown>;
    const propertiesVideo = { id: "video" } as unknown as Record<string, unknown>;
    const referenceGridProps = { id: "grid" } as unknown as Record<string, unknown>;
    const studioPreviewProps = { id: "preview" } as unknown as Record<string, unknown>;
    const onDetailClose = vi.fn();
    const onUpdateOutputPrompt = vi.fn();
    const onDeleteOutput = vi.fn();
    const onDetailDownload = vi.fn();
    const onDetailSavePrompt = vi.fn();
    const onOpenMediaLibrary = vi.fn();

    const result = mapHookContractsToPageContentProps({
      panelProps: {
        propertiesCreate: propertiesCreate as never,
        propertiesImage: propertiesImage as never,
        propertiesEditExpert: propertiesEditExpert as never,
        propertiesVideo: propertiesVideo as never,
        propertiesText: propertiesCreate as never,
      },
      referenceGridProps: referenceGridProps as never,
      previewDetailProps: {
        studioPreviewProps: studioPreviewProps as never,
        detailModalOutput: null,
        onDetailClose,
        onUpdateOutputPrompt,
        onDeleteOutput,
        onDetailDownload,
        onDetailSavePrompt,
        onOpenMediaLibrary,
      },
    });

    expect(result.propertiesCreate).toBe(propertiesCreate);
    expect(result.propertiesText).toBe(propertiesCreate);
    expect(result.propertiesImage).toBe(propertiesImage);
    expect(result.propertiesEditExpert).toBe(propertiesEditExpert);
    expect(result.propertiesVideo).toBe(propertiesVideo);
    expect(result.referenceGridProps).toBe(referenceGridProps);
    expect(result.studioPreviewProps).toBe(studioPreviewProps);
    expect(result.detailModalOutput).toBeNull();
    expect(result.onDetailClose).toBe(onDetailClose);
    expect(result.onUpdateOutputPrompt).toBe(onUpdateOutputPrompt);
    expect(result.onDeleteOutput).toBe(onDeleteOutput);
    expect(result.onDetailDownload).toBe(onDetailDownload);
    expect(result.onDetailSavePrompt).toBe(onDetailSavePrompt);
    expect(result.onOpenMediaLibrary).toBe(onOpenMediaLibrary);
  });
});
