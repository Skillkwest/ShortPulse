import React from "react";

import {
  clampNumber,
  MARKUP_COLOR_DEFAULT,
  type MarkupMode,
  type RailTool,
} from "./expertEditPanelViewContract";
import {
  hexToHsv,
  hsvToRgb,
  parseHexColor,
  rgbToHex,
  rgbToHsv,
  type HsvColor,
} from "./expertEditColorUtils";
import { isEventTargetInsideElement } from "./expertEditInteractionUtils";
import { ExpertEditMarkupControlsContent } from "./ExpertEditStageControls";

type UseExpertEditMarkupControlsRuntimeParams = {
  isMarkupToolSelected: boolean;
  isMarkupExpandSelected: boolean;
  resolvedMarkupStrokeSize: number;
  clearMarkupStrokesWithHistory: () => void;
  closeMarkupModal: () => void;
  openMarkupModal: () => void;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  setMarkupStrokeSize: React.Dispatch<React.SetStateAction<number>>;
};

export const useExpertEditMarkupControlsRuntime = ({
  isMarkupToolSelected,
  isMarkupExpandSelected,
  resolvedMarkupStrokeSize,
  clearMarkupStrokesWithHistory,
  closeMarkupModal,
  openMarkupModal,
  setSelectedRailTool,
  setMarkupStrokeSize,
}: UseExpertEditMarkupControlsRuntimeParams) => {
  const inlineMarkupColorPickerAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const modalMarkupColorPickerAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const markupColorSaturationRef = React.useRef<HTMLDivElement | null>(null);
  const [selectedMarkupMode, setSelectedMarkupMode] = React.useState<MarkupMode>("pen");
  const [openMarkupColorPickerScope, setOpenMarkupColorPickerScope] = React.useState<
    "inline" | "modal" | null
  >(null);
  const [markupColorHsv, setMarkupColorHsv] = React.useState<HsvColor>(() =>
    hexToHsv(MARKUP_COLOR_DEFAULT)
  );

  const markupColor = React.useMemo(() => rgbToHex(hsvToRgb(markupColorHsv)), [markupColorHsv]);

  const toggleMarkupColorPicker = React.useCallback((scope: "inline" | "modal") => {
    setOpenMarkupColorPickerScope((previous) => (previous === scope ? null : scope));
  }, []);

  const applyMarkupColorFromHex = React.useCallback((value: string) => {
    const parsed = parseHexColor(value);
    if (!parsed) return;
    setMarkupColorHsv(rgbToHsv(parsed));
    setOpenMarkupColorPickerScope(null);
  }, []);

  const applyMarkupSaturationValueFromPointer = React.useCallback(
    (clientX: number, clientY: number) => {
      const saturationSurface = markupColorSaturationRef.current;
      if (!saturationSurface) return;
      const rect = saturationSurface.getBoundingClientRect();
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return;
      if (rect.width <= 0 || rect.height <= 0) return;
      const saturation = clampNumber((clientX - rect.left) / rect.width, 0, 1);
      const value = 1 - clampNumber((clientY - rect.top) / rect.height, 0, 1);
      setMarkupColorHsv((previous) => ({
        ...previous,
        s: saturation,
        v: value,
      }));
    },
    []
  );

  const handleMarkupSaturationPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      applyMarkupSaturationValueFromPointer(event.clientX, event.clientY);
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    },
    [applyMarkupSaturationValueFromPointer]
  );

  const handleMarkupSaturationPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const isPointerActive =
        event.buttons > 0 || event.currentTarget.hasPointerCapture(event.pointerId);
      if (!isPointerActive) return;
      event.preventDefault();
      applyMarkupSaturationValueFromPointer(event.clientX, event.clientY);
    },
    [applyMarkupSaturationValueFromPointer]
  );

  const handleMarkupSaturationPointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setOpenMarkupColorPickerScope(null);
    },
    []
  );

  const handleMarkupHueChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextHue = clampNumber(Number(event.target.value), 0, 360);
    setMarkupColorHsv((previous) => ({
      ...previous,
      h: nextHue,
    }));
  }, []);

  React.useEffect(() => {
    if (!isMarkupToolSelected) {
      setOpenMarkupColorPickerScope(null);
    }
  }, [isMarkupToolSelected]);

  React.useEffect(() => {
    if (!openMarkupColorPickerScope || typeof document === "undefined") return;
    const handlePointerDown = (event: PointerEvent) => {
      const activeAnchor =
        openMarkupColorPickerScope === "modal"
          ? modalMarkupColorPickerAnchorRef.current
          : inlineMarkupColorPickerAnchorRef.current;
      if (isEventTargetInsideElement(activeAnchor, event.target)) return;
      setOpenMarkupColorPickerScope(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenMarkupColorPickerScope(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openMarkupColorPickerScope]);

  const renderMarkupControlsContent = React.useCallback(
    (scope: "inline" | "modal") => (
      <ExpertEditMarkupControlsContent
        scope={scope}
        selectedMarkupMode={selectedMarkupMode}
        isMarkupToolSelected={isMarkupToolSelected}
        isMarkupExpandSelected={isMarkupExpandSelected}
        resolvedMarkupStrokeSize={resolvedMarkupStrokeSize}
        markupColor={markupColor}
        markupColorHsv={markupColorHsv}
        markupColorPickerAnchorRef={
          scope === "modal" ? modalMarkupColorPickerAnchorRef : inlineMarkupColorPickerAnchorRef
        }
        markupColorSaturationRef={markupColorSaturationRef}
        isMarkupColorPickerOpen={openMarkupColorPickerScope === scope}
        toggleMarkupColorPicker={toggleMarkupColorPicker}
        setSelectedRailTool={setSelectedRailTool}
        setSelectedMarkupMode={setSelectedMarkupMode}
        setMarkupStrokeSize={setMarkupStrokeSize}
        clearMarkupStrokesWithHistory={clearMarkupStrokesWithHistory}
        closeMarkupModal={closeMarkupModal}
        openMarkupModal={openMarkupModal}
        applyMarkupColorFromHex={applyMarkupColorFromHex}
        handleMarkupSaturationPointerDown={handleMarkupSaturationPointerDown}
        handleMarkupSaturationPointerMove={handleMarkupSaturationPointerMove}
        handleMarkupSaturationPointerUp={handleMarkupSaturationPointerUp}
        handleMarkupHueChange={handleMarkupHueChange}
      />
    ),
    [
      applyMarkupColorFromHex,
      clearMarkupStrokesWithHistory,
      closeMarkupModal,
      handleMarkupHueChange,
      handleMarkupSaturationPointerDown,
      handleMarkupSaturationPointerMove,
      handleMarkupSaturationPointerUp,
      isMarkupExpandSelected,
      isMarkupToolSelected,
      markupColor,
      markupColorHsv,
      openMarkupColorPickerScope,
      openMarkupModal,
      resolvedMarkupStrokeSize,
      selectedMarkupMode,
      setMarkupStrokeSize,
      setSelectedRailTool,
      toggleMarkupColorPicker,
    ]
  );

  return {
    markupColor,
    renderMarkupControlsContent,
    selectedMarkupMode,
  };
};
