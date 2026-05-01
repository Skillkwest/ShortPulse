/**
 * Shared backdrop-dismiss guard for modal surfaces.
 * Dismisses only when a pointer gesture starts and ends on the backdrop itself.
 */
import React from "react";

type PointerSequence = {
  pointerId: number;
  startedOnBackdrop: boolean;
};

type GuardedBackdropDismissOptions = {
  disabled?: boolean;
};

type GuardedBackdropDismissProps<T extends HTMLElement> = {
  ref: React.RefObject<T>;
  onClickCapture: React.MouseEventHandler<T>;
  onPointerCancelCapture: React.PointerEventHandler<T>;
  onPointerUpCapture: React.PointerEventHandler<T>;
};

/**
 * Returns props for a backdrop element that should dismiss only on intentional backdrop clicks.
 */
export function useGuardedBackdropDismiss<T extends HTMLElement>(
  onDismiss: () => void,
  options: GuardedBackdropDismissOptions = {}
): GuardedBackdropDismissProps<T> {
  const { disabled = false } = options;
  const backdropRef = React.useRef<T>(null);
  const pointerSequenceRef = React.useRef<PointerSequence | null>(null);
  const suppressNextBackdropClickRef = React.useRef(false);

  React.useEffect(() => {
    if (disabled || typeof document === "undefined") return undefined;

    const handleDocumentPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        pointerSequenceRef.current = null;
        suppressNextBackdropClickRef.current = false;
        return;
      }

      const backdrop = backdropRef.current;
      if (!backdrop) return;
      const startedOnBackdrop = event.target === backdrop;
      pointerSequenceRef.current = {
        pointerId: event.pointerId,
        startedOnBackdrop,
      };
      suppressNextBackdropClickRef.current = !startedOnBackdrop;
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
    };
  }, [disabled]);

  const resetPointerSequence = React.useCallback(() => {
    pointerSequenceRef.current = null;
  }, []);

  const onPointerUpCapture = React.useCallback<React.PointerEventHandler<T>>(
    (event) => {
      if (disabled) return;

      const pointerSequence = pointerSequenceRef.current;
      if (!pointerSequence || pointerSequence.pointerId !== event.pointerId) return;

      const endedOnBackdrop = event.target === event.currentTarget;
      const shouldDismiss = pointerSequence.startedOnBackdrop && endedOnBackdrop;
      suppressNextBackdropClickRef.current = true;
      resetPointerSequence();

      if (shouldDismiss) {
        onDismiss();
      }
    },
    [disabled, onDismiss, resetPointerSequence]
  );

  const onPointerCancelCapture = React.useCallback<React.PointerEventHandler<T>>(() => {
    suppressNextBackdropClickRef.current = true;
    resetPointerSequence();
  }, [resetPointerSequence]);

  const onClickCapture = React.useCallback<React.MouseEventHandler<T>>(
    (event) => {
      if (disabled) return;
      if (event.target !== event.currentTarget) return;

      if (suppressNextBackdropClickRef.current) {
        suppressNextBackdropClickRef.current = false;
        return;
      }

      onDismiss();
    },
    [disabled, onDismiss]
  );

  return {
    ref: backdropRef,
    onClickCapture,
    onPointerCancelCapture,
    onPointerUpCapture,
  };
}
