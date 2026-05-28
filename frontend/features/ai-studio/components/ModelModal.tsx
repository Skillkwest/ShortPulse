/**
 * Anchored model picker modal.
 * Positions next to the invoking control and lists available generation models with cost badges.
 */
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass } from "phosphor-react";
import { modelOptions, ModelOption } from "../constants";
import { getModelConfig } from "../logic/pricing";
import { isSeedance2ModelId, isSeedance2UiEnabled } from "../logic/seedance2Availability";
import {
  MODEL_MODAL_FAMILY_META,
  MODEL_MODAL_PRESENTATION_META,
  type ModelModalFamilyKey,
  resolveModelModalContextTooltipTag,
  resolveModelModalFamilyKey,
  resolveModelModalLogo,
  resolveModelModalTooltipTags,
} from "../logic/modelModalPresentation";
import { stripEditLabel } from "../utils/modelLabels";
import { AiStudioModalLayer, useAiStudioModalActivity } from "./modal-layer/AiStudioModalLayer";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_MODEL_ID,
  FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
} from "../../../lib/model-runtime/falModelIds";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import {
  getPairedModelId,
  resolveRequiredCreateCharacterModeStartupModelId,
  resolveRequiredCreateStartupModelId,
} from "../../../lib/model-runtime/modelCatalog";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";

export type ModelModalContext =
  | "character-image"
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
  onPresentationResolved?: (payload: {
    context: ModelModalContext | null;
    suppliedOptionCount: number;
    visibleOptionCount: number;
  }) => void;
};

type ModelFamilyGroup = {
  key: ModelModalFamilyKey;
  label: string;
  logo?: string;
  items: ModelOption[];
};

const MODEL_MODAL_TEXT_IMAGE_STARTUP_MODEL_ID = resolveRequiredCreateStartupModelId();
const MODEL_MODAL_EDIT_IMAGE_STARTUP_MODEL_ID = resolveRequiredCreateCharacterModeStartupModelId();
const MODEL_MODAL_TEXT_IMAGE_SECONDARY_MODEL_IDS = [
  FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_MODEL_ID,
] as const;
const MODEL_MODAL_TEXT_IMAGE_MODEL_PRIORITY = [
  MODEL_MODAL_TEXT_IMAGE_STARTUP_MODEL_ID,
  ...MODEL_MODAL_TEXT_IMAGE_SECONDARY_MODEL_IDS,
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
] as const;
const MODEL_MODAL_EDIT_IMAGE_MODEL_PRIORITY = [
  MODEL_MODAL_EDIT_IMAGE_STARTUP_MODEL_ID,
  ...MODEL_MODAL_TEXT_IMAGE_SECONDARY_MODEL_IDS.map(
    (modelId) => getPairedModelId(modelId) ?? modelId
  ),
] as const;

const TOOLTIP_WIDTH = 320;

const IMAGE_MODAL_FAMILY_PRIORITY = ["seedream", "nano-banana", "gpt-image", "flux"];
const VIDEO_MODAL_FAMILY_PRIORITY = ["veo", "kling", "seedance"];

// Explicit product-policy ranking tables: keep these manual unless a future
// presentation-policy phase intentionally redesigns their ownership.
const familyPriorityByContext: Partial<Record<ModelModalContext, string[]>> = {
  "character-image": IMAGE_MODAL_FAMILY_PRIORITY,
  "text-image": IMAGE_MODAL_FAMILY_PRIORITY,
  "reference-image": IMAGE_MODAL_FAMILY_PRIORITY,
  "reference-video": VIDEO_MODAL_FAMILY_PRIORITY,
  "reference-keyframes": ["veo"],
  "text-video": VIDEO_MODAL_FAMILY_PRIORITY,
};

const defaultFamilyPriority = [
  "veo",
  "kling",
  "seedance",
  "seedream",
  "nano-banana",
  "gpt-image",
  "flux",
  "other",
];

const IMAGE_MODAL_PROVIDER_PRIORITY = ["ByteDance", "Google", "Black Forest Labs"];
const VIDEO_MODAL_PROVIDER_PRIORITY = ["Kie AI"];

const providerPriorityByContext: Partial<Record<ModelModalContext, string[]>> = {
  "character-image": IMAGE_MODAL_PROVIDER_PRIORITY,
  "text-image": IMAGE_MODAL_PROVIDER_PRIORITY,
  "reference-image": IMAGE_MODAL_PROVIDER_PRIORITY,
  "reference-video": VIDEO_MODAL_PROVIDER_PRIORITY,
  "reference-keyframes": VIDEO_MODAL_PROVIDER_PRIORITY,
  "text-video": VIDEO_MODAL_PROVIDER_PRIORITY,
};

const modelPriorityByContext: Partial<Record<ModelModalContext, string[]>> = {
  "character-image": [...MODEL_MODAL_EDIT_IMAGE_MODEL_PRIORITY],
  "text-image": [...MODEL_MODAL_TEXT_IMAGE_MODEL_PRIORITY],
  "reference-image": [...MODEL_MODAL_EDIT_IMAGE_MODEL_PRIORITY],
  "reference-video": [KIE_VEO_31_FAST_I2V_MODEL_ID, KIE_KLING_30_MODEL_ID],
  "reference-keyframes": [KIE_VEO_31_FAST_I2V_MODEL_ID],
  "text-video": [
    KIE_VEO_31_FAST_I2V_MODEL_ID,
    KIE_KLING_30_MODEL_ID,
    KIE_SEEDANCE_2_MODEL_ID,
    KIE_SEEDANCE_2_FAST_MODEL_ID,
  ],
};

