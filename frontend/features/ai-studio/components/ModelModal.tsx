/**
 * Anchored model picker modal.
 * Positions next to the invoking control and lists available generation models with cost badges.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass } from "phosphor-react";
import { modelLogos, modelOptions, ModelOption } from "../constants";
import { buildDefaultPricingParams, computeCostForModel } from "../logic/pricing";

type ModelModalProps = {
  isOpen: boolean;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onSelect: (value: string) => void;
  options?: ModelOption[];
};

type ModelMeta = {
  provider?: string;
  description?: string;
  logo?: string;
  tags?: string[];
  verified?: boolean;
};

const modelMeta: Record<string, ModelMeta> = {
  "fal/flux-2": {
    provider: "Flux",
    description: "Fast, balanced image generation with clean lighting and sharp detail.",
    logo: "Flux",
    tags: ["Image"],
    verified: true,
  },
  "fal/flux-2-pro": {
    provider: "Flux",
    description: "Higher fidelity Flux model with better texture and contrast control.",
    logo: "Flux",
    tags: ["Image"],
    verified: true,
  },
  "fal/flux-2-pro/edit": {
    provider: "Flux",
    description: "Flux 2 Pro image-to-image/edit with higher fidelity and relaxed safety by default.",
    logo: "Flux",
    tags: ["Image"],
    verified: true,
  },
  "fal/flux-2-max": {
    provider: "Flux",
    description: "Maximum quality Flux with enhanced realism and upscale-friendly detail.",
    logo: "Flux",
    tags: ["Image"],
    verified: true,
  },
  "fal/imagen4/preview/fast": {
    provider: "Google",
    description: "Imagen 4 Fast for crisp results with speedy turnaround.",
    logo: "G",
    tags: ["Image"],
  },
  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video": {
    provider: "Kling",
    description: "Kling 2.5 Turbo Pro image-to-video with cinematic motion detail.",
    tags: ["Video"],
  },
  "fal-ai/kling-video/v2.5-turbo/pro/text-to-video": {
    provider: "Kling",
    description: "Kling 2.5 Turbo text-to-video (defaults to 10s, $0.35 for 5s + $0.07 per extra second).",
    tags: ["Video"],
  },
  "fal-ai/kling-video/v2.6/pro/text-to-video": {
    provider: "Kling",
    description: "Kling 2.6 Pro via Fal queue with cinematic motion, native audio, and smooth camera moves.",
    tags: ["Video"],
    verified: true,
  },
  "fal-ai/sora-2/text-to-video/pro": {
    provider: "OpenAI via Fal",
    description: "Sora 2 Pro text-to-video via Fal queue with HD motion, physics, and native audio.",
    tags: ["Video"],
    verified: true,
  },
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video": {
    provider: "ByteDance",
    description: "Seedance 1.5 Pro for cinema-quality video with synchronized audio and camera control.",
    tags: ["Video"],
  },
  "fal-ai/veo3.1": {
    provider: "Google via Fal",
    description: "Veo 3.1 via Fal queue for cinematic video with strong motion coherence and audio.",
    tags: ["Video"],
    verified: true,
  },
  "fal-ai/bytedance/seedream/v4.5/text-to-image": {
    provider: "ByteDance via Fal",
    description: "Seedream 4.5 text-to-image on Fal for unified image gen/edit with rich detail.",
    tags: ["Image"],
    verified: true,
  },
  "fal-ai/nano-banana": {
    provider: "Google",
    description: "Nano Banana via Fal queue for vibrant, fast image generation.",
    tags: ["Image"],
  },
  "fal-ai/nano-banana/edit": {
    provider: "Google",
    description: "Nano Banana Edit for rapid image-to-image tweaks that keep colors vivid.",
    logo: "Google",
    tags: ["Image"],
  },
  "fal-ai/nano-banana-pro": {
    provider: "Google",
    description: "Nano Banana Pro (Nano Banana 2) via Fal queue with higher-resolution detail.",
    tags: ["Image"],
  },
  "fal-ai/nano-banana-pro/edit": {
    provider: "Google",
    description: "Nano Banana Pro Edit for precise reference-based changes with finer detail control.",
    logo: "Google",
    tags: ["Image"],
  },
};

const sectionLogos: Record<string, string> = {
  Flux: "/flux%20LOGO.png",
  Google: "/Google%20LOGO.png",
  Kling: "/Kling%20LOGO.png",
  "Kie.ai": "/Sora%202%20LOGO.png",
  ByteDance: "/Seedream%20LOGO.png",
  Seedream: "/Seedream%20LOGO.png",
  "Google via Fal": "/Google%20LOGO.png",
  "OpenAI via Fal": "/Sora%202%20LOGO.png",
  "ByteDance via Fal": "/Seedream%20LOGO.png",
  Fal: "/brand-logo.png",
};

const resolveModelLogo = (modelId: string) => {
  const explicitLogo = modelLogos[modelId];
  if (explicitLogo) {
    return explicitLogo;
  }
  const fallbackKey = modelMeta[modelId]?.logo ?? modelMeta[modelId]?.provider;
  if (!fallbackKey) {
    return undefined;
  }
  return sectionLogos[fallbackKey];
};

/**
 * Renders the floating model selection modal.
 */
