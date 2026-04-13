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
  isVideoToolSelected: boolean;
  isMarkupExpandSelected: boolean;
  resolvedMarkupStrokeSize: number;
  clearMarkupStrokesWithHistory: () => void;
  closeMarkupModal: () => void;
  openMarkupModal: () => void;
  setSelectedRailTool: React.Dispatch<React.SetStateAction<RailTool>>;
  setMarkupStrokeSize: React.Dispatch<React.SetStateAction<number>>;
};

export const useExpertEditMarkupControlsRuntime = ({
  isVideoToolSelected,
  isMarkupExpandSelected,
  resolvedMarkupStrokeSize,
  clearMarkupStrokesWithHistory,
  closeMarkupModal,
  openMarkupModal,
  setSelectedRailTool,
  setMarkupStrokeSize,
}: UseExpertEditMarkupControlsRuntimeParams) => {
  const markupColorPickerAnchorRef = React.useRef<HTMLDivElement | null>(null);
  const markupColorSaturationRef = React.useRef<HTMLDivElement | null>(null);
  const [selectedMarkupMode, setSelectedMarkupMode] = React.useState<MarkupMode>("pen");
  const [isMarkupColorPickerOpen, setIsMarkupColorPickerOpen] = React.useState(false);
  const [markupColorHsv, setMarkupColorHsv] = React.useState<HsvColor>(() =>
    hexToHsv(MARKUP_COLOR_DEFAULT)
  );

  const markupColor = React.useMemo(() => rgbToHex(hsvToRgb(markupColorHsv)), [markupColorHsv]);

  const applyMarkupColorFromHex = React.useCallback((value: string) => {
    const parsed = parseHexColor(value);
    if (!parsed) return;
    setMarkupColorHsv(rgbToHsv(parsed));
    setIsMarkupColorPickerOpen(false);
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
      setIsMarkupColorPickerOpen(false);
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
    if (!isVideoToolSelected) {
      setIsMarkupColorPickerOpen(false);
    }
  }, [isVideoToolSelected]);

  React.useEffect(() => {
    if (!isMarkupColorPickerOpen || typeof document === "undefined") return;
    const handlePointerDown = (event: PointerEvent) => {
      if (isEventTargetInsideElement(markupColorPickerAnchorRef.current, event.target)) return;
      setIsMarkupColorPickerOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMarkupColorPickerOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMarkupColorPickerOpen]);

  const renderMarkupControlsContent = React.useCallback(
    (scope: "inline" | "modal") => (
      <ExpertEditMarkupControlsContent
        scope={scope}
        selectedMarkupMode={selectedMarkupMode}
        isVideoToolSelected={isVideoToolSelected}
        isMarkupExpandSelected={isMarkupExpandSelected}
        resolvedMarkupStrokeSize={resolvedMarkupStrokeSize}
        markupColor={markupColor}
        markupColorHsv={markupColorHsv}
        markupColorPickerAnchorRef={markupColorPickerAnchorRef}
        markupColorSaturationRef={markupColorSaturationRef}
        isMarkupColorPickerOpen={isMarkupColorPickerOpen}
        setSelectedRailTool={setSelectedRailTool}
        setSelectedMarkupMode={setSelectedMarkupMode}
        setMarkupStrokeSize={setMarkupStrokeSize}
        setIsMarkupColorPickerOpen={setIsMarkupColorPickerOpen}
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
      isMarkupColorPickerOpen,
      isMarkupExpandSelected,
      isVideoToolSelected,
      markupColor,
      markupColorHsv,
      openMarkupModal,
      resolvedMarkupStrokeSize,
      selectedMarkupMode,
      setMarkupStrokeSize,
      setSelectedRailTool,
    ]
  );

  return {
    markupColor,
    renderMarkupControlsContent,
    selectedMarkupMode,
  };
};
