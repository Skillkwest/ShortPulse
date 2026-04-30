/**
 * Anchored model picker modal.
 * Positions next to the invoking control and lists available generation models with cost badges.
 */
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass } from "phosphor-react";
import {
  FLUX_LOGO_SRC,
  GOOGLE_LOGO_SRC,
  KLING_LOGO_SRC,
  modelLogos,
  modelOptions,
  ModelOption,
  SEEDREAM_LOGO_SRC,
} from "../constants";
import { buildDefaultPricingParams, computeCostForModel, getModelConfig } from "../logic/pricing";
import { isSeedance2ModelId, isSeedance2UiEnabled } from "../logic/seedance2Availability";
import { stripEditLabel } from "../utils/modelLabels";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";
import { KIE_KLING_30_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";

export type ModelModalContext =
  | "reference-image"
  | "reference-video"
  | "reference-keyframes"
  | "text-image"
  | "text-video";

type ModelModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
  options?: ModelOption[];
  resolveCreditsForModel?: (modelId: string) => number | null;
  context?: ModelModalContext | null;
};

type ModelMeta = {
  provider?: string;
  description?: string;
  logo?: string;
  tags?: string[];
  verified?: boolean;
};

const modelMeta: Record<string, ModelMeta> = {
  "fal-ai/flux-2/klein/9b": {
    provider: "Black Forest Labs",
    description: "FLUX.2 Lite (9B) for fast text-to-image drafts across core aspect ratios.",
    logo: "Flux",
    tags: ["Image", "Text-to-Image", "9B", "Fast"],
    verified: true,
  },
  "kie-ai/veo-3.1-fast-i2v": {
    provider: "Kie AI",
    description:
      "Kie Veo 3.1 Fast handles text-to-video, single-image animation, and first/last-frame transitions at 720p or 1080p.",
    tags: [
      "Video",
      "Text-to-Video",
      "Image-to-Video",
      "First/Last Frame",
      "5-8s",
      "720p/1080p",
      "Audio",
    ],
  },
  "kie-ai/kling-3.0": {
    provider: "Kie AI",
    description:
      "Kie Kling 3.0 supports standard image-to-video and dedicated motion-control transfers.",
    tags: ["Video", "Image-to-Video", "Motion Control", "720p/1080p", "Audio"],
  },
  "kie-ai/seedance-1.5-pro": {
    provider: "Kie AI",
    description:
      "Kie Seedance 1.5 Pro supports prompt-only video, one-image animation, first/last-frame transitions, fixed lens, and optional audio.",
    tags: [
      "Video",
      "Text-to-Video",
      "Image-to-Video",
      "First/Last Frame",
      "4-12s",
      "480p-1080p",
      "Audio",
    ],
  },
  "kie-ai/seedance-2": {
    provider: "Kie AI",
    description:
      "Kie Seedance 2.0 supports prompt-only video, first-frame animation, first/last-frame transitions, and multimodal reference-to-video workflows.",
    tags: [
      "Video",
      "Text-to-Video",
      "Image-to-Video",
      "First/Last Frame",
      "Multimodal References",
      "5-10s",
      "720p/1080p",
      "Audio",
    ],
  },
  "kie-ai/seedance-2-fast": {
    provider: "Kie AI",
    description:
      "Kie Seedance 2.0 Fast supports prompt-only video, first-frame animation, first/last-frame transitions, and faster multimodal reference-to-video workflows.",
    tags: [
      "Video",
      "Text-to-Video",
      "Image-to-Video",
      "First/Last Frame",
      "Multimodal References",
      "5-10s",
      "720p/1080p",
      "Fast",
      "Audio",
    ],
  },
  "fal-ai/bytedance/seedream/v4.5/text-to-image": {
    provider: "ByteDance",
    description:
      "Seedream 4.5 text-to-image supports native output plus automatic 2K and 4K upscale modes.",
    tags: ["Image", "Text-to-Image", "Native/2K/4K"],
    verified: true,
  },
  "fal-ai/bytedance/seedream/v5/lite/text-to-image": {
    provider: "ByteDance",
    description:
      "Seedream 5 Lite text-to-image supports faster generation with automatic 2K and 3K output modes.",
    tags: ["Image", "Text-to-Image", "Auto 2K/3K", "Fast"],
    verified: true,
  },
  "fal-ai/bytedance/seedream/v4.5/edit": {
    provider: "ByteDance",
    description:
      "Seedream 4.5 Edit applies image-to-image changes with native output plus automatic 2K and 4K upscale modes.",
    tags: ["Image", "Image-to-Image", "Native/2K/4K"],
    verified: true,
  },
  "fal-ai/bytedance/seedream/v5/lite/edit": {
    provider: "ByteDance",
    description:
      "Seedream 5 Lite Edit applies fast image-to-image edits with automatic 2K and 3K output modes.",
    tags: ["Image", "Image-to-Image", "Auto 2K/3K", "Fast"],
    verified: true,
  },
  "fal-ai/nano-banana": {
    provider: "Google",
    description:
      "Nano Banana text-to-image model for fast generations across a wide aspect-ratio range.",
    tags: ["Image", "Text-to-Image", "Fast", "Wide Aspects"],
  },
  "fal-ai/nano-banana/edit": {
    provider: "Google",
    description:
      "Nano Banana Edit supports rapid image-to-image changes with flexible aspect-ratio control.",
    logo: "Google",
    tags: ["Image", "Image-to-Image", "Fast", "Wide Aspects"],
  },
  "fal-ai/nano-banana-pro": {
    provider: "Google",
    description: "Nano Banana Pro text-to-image adds selectable 1K, 2K, or 4K output.",
    tags: ["Image", "Text-to-Image", "1K-4K"],
  },
  "fal-ai/nano-banana-pro/edit": {
    provider: "Google",
    description:
      "Nano Banana Pro Edit adds image-to-image editing with selectable 1K, 2K, or 4K output.",
    logo: "Google",
    tags: ["Image", "Image-to-Image", "1K-4K"],
  },
  "fal-ai/nano-banana-2": {
    provider: "Google",
    description:
      "Nano Banana 2 text-to-image supports faster generations with selectable 0.5K, 1K, 2K, or 4K output.",
    tags: ["Image", "Text-to-Image", "0.5K-4K", "Fast"],
  },
  "fal-ai/nano-banana-2/edit": {
    provider: "Google",
    description:
      "Nano Banana 2 Edit applies image-to-image edits with selectable 0.5K, 1K, 2K, or 4K output.",
    logo: "Google",
    tags: ["Image", "Image-to-Image", "0.5K-4K", "Fast"],
  },
};

