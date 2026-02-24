import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelModal } from "../ModelModal";
import type { ModelOption } from "../../constants";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...imageProps} alt={props.alt ?? ""} />;
  },
}));

const baseOptions: ModelOption[] = [
  { value: "fal/flux-2", label: "FLUX.2", mediaType: "image" },
  { value: "fal-ai/nano-banana", label: "Nano Banana", mediaType: "image" },
  {
    value: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    label: "Seedream 4.5",
    mediaType: "image",
  },
];

describe("ModelModal", () => {
  it("hides FLUX.2 and Nano Banana chips in text-image context", () => {
    render(
      <ModelModal
        isOpen
        position={null}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={baseOptions}
        context="text-image"
      />
    );

    expect(screen.queryByRole("button", { name: /FLUX\.2/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Nano Banana/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seedream 4\.5/i })).toBeInTheDocument();
  });

  it("keeps FLUX.2 and Nano Banana chips visible outside text-image context", () => {
    render(
      <ModelModal
        isOpen
        position={null}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={baseOptions}
        context="reference-image"
      />
    );

    expect(screen.getByRole("button", { name: /FLUX\.2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nano Banana/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seedream 4\.5/i })).toBeInTheDocument();
  });
});