export function ModelModal({ isOpen, position, onClose, onSelect, options = modelOptions }: ModelModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [recentValues, setRecentValues] = useState<string[]>([]);
  const [chipTooltip, setChipTooltip] = useState<{
    modelId: string;
    left: number;
    top: number;
    placement: "above" | "below";
    arrowOffset: number;
  } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const tooltipTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("aiStudioRecentModels");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentValues(parsed);
        }
      } catch {
        // no-op: ignore malformed storage
      }
    }
    // Reset any lingering tooltips when the modal opens.
    setChipTooltip(null);
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  }, [isOpen]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      normalizedQuery
        ? options.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
        : options,
    [normalizedQuery, options],
  );

  const optionMap = useMemo(() => new Map(filteredOptions.map((option) => [option.value, option])), [filteredOptions]);

  const fluxOrder = ["fal-ai/flux-1/schnell", "fal/flux-2", "fal/flux-2-pro", "fal/flux-2-pro/edit", "fal/flux-2-max"];
  const fluxOptions = fluxOrder
    .map((value) => filteredOptions.find((option) => option.value === value))
    .filter((item): item is ModelOption => Boolean(item));
  const googleOrder = [
    "fal/imagen4/preview/fast",
    "fal-ai/nano-banana",
    "fal-ai/nano-banana/edit",
    "fal-ai/nano-banana-pro",
    "fal-ai/nano-banana-pro/edit",
  ];
  const googleOptions = googleOrder
    .map((value) => filteredOptions.find((option) => option.value === value))
    .filter((item): item is ModelOption => Boolean(item));
  const handledValues = new Set([...fluxOrder, ...googleOrder]);
  const otherOptions = filteredOptions.filter((option) => !handledValues.has(option.value));
  const orderedOptions = [...fluxOptions, ...googleOptions, ...otherOptions];
  const recentOptions = recentValues
    .map((value) => optionMap.get(value))
    .filter((item): item is ModelOption => Boolean(item));

  const handleSelect = (value: string) => {
    setRecentValues((prev) => {
      const next = [value, ...prev.filter((item) => item !== value)].slice(0, 5);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem("aiStudioRecentModels", JSON.stringify(next));
        } catch {
          // ignore storage failures
        }
      }
      return next;
    });
    onSelect(value);
  };

  const handleChipTooltipShow = (modelId: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const modalRect = modalRef.current?.getBoundingClientRect();
    const tooltipWidth = 300;
    const estimatedHeight = 200;
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    if (!modalRect) return;

    const modalGutter = 10;
    const safeLeft = modalGutter;
    const safeRight = modalRect.width - modalGutter;

    const centerX = rect.left - modalRect.left + rect.width / 2;
    const preferredTop = rect.top - modalRect.top - estimatedHeight - 12;
    const spaceAbove = rect.top - modalRect.top;
    const spaceBelow = modalRect.bottom - rect.bottom;
    const placeBelow = false;
    const top = rect.top - modalRect.top;

    const unclampedLeft = centerX - tooltipWidth / 2;
    const left = clamp(unclampedLeft, safeLeft, safeRight - tooltipWidth);
    const arrowOffset = clamp(centerX - left, 16, tooltipWidth - 16);

    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
    }
    tooltipTimerRef.current = window.setTimeout(
      () => setChipTooltip({ modelId, left, top, placement: placeBelow ? "below" : "above", arrowOffset }),
      500,
    );
  };

  const handleChipTooltipHide = () => {
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setChipTooltip(null);
  };

  if (!isOpen) {
    return null;
  }

  const renderSection = (title: string, items: ModelOption[]) => {
    if (!items.length) return null;
    return (
      <div className="model-modal-section">
        <div className="model-modal-grid">
          {items.map((option) => {
            const logoSrc = resolveModelLogo(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className="model-chip"
                onClick={() => handleSelect(option.value)}
                onMouseEnter={handleChipTooltipShow(option.value)}
                onMouseLeave={handleChipTooltipHide}
              >
                <div className="model-chip-row">
                  <div className="model-chip-content">
                    {logoSrc ? (
                      <img className="model-chip-logo-img" src={logoSrc} alt="" aria-hidden />
                    ) : null}
                    <div className="model-chip-text">
                      <span className="model-chip-title">{option.label}</span>
                    </div>
                  </div>
                  <span className="model-chip-pill">
                    <span aria-hidden="true" className="model-chip-icon">✦</span>
                    <span className="model-chip-credits">{formatCredits(option.value)}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const formatCredits = (modelId: string) => {
    const cost = computeCostForModel(modelId, buildDefaultPricingParams(modelId));
    if (!cost?.credits) return "—";
    return `${cost.credits}`;
  };

  return (
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="model-modal"
        role="dialog"
        aria-modal="true"
        ref={modalRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="model-modal-header">
          <div className="model-modal-title-group">
            <p className="model-modal-title">Models</p>
          </div>
          <div className="model-modal-header-actions">
            <div className="model-modal-search">
              <MagnifyingGlass aria-hidden className="model-search-icon" size={14} weight="bold" />
              <input
                className="model-search-input"
                type="search"
                placeholder="Search models"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <button type="button" className="ghost-btn mini model-modal-close" onClick={onClose} aria-label="Close model picker">
              Close
            </button>
          </div>
        </div>
        {renderSection("Models", orderedOptions)}
        {chipTooltip ? (
          <div
            className={`model-chip-tooltip ${chipTooltip.placement === "below" ? "is-below" : "is-above"}`}
            style={{ top: chipTooltip.top, left: chipTooltip.left, ["--tooltip-arrow-offset" as any]: `${chipTooltip.arrowOffset}px` }}
            role="tooltip"
          >
            <div className="model-chip-tooltip-header">
              <div>
                <p className="model-chip-tooltip-title">{options.find((opt) => opt.value === chipTooltip.modelId)?.label}</p>
                {modelMeta[chipTooltip.modelId]?.provider ? (
                  <p className="model-chip-tooltip-provider">{modelMeta[chipTooltip.modelId]?.provider}</p>
                ) : null}
              </div>
            </div>
            {modelMeta[chipTooltip.modelId]?.description ? (
              <p className="model-chip-tooltip-description">{modelMeta[chipTooltip.modelId]?.description}</p>
            ) : null}
            <div className="model-chip-tooltip-meta">
              {modelMeta[chipTooltip.modelId]?.tags?.length ? (
                <div className="model-chip-tooltip-tags">
                  {modelMeta[chipTooltip.modelId]?.tags?.map((tag) => (
                    <span key={`${chipTooltip.modelId}-${tag}`} className="model-chip-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <span className="model-chip-tooltip-credits">
                <span aria-hidden="true" className="model-chip-tooltip-sparkle">✦</span> {formatCredits(chipTooltip.modelId)} credits
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
