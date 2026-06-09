import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelModal } from "../ModelModal";
import type { ModelOption } from "../../constants";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_NANO_BANANA_2_EDIT_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
  FAL_NANO_BANANA_PRO_MODEL_ID,
  FAL_SEEDREAM_45_EDIT_MODEL_ID,
  FAL_SEEDREAM_45_TEXT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
} from "../../../../lib/model-runtime/falModelIds";
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import {
  resolveRequiredCreateCharacterModeStartupModelId,
  resolveRequiredCreateStartupModelId,
} from "../../../../lib/model-runtime/modelCatalog";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../lib/model-runtime/openAiImage2";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imageProps} alt={props.alt ?? ""} />;
  },
}));

const baseOptions: ModelOption[] = [
  { value: FAL_FLUX_2_KLEIN_9B_MODEL_ID, label: "FLUX.2 Lite", mediaType: "image" },
  { value: FAL_NANO_BANANA_2_MODEL_ID, label: "Nano Banana 2", mediaType: "image" },
  {
    value: FAL_SEEDREAM_45_TEXT_MODEL_ID,
    label: "Seedream 4.5",
    mediaType: "image",
  },
];

const readChipTitles = (_container: HTMLElement): string[] => {
  void _container;
  return Array.from(document.body.querySelectorAll(".model-chip-title"))
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean);
};

const readFamilyColumns = (): { family: string; chips: string[] }[] =>
  Array.from(document.body.querySelectorAll(".model-family-column")).map((column) => ({
    family: column.querySelector(".model-family-title")?.textContent?.trim() ?? "",
    chips: Array.from(column.querySelectorAll(".model-chip-title"))
      .map((element) => element.textContent?.trim() ?? "")
      .filter(Boolean),
  }));

