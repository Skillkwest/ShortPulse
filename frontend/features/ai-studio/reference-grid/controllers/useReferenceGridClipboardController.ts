/**
 * Document-level clipboard/pointer controller for Reference Grid.
 * Encapsulates paste capture heuristics and pointer priming while keeping render components declarative.
 */
import {
  useCallback,
  useEffect,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  collectClipboardMediaFiles,
  getMediaReferenceFromHtml,
  getMediaReferenceFromUriList,
  getReferencePasteSurfaces,
  inferClipboardMimeTypeFromUrl,
  isEditableElement,
  isMediaUrl,
  isNodeInsideAnySurface,
  normalizeClipboardText,
  parseUrlCandidate,
  type PastedMediaReference,
} from "./referenceGridClipboard";

type UseReferenceGridClipboardControllerArgs = {
  panelRef: MutableRefObject<HTMLDivElement | null>;
  curatedSectionRef: MutableRefObject<HTMLDivElement | null>;
  isPointerOverPanelRef: MutableRefObject<boolean>;
  isPastePrimedRef: MutableRefObject<boolean>;
  lastPasteFingerprintRef: MutableRefObject<{ value: string; at: number } | null>;
  buildFileList: (files: File[]) => FileList | null;
  onDropFiles?: (files: FileList) => void;
  onPasteMediaReference?: (reference: PastedMediaReference) => void;
  onPasteTextReference?: (text: string) => void;
};

type UseReferenceGridClipboardControllerResult = {
  handlePanelPointerEnter: () => void;
  handlePanelPointerLeave: () => void;
  handlePanelPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

/**
 * Installs and manages Reference Grid document paste listeners and pointer priming handlers.
 */
export const useReferenceGridClipboardController = ({
  panelRef,
  curatedSectionRef,
  isPointerOverPanelRef,
  isPastePrimedRef,
  lastPasteFingerprintRef,
  buildFileList,
  onDropFiles,
  onPasteMediaReference,
  onPasteTextReference,
}: UseReferenceGridClipboardControllerArgs): UseReferenceGridClipboardControllerResult => {
  const consumeClipboardData = useCallback(
    (clipboardData: DataTransfer | null): boolean => {
      if (!clipboardData) return false;
      const fingerprint = [
        Array.from(clipboardData.types || []).join(","),
        Array.from(clipboardData.files || [])
          .map((file) => `${file.name}|${file.size}|${file.type}`)
          .join(";"),
        normalizeClipboardText(clipboardData.getData("text/uri-list")).slice(0, 220),
        normalizeClipboardText(clipboardData.getData("text/plain")).slice(0, 220),
      ].join("::");
      const now = Date.now();
      const lastPaste = lastPasteFingerprintRef.current;
      if (lastPaste && lastPaste.value === fingerprint && now - lastPaste.at < 250) {
        return true;
      }
      const markHandled = () => {
        lastPasteFingerprintRef.current = { value: fingerprint, at: now };
      };

      // Priority 1: binary media in clipboard. Never fan this out to multiple cards.
      if (onDropFiles) {
        const mediaFiles = collectClipboardMediaFiles(clipboardData);
        const fileList = buildFileList(mediaFiles);
        if (fileList) {
          onDropFiles(fileList);
          markHandled();
          return true;
        }
      }

      // Priority 2: media URL payload from URI list / HTML / plain text URL.
      const uriListReference = getMediaReferenceFromUriList(clipboardData.getData("text/uri-list"));
      const htmlReference = getMediaReferenceFromHtml(clipboardData.getData("text/html"));
      const plainText = normalizeClipboardText(clipboardData.getData("text/plain"));
      const plainTextUrl = parseUrlCandidate(plainText);
      const plainTextReference =
        plainTextUrl && isMediaUrl(plainTextUrl)
          ? { url: plainTextUrl, mimeType: inferClipboardMimeTypeFromUrl(plainTextUrl) }
          : null;
      const pastedMediaReference = htmlReference || uriListReference || plainTextReference;
      if (pastedMediaReference && onPasteMediaReference) {
        onPasteMediaReference(pastedMediaReference);
        markHandled();
        return true;
      }

      // Priority 3: plain text.
      if (plainText && onPasteTextReference) {
        onPasteTextReference(plainText);
        markHandled();
        return true;
      }

      return false;
    },
    [
      buildFileList,
      lastPasteFingerprintRef,
      onDropFiles,
      onPasteMediaReference,
      onPasteTextReference,
    ]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleDocumentPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      const panelNode = panelRef.current;
      if (!panelNode) return;
      const pasteSurfaces = getReferencePasteSurfaces(panelNode);

      const targetElement = event.target instanceof HTMLElement ? event.target : null;
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const curatedSectionNode = curatedSectionRef.current;
      const insideCuratedSection =
        Boolean(targetElement && curatedSectionNode?.contains(targetElement)) ||
        Boolean(activeElement && curatedSectionNode?.contains(activeElement));
      if (insideCuratedSection) return;
      const targetInsideSurface = isNodeInsideAnySurface(targetElement, pasteSurfaces);
      const activeInsideSurface = isNodeInsideAnySurface(activeElement, pasteSurfaces);
      const targetIsEditable = isEditableElement(targetElement);
      const activeIsEditable = isEditableElement(activeElement);
      const pastePrimed = isPastePrimedRef.current;
      const preserveEditablePaste =
        (targetIsEditable || activeIsEditable) &&
        !targetInsideSurface &&
        !activeInsideSurface &&
        !isPointerOverPanelRef.current &&
        !pastePrimed;
      if (preserveEditablePaste) return;

      if (consumeClipboardData(event.clipboardData)) {
        event.preventDefault();
      }
    };
    document.addEventListener("paste", handleDocumentPaste);
    return () => {
      document.removeEventListener("paste", handleDocumentPaste);
    };
  }, [consumeClipboardData, curatedSectionRef, isPastePrimedRef, isPointerOverPanelRef, panelRef]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleDocumentPointerDown = (event: PointerEvent) => {
      const panelNode = panelRef.current;
      if (!panelNode) return;
      const pasteSurfaces = getReferencePasteSurfaces(panelNode);
      const targetNode = event.target instanceof Node ? event.target : null;
      const insidePasteSurface = isNodeInsideAnySurface(targetNode, pasteSurfaces);
      isPastePrimedRef.current = insidePasteSurface;
      if (
        insidePasteSurface &&
        event.button === 0 &&
        !isNodeInsideAnySurface(targetNode, [panelNode])
      ) {
        panelNode.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
    };
  }, [isPastePrimedRef, panelRef]);

  const handlePanelPointerEnter = () => {
    isPointerOverPanelRef.current = true;
  };

  const handlePanelPointerLeave = () => {
    isPointerOverPanelRef.current = false;
  };

  const handlePanelPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    isPastePrimedRef.current = true;
    if (event.button !== 0) return;
    event.currentTarget.focus({ preventScroll: true });
  };

  return {
    handlePanelPointerEnter,
    handlePanelPointerLeave,
    handlePanelPointerDown,
  };
};