const hiddenModelIdsByContext: Partial<Record<ModelModalContext, string[]>> = {};

const videoModalContexts = new Set<ModelModalContext>([
  "reference-video",
  "reference-keyframes",
  "text-video",
]);

const contextTitleMap: Partial<Record<ModelModalContext, string>> = {
  "character-image": "Character Mode",
  "reference-image": "Image-to-Image",
  "text-image": "Text-to-Image",
};

const modelMatchesModalContext = (option: ModelOption, context?: ModelModalContext | null) => {
  const config = getModelConfig(option.value);
  if (!config) return false;
  if (!context) return true;
  if (context === "character-image") return Boolean(config.supportsImageToImage);
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
  if (context === "reference-keyframes") return option.value === KIE_VEO_31_FAST_I2V_MODEL_ID;
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
  onPresentationResolved,
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
      onPresentationResolved={onPresentationResolved}
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
  onPresentationResolved,
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
  const backdropDismiss = useGuardedBackdropDismiss<HTMLDivElement>(onClose);

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

  useEffect(() => {
    if (!isOpen) return;
    onPresentationResolved?.({
      context: context ?? null,
      suppliedOptionCount: options.length,
      visibleOptionCount: visibleOptions.length,
    });
  }, [context, isOpen, onPresentationResolved, options.length, visibleOptions.length]);

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
      const providerA = MODEL_MODAL_PRESENTATION_META[a.value]?.provider ?? "Other";
      const providerB = MODEL_MODAL_PRESENTATION_META[b.value]?.provider ?? "Other";
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
  const familyColumns = useMemo((): ModelFamilyGroup[] => {
    const grouped = new Map<ModelModalFamilyKey, ModelOption[]>();
    orderedOptions.forEach((option) => {
      const familyKey = resolveModelModalFamilyKey(option.value);
      const familyItems = grouped.get(familyKey) ?? [];
      familyItems.push(option);
      grouped.set(familyKey, familyItems);
    });

    const priority = context
      ? (familyPriorityByContext[context] ?? defaultFamilyPriority)
      : defaultFamilyPriority;
    const familyRank = new Map(priority.map((familyKey, index) => [familyKey, index]));

    return Array.from(grouped.entries())
      .map(([familyKey, items]) => {
        const familyMeta = MODEL_MODAL_FAMILY_META[familyKey] ?? MODEL_MODAL_FAMILY_META.other;
        return {
          key: familyKey,
          label: familyMeta.label,
          logo: familyMeta.logo,
          items,
        };
      })
      .sort((a, b) => {
        const rankA = familyRank.get(a.key) ?? Number.MAX_SAFE_INTEGER;
        const rankB = familyRank.get(b.key) ?? Number.MAX_SAFE_INTEGER;
        if (rankA !== rankB) return rankA - rankB;
        return a.label.localeCompare(b.label);
      });
  }, [context, orderedOptions]);
  const modalTitle =
    context && videoModalContexts.has(context)
      ? "Video"
      : context && contextTitleMap[context]
        ? contextTitleMap[context]
        : "Models";
  const tooltipContextTag =
    context && context !== "text-video" ? resolveModelModalContextTooltipTag(context) : undefined;

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

  const renderChip = (option: ModelOption) => {
    const logoSrc = resolveModelModalLogo(option.value);
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
  };

  const renderFamilyColumns = (families: ModelFamilyGroup[]) => {
    if (!families.length) return null;
    return (
      <div className="model-modal-section">
        <div className="model-family-grid">
          {families.map((family) => (
            <section
              key={family.key}
              className="model-family-column"
              aria-label={`${family.label} models`}
            >
              <div className="model-family-header">
                {family.logo ? (
                  <Image
                    className="model-family-logo-img"
                    src={family.logo}
                    alt=""
                    aria-hidden
                    width={80}
                    height={20}
                    style={{ width: "auto" }}
                  />
                ) : null}
                <span className="model-family-title">{family.label}</span>
              </div>
              <div className="model-family-chip-list">{family.items.map(renderChip)}</div>
            </section>
          ))}
        </div>
      </div>
    );
  };

  const formatCredits = (modelId: string) => {
    const resolvedCredits = resolveCreditsForModel?.(modelId);
    if (typeof resolvedCredits === "number" && Number.isFinite(resolvedCredits)) {
      return `${resolvedCredits}`;
    }
    return "—";
  };

  const tooltipProvider = chipTooltip
    ? (MODEL_MODAL_PRESENTATION_META[chipTooltip.modelId]?.provider ?? null)
    : null;
  const shouldShowTooltipProvider =
    Boolean(tooltipProvider) && !/^kie ai$/i.test(tooltipProvider ?? "");

  return (
    <AiStudioModalLayer>
      <div className="model-modal-backdrop" {...backdropDismiss}>
        <div
          className="model-modal model-picker-modal"
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
          <div className="model-modal-scroll">{renderFamilyColumns(familyColumns)}</div>
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
                  {shouldShowTooltipProvider ? (
                    <p className="model-chip-tooltip-provider">{tooltipProvider}</p>
                  ) : null}
                </div>
              </div>
              {MODEL_MODAL_PRESENTATION_META[chipTooltip.modelId]?.description ? (
                <p className="model-chip-tooltip-description">
                  {MODEL_MODAL_PRESENTATION_META[chipTooltip.modelId]?.description}
                </p>
              ) : null}
              <div className="model-chip-tooltip-meta">
                {(() => {
                  const tooltipTags = resolveModelModalTooltipTags(
                    chipTooltip.modelId,
                    tooltipContextTag
                  );
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