const isImageToImageModel = (modelId: string) =>
  /\/edit(\b|\/|$)/i.test(modelId) || /image-to-image/i.test(modelId);

const TOOLTIP_WIDTH = 320;
const TOOLTIP_TAG_LIMIT = 5;

const tooltipTagPriority: Record<string, number> = {
  Image: 1,
  Video: 1,
  "Text-to-Image": 2,
  "Image-to-Image": 2,
  "Text-to-Video": 2,
  "Image-to-Video": 2,
  "First/Last Frame": 2,
  "Motion Transfer": 2,
  "9B": 3,
  "1K-4K": 3,
  "0.5K-4K": 3,
  "Native/2K/4K": 3,
  "720p-4K": 3,
  "720p/1080p": 3,
  "480p-1080p": 3,
  "Multimodal References": 3,
  "2-12s": 4,
  "4-8s": 4,
  "4-12s": 4,
  "5-10s": 4,
  "High Fidelity": 5,
  Balanced: 5,
  Fast: 5,
  "Wide Aspects": 5,
  Audio: 6,
};

const resolveTooltipTags = (modelId: string, contextTag?: string): string[] => {
  const tagSet = new Set<string>(modelMeta[modelId]?.tags ?? []);
  if (contextTag) {
    tagSet.add(contextTag);
  } else if (isImageToImageModel(modelId)) {
    tagSet.add("Image-to-Image");
  }
  return Array.from(tagSet)
    .sort((a, b) => {
      const rankA = tooltipTagPriority[a] ?? 99;
      const rankB = tooltipTagPriority[b] ?? 99;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.localeCompare(b);
    })
    .slice(0, TOOLTIP_TAG_LIMIT);
};

