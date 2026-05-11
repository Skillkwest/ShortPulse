import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
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
        label: "Google Veo 3.1 I2V",
        mediaType: "image-to-video",
      },
      {
        value: "fal-ai/veo3.1/first-last-frame-to-video",
        label: "Google Veo 3.1 (First/Last Frame)",
        mediaType: "keyframes",
      },
      {
        value: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
        label: "Seedance 1.5 Pro",
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
    expect(screen.queryByRole("button", { name: "Google Veo 3.1 I2V" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Google Veo 3.1 (First/Last Frame)" })
    ).not.toBeInTheDocument();
  });

  it("hides disabled non-Kie Fal video chips even when passed explicitly", () => {
    const options: ModelOption[] = [
      {
        value: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
        label: "Seedance 1.5 Pro",
        mediaType: "video",
      },
      {
        value: "kie-ai/veo-3.1-fast-i2v",
        label: "Veo 3.1 Fast I2V (Kie)",
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

    expect(readChipTitles(container)).toEqual(["Veo 3.1 Fast I2V (Kie)"]);
    expect(screen.queryByRole("button", { name: "Seedance 1.5 Pro" })).not.toBeInTheDocument();
  });

  it("uses a constant video title and keeps Kling manually selectable in text-video context", () => {
    const options: ModelOption[] = [
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast I2V (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_KLING_30_MODEL_ID,
        label: "Kling 3.0 (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_SEEDANCE_15_PRO_MODEL_ID,
        label: "Seedance 1.5 Pro (Kie)",
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

    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.queryByText("Text-to-Video")).not.toBeInTheDocument();
    expect(readChipTitles(container)).toEqual([
      "Veo 3.1 Fast I2V (Kie)",
      "Kling 3.0 (Kie)",
      "Seedance 1.5 Pro (Kie)",
    ]);
    expect(readFamilyColumns()).toEqual([
      { family: "Veo", chips: ["Veo 3.1 Fast I2V (Kie)"] },
      { family: "Kling", chips: ["Kling 3.0 (Kie)"] },
      { family: "Seedance", chips: ["Seedance 1.5 Pro (Kie)"] },
    ]);
    expect(screen.getByRole("button", { name: /Kling 3\.0/i })).toBeInTheDocument();
  });

  it("includes Seedance 2.x chips when passed explicitly", () => {
    const options: ModelOption[] = [
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast I2V (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_SEEDANCE_15_PRO_MODEL_ID,
        label: "Seedance 1.5 Pro (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_SEEDANCE_2_MODEL_ID,
        label: "Seedance 2.0 (Kie)",
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
      "Veo 3.1 Fast I2V (Kie)",
      "Seedance 1.5 Pro (Kie)",
      "Seedance 2.0 (Kie)",
    ]);
    expect(screen.getByRole("button", { name: /Seedance 2\.0/i })).toBeInTheDocument();
  });

  it("keeps the full text-video ordering contract including Seedance 2 Fast", () => {
    const options: ModelOption[] = [
      {
        value: KIE_SEEDANCE_2_FAST_MODEL_ID,
        label: "Seedance 2.0 Fast (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_SEEDANCE_15_PRO_MODEL_ID,
        label: "Seedance 1.5 Pro (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_KLING_30_MODEL_ID,
        label: "Kling 3.0 (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_SEEDANCE_2_MODEL_ID,
        label: "Seedance 2.0 (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast I2V (Kie)",
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
      "Veo 3.1 Fast I2V (Kie)",
      "Kling 3.0 (Kie)",
      "Seedance 1.5 Pro (Kie)",
      "Seedance 2.0 (Kie)",
      "Seedance 2.0 Fast (Kie)",
    ]);
    expect(readFamilyColumns()).toEqual([
      { family: "Veo", chips: ["Veo 3.1 Fast I2V (Kie)"] },
      { family: "Kling", chips: ["Kling 3.0 (Kie)"] },
      {
        family: "Seedance",
        chips: ["Seedance 1.5 Pro (Kie)", "Seedance 2.0 (Kie)", "Seedance 2.0 Fast (Kie)"],
      },
    ]);
  });

  it("groups text-image chips into family columns by workflow priority", () => {
    const options: ModelOption[] = [
      { value: FAL_NANO_BANANA_PRO_MODEL_ID, label: "Nano Banana Pro", mediaType: "image" },
      { value: OPENAI_GPT_IMAGE_2_MODEL_ID, label: "ChatGPT Image", mediaType: "image" },
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
      "ChatGPT Image",
      "FLUX.2 Lite",
    ]);
    expect(readFamilyColumns()).toEqual([
      { family: "Seedream", chips: ["Seedream 4.5", "Seedream 5 Lite"] },
      { family: "Nano Banana", chips: ["Nano Banana 2", "Nano Banana Pro"] },
      { family: "ChatGPT Image", chips: ["ChatGPT Image"] },
      { family: "FLUX", chips: ["FLUX.2 Lite"] },
    ]);
  });

  it("groups reference-image chips into family columns by workflow priority", () => {
    const options: ModelOption[] = [
      { value: FAL_NANO_BANANA_PRO_EDIT_MODEL_ID, label: "Nano Banana Pro", mediaType: "image" },
      { value: FAL_NANO_BANANA_2_EDIT_MODEL_ID, label: "Nano Banana 2", mediaType: "image" },
      { value: OPENAI_GPT_IMAGE_2_MODEL_ID, label: "ChatGPT Image", mediaType: "image" },
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
      "ChatGPT Image",
    ]);
    expect(readFamilyColumns()).toEqual([
      { family: "Seedream", chips: ["Seedream 4.5", "Seedream 5 Lite"] },
      { family: "Nano Banana", chips: ["Nano Banana 2", "Nano Banana Pro"] },
      { family: "ChatGPT Image", chips: ["ChatGPT Image"] },
    ]);
  });

  it("renders character-image chips with the edit-model ordering contract", () => {
    const options: ModelOption[] = [
      { value: FAL_NANO_BANANA_PRO_EDIT_MODEL_ID, label: "Nano Banana Pro", mediaType: "image" },
      { value: FAL_NANO_BANANA_2_EDIT_MODEL_ID, label: "Nano Banana 2", mediaType: "image" },
      { value: OPENAI_GPT_IMAGE_2_MODEL_ID, label: "ChatGPT Image", mediaType: "image" },
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

    expect(screen.getByText("Character Mode")).toBeInTheDocument();
    expect(readChipTitles(container)).toEqual([
      "Seedream 4.5",
      "Seedream 5 Lite",
      "Nano Banana 2",
      "Nano Banana Pro",
      "ChatGPT Image",
    ]);
    expect(readFamilyColumns()).toEqual([
      { family: "Seedream", chips: ["Seedream 4.5", "Seedream 5 Lite"] },
      { family: "Nano Banana", chips: ["Nano Banana 2", "Nano Banana Pro"] },
      { family: "ChatGPT Image", chips: ["ChatGPT Image"] },
    ]);
  });

  it("groups reference-video chips into family columns by workflow priority", () => {
    const options: ModelOption[] = [
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast I2V (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_KLING_30_MODEL_ID,
        label: "Kling 3.0 (Kie)",
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

    expect(readChipTitles(container)).toEqual(["Veo 3.1 Fast I2V (Kie)", "Kling 3.0 (Kie)"]);
    expect(readFamilyColumns()).toEqual([
      { family: "Veo", chips: ["Veo 3.1 Fast I2V (Kie)"] },
      { family: "Kling", chips: ["Kling 3.0 (Kie)"] },
    ]);
  });

  it("keeps Seedance after Veo and Kling in reference-video context", () => {
    const options: ModelOption[] = [
      {
        value: KIE_SEEDANCE_15_PRO_MODEL_ID,
        label: "Seedance 1.5 Pro (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast I2V (Kie)",
        mediaType: "image-to-video",
      },
      {
        value: KIE_KLING_30_MODEL_ID,
        label: "Kling 3.0 (Kie)",
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

    expect(readChipTitles(container)).toEqual([
      "Veo 3.1 Fast I2V (Kie)",
      "Kling 3.0 (Kie)",
      "Seedance 1.5 Pro (Kie)",
    ]);
    expect(readFamilyColumns()).toEqual([
      { family: "Veo", chips: ["Veo 3.1 Fast I2V (Kie)"] },
      { family: "Kling", chips: ["Kling 3.0 (Kie)"] },
      { family: "Seedance", chips: ["Seedance 1.5 Pro (Kie)"] },
    ]);
  });

  it("hides Fal Veo keyframe chips and keeps Kie Veo visible", () => {
    const options: ModelOption[] = [
      {
        value: KIE_VEO_31_FAST_I2V_MODEL_ID,
        label: "Veo 3.1 Fast I2V (Kie)",
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

    expect(readChipTitles(container)).toEqual(["Veo 3.1 Fast I2V (Kie)"]);
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
            label: "Veo 3.1 Fast I2V (Kie)",
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
            label: "Veo 3.1 Fast I2V (Kie)",
            mediaType: "image-to-video",
          },
        ]}
        context="reference-video"
      />
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("keeps FLUX.2 and Nano Banana 2 chips visible outside text-image context", () => {
    render(<ModelModal isOpen onClose={vi.fn()} onSelect={vi.fn()} options={baseOptions} />);

    expect(screen.getByRole("button", { name: /FLUX\.2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nano Banana 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seedream 4\.5/i })).toBeInTheDocument();
  });
});