describe("ModelModal", () => {
  it("does not close when search text selection overextends to the backdrop", () => {
    const onClose = vi.fn();
    render(<ModelModal isOpen onClose={onClose} onSelect={vi.fn()} options={baseOptions} />);

    const searchInput = screen.getByPlaceholderText("Search models");
    const backdrop = document.querySelector(".model-modal-backdrop");
    expect(backdrop).not.toBeNull();

    fireEvent.pointerDown(searchInput, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(backdrop as Element, { button: 0, pointerId: 1 });
    fireEvent.click(backdrop as Element);

    expect(onClose).not.toHaveBeenCalled();
  });

  it("keeps supported text-image alternatives visible in text-image context", () => {
    render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={baseOptions}
        context="text-image"
      />
    );

    expect(screen.getByRole("button", { name: /FLUX\.2 Lite/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nano Banana 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seedream 4\.5/i })).toBeInTheDocument();
  });

  it("hides all Fal Veo 3.1 chips even when passed explicitly", () => {
    const options: ModelOption[] = [
      {
        value: "fal-ai/veo3.1",
        label: "Google Veo 3.1",
        mediaType: "video",
      },
      {
        value: "fal-ai/veo3.1/image-to-video",
        label: "Google Veo 3.1",
        mediaType: "image-to-video",
      },
      {
        value: "fal-ai/veo3.1/first-last-frame-to-video",
        label: "Google Veo 3.1 (First/Last Frame)",
        mediaType: "keyframes",
      },
      {
        value: "fal-ai/kling-video/v3/pro/image-to-video",
        label: "Kling 3.0 (Fal)",
        mediaType: "image-to-video",
      },
    ];

    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="reference-video"
      />
    );

    expect(readChipTitles(container)).toEqual([]);
    expect(screen.queryByRole("button", { name: "Google Veo 3.1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Google Veo 3.1" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Google Veo 3.1 (First/Last Frame)" })
    ).not.toBeInTheDocument();
  });

  it("hides disabled non-Kie Fal video chips even when passed explicitly", () => {
    const options: ModelOption[] = [
      {
        value: "fal-ai/kling-video/v3/pro/text-to-video",
        label: "Kling 3.0 (Fal)",
        mediaType: "video",
      },
      {
        value: "kie-ai/veo-3.1-fast-i2v",
        label: "Veo 3.1 Fast",
        mediaType: "image-to-video",
      },
    ];

    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="text-video"
      />
    );

    expect(readChipTitles(container)).toEqual(["Veo 3.1 Fast"]);
    expect(screen.queryByRole("button", { name: "Kling 3.0 (Fal)" })).not.toBeInTheDocument();
  });

  it("uses a constant video title and keeps Kling manually selectable in text-video context", () => {
    const options: ModelOption[] = [
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast",
        mediaType: "image-to-video",
      },
      {
        value: KIE_KLING_30_MODEL_ID,
        label: "Kling 3.0",
        mediaType: "image-to-video",
      },
      { value: KIE_SEEDANCE_2_MODEL_ID, label: "Seedance 2.0", mediaType: "image-to-video" },
    ];

    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="text-video"
      />
    );

    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.queryByText("Text-to-Video")).not.toBeInTheDocument();
    expect(readChipTitles(container)).toEqual(["Veo 3.1 Fast", "Kling 3.0", "Seedance 2.0"]);
    expect(readFamilyColumns()).toEqual([
      { family: "Veo", chips: ["Veo 3.1 Fast"] },
      { family: "Kling", chips: ["Kling 3.0"] },
      { family: "Seedance", chips: ["Seedance 2.0"] },
    ]);
    expect(screen.getByRole("button", { name: /Kling 3\.0/i })).toBeInTheDocument();
  });

  it("includes Seedance 2.x chips when passed explicitly", () => {
    const options: ModelOption[] = [
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast",
        mediaType: "image-to-video",
      },
      {
        value: KIE_SEEDANCE_2_MODEL_ID,
        label: "Seedance 2.0",
        mediaType: "image-to-video",
      },
      {
        value: KIE_SEEDANCE_2_FAST_MODEL_ID,
        label: "Seedance 2.0 Fast",
        mediaType: "image-to-video",
      },
    ];

    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="text-video"
      />
    );

    expect(readChipTitles(container)).toEqual([
      "Veo 3.1 Fast",
      "Seedance 2.0",
      "Seedance 2.0 Fast",
    ]);
    expect(screen.getAllByRole("button", { name: /Seedance 2\.0/i })).toHaveLength(2);
  });

  it("keeps the full text-video ordering contract including Seedance 2 Fast", () => {
    const options: ModelOption[] = [
      {
        value: KIE_SEEDANCE_2_FAST_MODEL_ID,
        label: "Seedance 2.0 Fast",
        mediaType: "image-to-video",
      },
      {
        value: KIE_KLING_30_MODEL_ID,
        label: "Kling 3.0",
        mediaType: "image-to-video",
      },
      {
        value: KIE_SEEDANCE_2_MODEL_ID,
        label: "Seedance 2.0",
        mediaType: "image-to-video",
      },
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast",
        mediaType: "image-to-video",
      },
    ];

    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="text-video"
      />
    );

    expect(readChipTitles(container)).toEqual([
      "Veo 3.1 Fast",
      "Kling 3.0",
      "Seedance 2.0",
      "Seedance 2.0 Fast",
    ]);
    expect(readFamilyColumns()).toEqual([
      { family: "Veo", chips: ["Veo 3.1 Fast"] },
      { family: "Kling", chips: ["Kling 3.0"] },
      {
        family: "Seedance",
        chips: ["Seedance 2.0", "Seedance 2.0 Fast"],
      },
    ]);
  });

  it("groups text-image chips into family columns by workflow priority", () => {
    const options: ModelOption[] = [
      { value: FAL_NANO_BANANA_PRO_MODEL_ID, label: "Nano Banana Pro", mediaType: "image" },
      { value: OPENAI_GPT_IMAGE_2_MODEL_ID, label: "GPT Image 2 Fast", mediaType: "image" },
      {
        value: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
        label: "GPT Image 2 (Kie)",
        mediaType: "image",
      },
      {
        value: FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
        label: "Seedream 5 Lite",
        mediaType: "image",
      },
      { value: FAL_FLUX_2_KLEIN_9B_MODEL_ID, label: "FLUX.2 Lite", mediaType: "image" },
      { value: FAL_NANO_BANANA_2_MODEL_ID, label: "Nano Banana 2", mediaType: "image" },
      {
        value: FAL_SEEDREAM_45_TEXT_MODEL_ID,
        label: "Seedream 4.5",
        mediaType: "image",
      },
    ];
    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="text-image"
      />
    );

    expect(readChipTitles(container)).toEqual([
      "Seedream 4.5",
      "Seedream 5 Lite",
      "Nano Banana 2",
      "Nano Banana Pro",
      "GPT Image 2 Fast",
      "GPT Image 2",
      "FLUX.2 Lite",
    ]);
    expect(readFamilyColumns()).toEqual([
      { family: "Seedream", chips: ["Seedream 4.5", "Seedream 5 Lite"] },
      { family: "Nano Banana", chips: ["Nano Banana 2", "Nano Banana Pro"] },
      { family: "GPT Image", chips: ["GPT Image 2 Fast", "GPT Image 2"] },
      { family: "FLUX", chips: ["FLUX.2 Lite"] },
    ]);
  });

  it("shows the direct OpenAI text-image chip and keeps the Kie text-image chip selectable", () => {
    const onSelect = vi.fn();
    const startupModelId = resolveRequiredCreateStartupModelId();
    const options: ModelOption[] = [
      { value: FAL_NANO_BANANA_2_MODEL_ID, label: "Nano Banana 2", mediaType: "image" },
      { value: OPENAI_GPT_IMAGE_2_MODEL_ID, label: "GPT Image 2 Fast", mediaType: "image" },
      {
        value: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
        label: "GPT Image 2 (Kie)",
        mediaType: "image",
      },
      { value: startupModelId, label: "Primary Startup", mediaType: "image" },
    ];

    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={onSelect}
        options={options}
        context="text-image"
      />
    );

    expect(readChipTitles(container)).toEqual([
      "Primary Startup",
      "Nano Banana 2",
      "GPT Image 2 Fast",
      "GPT Image 2",
    ]);
    fireEvent.click(screen.getByRole("button", { name: /GPT Image 2 Fast/i }));
    expect(onSelect).toHaveBeenCalledWith(OPENAI_GPT_IMAGE_2_MODEL_ID);
    fireEvent.click(screen.getByRole("button", { name: "GPT Image 2 —" }));
    expect(onSelect).toHaveBeenCalledWith(KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID);
  });

  it("groups reference-image chips into family columns by workflow priority", () => {
    const options: ModelOption[] = [
      { value: FAL_NANO_BANANA_PRO_EDIT_MODEL_ID, label: "Nano Banana Pro", mediaType: "image" },
      { value: FAL_NANO_BANANA_2_EDIT_MODEL_ID, label: "Nano Banana 2", mediaType: "image" },
      { value: OPENAI_GPT_IMAGE_2_MODEL_ID, label: "GPT Image 2 Fast", mediaType: "image" },
      {
        value: FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
        label: "Seedream 5 Lite",
        mediaType: "image",
      },
      {
        value: FAL_SEEDREAM_45_EDIT_MODEL_ID,
        label: "Seedream 4.5",
        mediaType: "image",
      },
      {
        value: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
        label: "GPT Image 2 Edit (Kie)",
        mediaType: "image",
      },
    ];
    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="reference-image"
      />
    );

    expect(readChipTitles(container)).toEqual([
      "Seedream 4.5",
      "Seedream 5 Lite",
      "Nano Banana 2",
      "Nano Banana Pro",
      "GPT Image 2 Fast",
      "GPT Image 2",
    ]);
    expect(readFamilyColumns()).toEqual([
      { family: "Seedream", chips: ["Seedream 4.5", "Seedream 5 Lite"] },
      { family: "Nano Banana", chips: ["Nano Banana 2", "Nano Banana Pro"] },
      { family: "GPT Image", chips: ["GPT Image 2 Fast", "GPT Image 2"] },
    ]);
  });

  it("renders character-image chips with direct OpenAI and Kie GPT Image edit chips selectable", () => {
    const onSelect = vi.fn();
    const options: ModelOption[] = [
      { value: FAL_NANO_BANANA_PRO_EDIT_MODEL_ID, label: "Nano Banana Pro", mediaType: "image" },
      { value: FAL_NANO_BANANA_2_EDIT_MODEL_ID, label: "Nano Banana 2", mediaType: "image" },
      { value: OPENAI_GPT_IMAGE_2_MODEL_ID, label: "GPT Image 2 Fast", mediaType: "image" },
      {
        value: FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
        label: "Seedream 5 Lite",
        mediaType: "image",
      },
      {
        value: FAL_SEEDREAM_45_EDIT_MODEL_ID,
        label: "Seedream 4.5",
        mediaType: "image",
      },
      {
        value: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
        label: "GPT Image 2 Edit (Kie)",
        mediaType: "image",
      },
    ];

    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={onSelect}
        options={options}
        context="character-image"
      />
    );

    expect(screen.getByText("Character Mode")).toBeInTheDocument();
    expect(readChipTitles(container)).toEqual([
      "Seedream 4.5",
      "Seedream 5 Lite",
      "Nano Banana 2",
      "Nano Banana Pro",
      "GPT Image 2 Fast",
      "GPT Image 2",
    ]);
    fireEvent.click(screen.getByRole("button", { name: /GPT Image 2 Fast/i }));
    expect(onSelect).toHaveBeenCalledWith(OPENAI_GPT_IMAGE_2_MODEL_ID);
    fireEvent.click(screen.getByRole("button", { name: "GPT Image 2 —" }));
    expect(onSelect).toHaveBeenCalledWith(KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID);
    expect(readFamilyColumns()).toEqual([
      { family: "Seedream", chips: ["Seedream 4.5", "Seedream 5 Lite"] },
      { family: "Nano Banana", chips: ["Nano Banana 2", "Nano Banana Pro"] },
      { family: "GPT Image", chips: ["GPT Image 2 Fast", "GPT Image 2"] },
    ]);
  });

  it("keeps the edit startup model while showing direct OpenAI and Kie GPT Image chips", () => {
    const startupEditModelId = resolveRequiredCreateCharacterModeStartupModelId();
    const options: ModelOption[] = [
      { value: FAL_NANO_BANANA_2_EDIT_MODEL_ID, label: "Nano Banana 2", mediaType: "image" },
      { value: OPENAI_GPT_IMAGE_2_MODEL_ID, label: "GPT Image 2 Fast", mediaType: "image" },
      {
        value: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
        label: "GPT Image 2 Edit (Kie)",
        mediaType: "image",
      },
      { value: startupEditModelId, label: "Primary Edit Startup", mediaType: "image" },
    ];

    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="character-image"
      />
    );

    expect(readChipTitles(container)).toEqual([
      "Primary Edit Startup",
      "Nano Banana 2",
      "GPT Image 2 Fast",
      "GPT Image 2",
    ]);
  });

  it("groups reference-video chips into family columns by workflow priority", () => {
    const options: ModelOption[] = [
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast",
        mediaType: "image-to-video",
      },
      {
        value: KIE_KLING_30_MODEL_ID,
        label: "Kling 3.0",
        mediaType: "image-to-video",
      },
    ];
    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="reference-video"
      />
    );

    expect(readChipTitles(container)).toEqual(["Veo 3.1 Fast", "Kling 3.0"]);
    expect(readFamilyColumns()).toEqual([
      { family: "Veo", chips: ["Veo 3.1 Fast"] },
      { family: "Kling", chips: ["Kling 3.0"] },
    ]);
  });

  it("keeps Seedance after Veo and Kling in reference-video context", () => {
    const options: ModelOption[] = [
      { value: KIE_SEEDANCE_2_MODEL_ID, label: "Seedance 2.0", mediaType: "image-to-video" },
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast",
        mediaType: "image-to-video",
      },
      {
        value: KIE_KLING_30_MODEL_ID,
        label: "Kling 3.0",
        mediaType: "image-to-video",
      },
    ];

    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="reference-video"
      />
    );

    expect(readChipTitles(container)).toEqual(["Veo 3.1 Fast", "Kling 3.0", "Seedance 2.0"]);
    expect(readFamilyColumns()).toEqual([
      { family: "Veo", chips: ["Veo 3.1 Fast"] },
      { family: "Kling", chips: ["Kling 3.0"] },
      { family: "Seedance", chips: ["Seedance 2.0"] },
    ]);
  });

  it("hides Fal Veo keyframe chips and keeps Kie Veo visible", () => {
    const options: ModelOption[] = [
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast",
        mediaType: "image-to-video",
      },
      {
        value: "fal-ai/veo3.1/first-last-frame-to-video",
        label: "Google Veo 3.1 (First/Last Frame)",
        mediaType: "keyframes",
      },
    ];
    const { container } = render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={options}
        context="reference-keyframes"
      />
    );

    expect(readChipTitles(container)).toEqual(["Veo 3.1 Fast"]);
    expect(
      screen.queryByRole("button", { name: "Google Veo 3.1 (First/Last Frame)" })
    ).not.toBeInTheDocument();
  });

  it("uses settings-aware credit resolver when provided", () => {
    render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={[
          {
            value: KIE_VEO_31_FAST_I2V_MODEL_ID,
            label: "Veo 3.1 Fast",
            mediaType: "image-to-video",
          },
        ]}
        context="reference-video"
        resolveCreditsForModel={(modelId) =>
          modelId === KIE_VEO_31_FAST_I2V_MODEL_ID ? 555 : null
        }
      />
    );

    expect(screen.getByText("555")).toBeInTheDocument();
  });

  it("shows an unavailable credits state when no shared resolver is provided", () => {
    render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={[
          {
            value: KIE_VEO_31_FAST_I2V_MODEL_ID,
            label: "Veo 3.1 Fast",
            mediaType: "image-to-video",
          },
        ]}
        context="reference-video"
      />
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders tooltip provider, description, and text-image tags from shared presentation metadata", () => {
    vi.useFakeTimers();
    try {
      render(
        <ModelModal
          isOpen
          onClose={vi.fn()}
          onSelect={vi.fn()}
          options={[
            {
              value: FAL_SEEDREAM_45_TEXT_MODEL_ID,
              label: "Seedream 4.5",
              mediaType: "image",
            },
          ]}
          context="text-image"
          resolveCreditsForModel={(modelId) =>
            modelId === FAL_SEEDREAM_45_TEXT_MODEL_ID ? 321 : null
          }
        />
      );

      fireEvent.mouseEnter(screen.getByRole("button", { name: /Seedream 4\.5/i }));
      act(() => {
        vi.advanceTimersByTime(500);
      });

      const tooltip = screen.getByRole("tooltip");
      expect(tooltip).toBeInTheDocument();
      expect(within(tooltip).getByText("ByteDance")).toBeInTheDocument();
      expect(
        within(tooltip).getByText(
          /Seedream 4\.5 text-to-image supports native output plus automatic 2K and 4K upscale modes\./i
        )
      ).toBeInTheDocument();
      expect(within(tooltip).getByText("Text-to-Image")).toBeInTheDocument();
      expect(within(tooltip).getByText("Native/2K/4K")).toBeInTheDocument();
      expect(within(tooltip).getByText(/321 credits/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("injects the reference-keyframes tooltip tag without changing the visible modal ordering", () => {
    vi.useFakeTimers();
    try {
      render(
        <ModelModal
          isOpen
          onClose={vi.fn()}
          onSelect={vi.fn()}
          options={[
            {
              value: KIE_VEO_31_FAST_I2V_MODEL_ID,
              label: "Veo 3.1 Fast",
              mediaType: "image-to-video",
            },
          ]}
          context="reference-keyframes"
        />
      );

      fireEvent.mouseEnter(screen.getByRole("button", { name: /Veo 3\.1 Fast/i }));
      act(() => {
        vi.advanceTimersByTime(500);
      });

      const tooltip = screen.getByRole("tooltip");
      expect(within(tooltip).queryByText("Kie AI")).not.toBeInTheDocument();
      expect(
        within(tooltip).getByText(
          /Veo 3\.1 Fast handles text-to-video, single-image animation, and first\/last-frame transitions/i
        )
      ).toBeInTheDocument();
      expect(within(tooltip).getByText("First/Last Frame")).toBeInTheDocument();
      expect(within(tooltip).getByText("Image-to-Video")).toBeInTheDocument();
      expect(within(tooltip).getByText("Video")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps FLUX.2 and Nano Banana 2 chips visible outside text-image context", () => {
    render(<ModelModal isOpen onClose={vi.fn()} onSelect={vi.fn()} options={baseOptions} />);

    expect(screen.getByRole("button", { name: /FLUX\.2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nano Banana 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seedream 4\.5/i })).toBeInTheDocument();
  });
});
