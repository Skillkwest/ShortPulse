/**
 * Modal image zoom/pan controller for Media Library detail preview.
 * Encapsulates keyboard/mouse/pointer interactions and exposes view-model state for rendering.
 */
import { useCallback, useRef, useState } from "react";
import type React from "react";

type ModalImageNaturalSize = {
  width: number;
  height: number;
};

type ModalImagePan = {
  x: number;
  y: number;
};

export type UseMediaModalImageZoomArgs = {
  isFocusedImage: boolean;
};

const MAX_MODAL_IMAGE_ZOOM = 6;
const MIN_MODAL_IMAGE_ZOOM = 1;
const CLICK_TOGGLE_ZOOM = 2;

/**
 * Creates modal image zoom/pan state and handlers for pointer + keyboard interactions.
 * Inputs: whether the focused preview item is an image.
 * Output: refs, view state, and event handlers for modal preview wiring.
 * Side effects: pointer capture/release on the target image element during drag-pan operations.
 */
export const useMediaModalImageZoom = ({ isFocusedImage }: UseMediaModalImageZoomArgs) => {
  const [modalImageZoomScale, setModalImageZoomScale] = useState(1);
  const [modalImageZoomActive, setModalImageZoomActive] = useState(false);
  const [modalImagePan, setModalImagePan] = useState<ModalImagePan>({ x: 0, y: 0 });
  const [modalImageNaturalSize, setModalImageNaturalSize] = useState<ModalImageNaturalSize | null>(
    null
  );
  const [isModalImagePanning, setIsModalImagePanning] = useState(false);
  const modalPreviewRef = useRef<HTMLDivElement | null>(null);
  const modalImagePanDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);
  const modalImageDraggedRef = useRef(false);

  const clampModalImagePan = useCallback(
    (nextX: number, nextY: number, scale: number): ModalImagePan => {
      const vessel = modalPreviewRef.current;
      if (!vessel || !modalImageNaturalSize || scale <= 1) {
        return { x: 0, y: 0 };
      }
      const vesselWidth = vessel.clientWidth;
      const vesselHeight = vessel.clientHeight;
      if (!vesselWidth || !vesselHeight) return { x: 0, y: 0 };

      const naturalRatio = modalImageNaturalSize.width / modalImageNaturalSize.height;
      const vesselRatio = vesselWidth / vesselHeight;
      const fittedWidth = naturalRatio > vesselRatio ? vesselWidth : vesselHeight * naturalRatio;
      const fittedHeight = naturalRatio > vesselRatio ? vesselWidth / naturalRatio : vesselHeight;

      const zoomedWidth = fittedWidth * scale;
      const zoomedHeight = fittedHeight * scale;
      const maxPanX = Math.max(0, (zoomedWidth - vesselWidth) / 2);
      const maxPanY = Math.max(0, (zoomedHeight - vesselHeight) / 2);

      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, nextX)),
        y: Math.max(-maxPanY, Math.min(maxPanY, nextY)),
      };
    },
    [modalImageNaturalSize]
  );

  const resetModalImageTransform = useCallback(() => {
    setModalImageZoomScale(1);
    setModalImageZoomActive(false);
    setModalImagePan({ x: 0, y: 0 });
    setIsModalImagePanning(false);
    modalImagePanDragRef.current = null;
    modalImageDraggedRef.current = false;
  }, []);

  const resetModalImageZoom = useCallback(() => {
    resetModalImageTransform();
    setModalImageNaturalSize(null);
  }, [resetModalImageTransform]);

  const cacheModalImageNaturalSize = useCallback((width: number, height: number) => {
    if (!width || !height) return;
    setModalImageNaturalSize({ width, height });
  }, []);

  const applyModalZoomAtPoint = useCallback(
    (clientX: number, clientY: number, nextScale: number) => {
      const vessel = modalPreviewRef.current;
      if (!vessel) return;
      const rect = vessel.getBoundingClientRect();
      const pointerX = clientX - rect.left;
      const pointerY = clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const clampedScale = Math.min(
        MAX_MODAL_IMAGE_ZOOM,
        Math.max(MIN_MODAL_IMAGE_ZOOM, nextScale)
      );

      setModalImagePan((prev) => {
        if (clampedScale <= 1) return { x: 0, y: 0 };
        const currentScale = Math.max(0.0001, modalImageZoomScale);
        const localX = pointerX - centerX;
        const localY = pointerY - centerY;
        const sourceX = (localX - prev.x) / currentScale;
        const sourceY = (localY - prev.y) / currentScale;
        const nextX = localX - sourceX * clampedScale;
        const nextY = localY - sourceY * clampedScale;
        return clampModalImagePan(nextX, nextY, clampedScale);
      });
      setModalImageZoomScale(clampedScale);
    },
    [clampModalImagePan, modalImageZoomScale]
  );

  const handleModalImageClick = useCallback(
    (event: React.MouseEvent<HTMLImageElement>) => {
      if (!isFocusedImage) return;
      if (modalImageDraggedRef.current) {
        modalImageDraggedRef.current = false;
        return;
      }
      if (modalImageZoomActive) {
        resetModalImageTransform();
        return;
      }
      setModalImageZoomActive(true);
      applyModalZoomAtPoint(event.clientX, event.clientY, CLICK_TOGGLE_ZOOM);
    },
    [applyModalZoomAtPoint, isFocusedImage, modalImageZoomActive, resetModalImageTransform]
  );

  const handleModalImageKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLImageElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (modalImageZoomActive) {
          resetModalImageTransform();
          return;
        }
        setModalImageZoomActive(true);
        const vessel = modalPreviewRef.current;
        if (!vessel) {
          setModalImageZoomScale(CLICK_TOGGLE_ZOOM);
          return;
        }
        const rect = vessel.getBoundingClientRect();
        applyModalZoomAtPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          CLICK_TOGGLE_ZOOM
        );
      }
      if (event.key === "Escape") {
        if (modalImageZoomActive) {
          event.preventDefault();
          resetModalImageTransform();
        }
      }
    },
    [applyModalZoomAtPoint, modalImageZoomActive, resetModalImageTransform]
  );

  const handleModalImageWheel = useCallback(
    (event: React.WheelEvent<HTMLImageElement>) => {
      if (!isFocusedImage || !modalImageZoomActive) return;
      event.preventDefault();
      event.stopPropagation();

      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
      const nextScale = Math.min(
        MAX_MODAL_IMAGE_ZOOM,
        Math.max(MIN_MODAL_IMAGE_ZOOM, modalImageZoomScale * zoomFactor)
      );
      if (Math.abs(nextScale - modalImageZoomScale) < 0.0001) return;
      applyModalZoomAtPoint(event.clientX, event.clientY, nextScale);
    },
    [applyModalZoomAtPoint, isFocusedImage, modalImageZoomActive, modalImageZoomScale]
  );

  const handleModalPreviewWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!isFocusedImage || !modalImageZoomActive) return;
      event.preventDefault();
      event.stopPropagation();
      const zoomFactor = event.deltaY < 0 ? 1.12 : 0.88;
      const nextScale = Math.min(
        MAX_MODAL_IMAGE_ZOOM,
        Math.max(MIN_MODAL_IMAGE_ZOOM, modalImageZoomScale * zoomFactor)
      );
      if (Math.abs(nextScale - modalImageZoomScale) < 0.0001) return;
      applyModalZoomAtPoint(event.clientX, event.clientY, nextScale);
    },
    [applyModalZoomAtPoint, isFocusedImage, modalImageZoomActive, modalImageZoomScale]
  );

  const handleModalImagePointerDown = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      if (!isFocusedImage || !modalImageZoomActive || modalImageZoomScale <= 1) return;
      if (event.button !== 0) return;
      modalImagePanDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPanX: modalImagePan.x,
        startPanY: modalImagePan.y,
      };
      modalImageDraggedRef.current = false;
      setIsModalImagePanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [isFocusedImage, modalImagePan.x, modalImagePan.y, modalImageZoomActive, modalImageZoomScale]
  );

  const handleModalImagePointerMove = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      const dragState = modalImagePanDragRef.current;
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        modalImageDraggedRef.current = true;
      }
      setModalImagePan(
        clampModalImagePan(
          dragState.startPanX + deltaX,
          dragState.startPanY + deltaY,
          modalImageZoomScale
        )
      );
    },
    [clampModalImagePan, modalImageZoomScale]
  );

  const handleModalImagePointerUp = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    const dragState = modalImagePanDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    modalImagePanDragRef.current = null;
    setIsModalImagePanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return {
    cacheModalImageNaturalSize,
    handleModalImageClick,
    handleModalImageKeyDown,
    handleModalImagePointerDown,
    handleModalImagePointerMove,
    handleModalImagePointerUp,
    handleModalImageWheel,
    handleModalPreviewWheel,
    isModalImagePanning,
    modalImagePan,
    modalImageZoomActive,
    modalImageZoomScale,
    modalPreviewRef,
    resetModalImageZoom,
  };
};