const sectionLogos: Record<string, string> = {
  Flux: FLUX_LOGO_SRC,
  "Black Forest Labs": FLUX_LOGO_SRC,
  Google: GOOGLE_LOGO_SRC,
  "Google DeepMind": GOOGLE_LOGO_SRC,
  Kling: KLING_LOGO_SRC,
  "Kling AI": KLING_LOGO_SRC,
  ByteDance: SEEDREAM_LOGO_SRC,
  Seedream: SEEDREAM_LOGO_SRC,
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

const contextTooltipTagMap: Record<ModelModalContext, string> = {
  "reference-image": "Image-to-Image",
  "reference-video": "Image-to-Video",
  "reference-keyframes": "First/Last Frame",
  "text-image": "Text-to-Image",
  "text-video": "Text-to-Video",
};

const providerPriorityByContext: Partial<Record<ModelModalContext, string[]>> = {
  "text-image": ["ByteDance", "Google", "Black Forest Labs"],
  "reference-image": ["ByteDance", "Google", "Black Forest Labs"],
  "reference-video": ["Kie AI"],
  "reference-keyframes": ["Kie AI"],
  "text-video": ["Kie AI"],
};

const modelPriorityByContext: Partial<Record<ModelModalContext, string[]>> = {
  "text-image": [
    "fal-ai/bytedance/seedream/v4.5/text-to-image",
    "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    "fal-ai/nano-banana-2",
    "fal-ai/nano-banana-pro",
    "fal-ai/flux-2/klein/9b",
  ],
  "reference-image": [
    "fal-ai/bytedance/seedream/v4.5/edit",
    "fal-ai/bytedance/seedream/v5/lite/edit",
    "fal-ai/nano-banana/edit",
    "fal-ai/nano-banana-2/edit",
    "fal-ai/nano-banana-pro/edit",
  ],
  "reference-video": ["kie-ai/veo-3.1-fast-i2v", "kie-ai/kling-3.0"],
  "reference-keyframes": ["kie-ai/veo-3.1-fast-i2v"],
  "text-video": [
    "kie-ai/veo-3.1-fast-i2v",
    "kie-ai/kling-3.0",
    "kie-ai/seedance-1.5-pro",
    "kie-ai/seedance-2",
    "kie-ai/seedance-2-fast",
  ],
};

const hiddenModelIdsByContext: Partial<Record<ModelModalContext, string[]>> = {
  "text-image": ["fal-ai/nano-banana"],
};

const videoModalContexts = new Set<ModelModalContext>([
  "reference-video",
  "reference-keyframes",
  "text-video",
]);

const contextTitleMap: Partial<Record<ModelModalContext, string>> = {
  "reference-image": "Image-to-Image",
  "text-image": "Text-to-Image",
};

const modelMatchesModalContext = (option: ModelOption, context?: ModelModalContext | null) => {
  const config = getModelConfig(option.value);
  if (!config) return false;
  if (!context) return true;
  if (context === "text-image") return Boolean(config.supportsTextToImage);
  if (context === "reference-image") return Boolean(config.supportsImageToImage);
  if (context === "text-video") {
    return (
      option.value === KIE_KLING_30_MODEL_ID ||
      Boolean(config.generationLanes?.includes("text-to-video"))
    );
  }
  if (context === "reference-video") {
    return Boolean(config.generationLanes?.includes("image-to-video"));
  }
  if (context === "reference-keyframes") return option.value === "kie-ai/veo-3.1-fast-i2v";
  return true;
};

/**
 * Renders the floating model selection modal.
 */
export function ModelModal({
  isOpen,
  onClose,
  onSelect,
  options = modelOptions,
  resolveCreditsForModel,
  context,
}: ModelModalProps) {
  useAiStudioModalActivity("model-modal", isOpen);
  if (!isOpen) {
    return null;
  }
  return (
    <ModelModalContent
      isOpen={isOpen}
      onClose={onClose}
      onSelect={onSelect}
      options={options}
      resolveCreditsForModel={resolveCreditsForModel}
      context={context}
    />
  );
}

function ModelModalContent({
  isOpen,
  onClose,
  onSelect,
  options = modelOptions,
  resolveCreditsForModel,
  context,
}: ModelModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setRecentValues] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = window.localStorage.getItem("aiStudioRecentModels");
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  });
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
    if (typeof window === "undefined" || !isOpen) return;
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    const frame = window.requestAnimationFrame(() => {
      setChipTooltip(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const contextHiddenModelIds = useMemo(
    () => new Set(context ? (hiddenModelIdsByContext[context] ?? []) : []),
    [context]
  );
  const visibleOptions = useMemo(
    () =>
      options.filter(
        (option) =>
          !contextHiddenModelIds.has(option.value) &&
          modelMatchesModalContext(option, context) &&
          (isSeedance2UiEnabled() || !isSeedance2ModelId(option.value))
      ),
    [context, contextHiddenModelIds, options]
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      normalizedQuery
        ? visibleOptions.filter((option) => option.label.toLowerCase().includes(normalizedQuery))
        : visibleOptions,
    [normalizedQuery, visibleOptions]
  );

  const optionMap = useMemo(
    () => new Map(filteredOptions.map((option) => [option.value, option])),
    [filteredOptions]
  );
  const getDisplayLabel = useCallback(
    (value: string) => {
      const option = optionMap.get(value);
      return option ? stripEditLabel(option.label) : value;
    },
    [optionMap]
  );

  const orderedOptions = useMemo(() => {
    if (!context) {
      return filteredOptions;
    }
    const providerPriority = providerPriorityByContext[context] ?? [];
    const modelPriority = modelPriorityByContext[context] ?? [];
    if (!providerPriority.length && !modelPriority.length) {
      return filteredOptions;
    }

    const providerRank = new Map(providerPriority.map((provider, index) => [provider, index]));
    const modelRank = new Map(modelPriority.map((value, index) => [value, index]));
    const originalIndex = new Map(filteredOptions.map((option, index) => [option.value, index]));

    return [...filteredOptions].sort((a, b) => {
      const providerA = modelMeta[a.value]?.provider ?? "Other";
      const providerB = modelMeta[b.value]?.provider ?? "Other";
      const providerDiff =
        (providerRank.get(providerA) ?? Number.MAX_SAFE_INTEGER) -
        (providerRank.get(providerB) ?? Number.MAX_SAFE_INTEGER);
      if (providerDiff !== 0) {
        return providerDiff;
      }
      if (providerA !== providerB) {
        return providerA.localeCompare(providerB);
      }

      const modelDiff =
        (modelRank.get(a.value) ?? Number.MAX_SAFE_INTEGER) -
        (modelRank.get(b.value) ?? Number.MAX_SAFE_INTEGER);
      if (modelDiff !== 0) {
        return modelDiff;
      }

      const labelDiff = a.label.localeCompare(b.label);
      if (labelDiff !== 0) {
        return labelDiff;
      }
      return (originalIndex.get(a.value) ?? 0) - (originalIndex.get(b.value) ?? 0);
    });
  }, [context, filteredOptions]);
  const modalTitle =
    context && videoModalContexts.has(context)
      ? "Video"
      : context && contextTitleMap[context]
        ? contextTitleMap[context]
        : "Models";
  const tooltipContextTag =
    context && context !== "text-video" ? contextTooltipTagMap[context] : undefined;

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

  const handleChipTooltipShow =
    (modelId: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const modalRect = modalRef.current?.getBoundingClientRect();
      const tooltipWidth = TOOLTIP_WIDTH;
      const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), max);

      if (!modalRect) return;

      const modalGutter = 10;
      const safeLeft = modalGutter;
      const safeRight = modalRect.width - modalGutter;

      const centerX = rect.left - modalRect.left + rect.width / 2;
      const placeBelow = false;
      const top = rect.top - modalRect.top;

      const unclampedLeft = centerX - tooltipWidth / 2;
      const left = clamp(unclampedLeft, safeLeft, safeRight - tooltipWidth);
      const arrowOffset = clamp(centerX - left, 16, tooltipWidth - 16);

      if (tooltipTimerRef.current) {
        window.clearTimeout(tooltipTimerRef.current);
      }
      tooltipTimerRef.current = window.setTimeout(
        () =>
          setChipTooltip({
            modelId,
            left,
            top,
            placement: placeBelow ? "below" : "above",
            arrowOffset,
          }),
        500
      );
    };

  const handleChipTooltipHide = () => {
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setChipTooltip(null);
  };

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
                      <Image
                        className="model-chip-logo-img"
                        src={logoSrc}
                        alt=""
                        aria-hidden
                        width={80}
                        height={20}
                        style={{ width: "auto" }}
                      />
                    ) : null}
                    <div className="model-chip-text">
                      <span className="model-chip-title">{getDisplayLabel(option.value)}</span>
                    </div>
                  </div>
                  <span className="model-chip-pill">
                    <span aria-hidden="true" className="model-chip-icon">
                      ✦
                    </span>
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
    const resolvedCredits = resolveCreditsForModel?.(modelId);
    if (typeof resolvedCredits === "number" && Number.isFinite(resolvedCredits)) {
      return `${resolvedCredits}`;
    }
    const cost = computeCostForModel(modelId, buildDefaultPricingParams(modelId));
    if (!cost?.credits) return "—";
    return `${cost.credits}`;
  };

  return (
    <AiStudioModalLayer>
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
              <p className="model-modal-title">{modalTitle}</p>
              <p className="model-modal-subtitle">Choose a model for this workflow.</p>
            </div>
            <div className="model-modal-header-actions">
              <div className="model-modal-search">
                <MagnifyingGlass
                  aria-hidden
                  className="model-search-icon"
                  size={14}
                  weight="bold"
                />
                <input
                  className="model-search-input"
                  type="search"
                  placeholder="Search models"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="ghost-btn mini model-modal-close"
                onClick={onClose}
                aria-label="Close model picker"
              >
                Close
              </button>
            </div>
          </div>
          <div className="model-modal-scroll">{renderSection("Models", orderedOptions)}</div>
          {chipTooltip ? (
            <div
              className={`model-chip-tooltip ${chipTooltip.placement === "below" ? "is-below" : "is-above"}`}
              style={
                {
                  top: chipTooltip.top,
                  left: chipTooltip.left,
                  "--tooltip-arrow-offset": `${chipTooltip.arrowOffset}px`,
                } as React.CSSProperties
              }
              role="tooltip"
            >
              <div className="model-chip-tooltip-header">
                <div>
                  <p className="model-chip-tooltip-title">{getDisplayLabel(chipTooltip.modelId)}</p>
                  {modelMeta[chipTooltip.modelId]?.provider ? (
                    <p className="model-chip-tooltip-provider">
                      {modelMeta[chipTooltip.modelId]?.provider}
                    </p>
                  ) : null}
                </div>
              </div>
              {modelMeta[chipTooltip.modelId]?.description ? (
                <p className="model-chip-tooltip-description">
                  {modelMeta[chipTooltip.modelId]?.description}
                </p>
              ) : null}
              <div className="model-chip-tooltip-meta">
                {(() => {
                  const tooltipTags = resolveTooltipTags(chipTooltip.modelId, tooltipContextTag);
                  if (!tooltipTags.length) {
                    return null;
                  }
                  return (
                    <div className="model-chip-tooltip-tags">
                      {tooltipTags.map((tag) => (
                        <span key={`${chipTooltip.modelId}-${tag}`} className="model-chip-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  );
                })()}
                <span className="model-chip-tooltip-credits">
                  <span aria-hidden="true" className="model-chip-tooltip-sparkle">
                    ✦
                  </span>{" "}
                  {formatCredits(chipTooltip.modelId)} credits
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AiStudioModalLayer>
  );
}
