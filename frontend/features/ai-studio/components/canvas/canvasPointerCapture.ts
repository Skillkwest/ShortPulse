/**
 * Small guarded wrappers around browser pointer-capture APIs used by Canvas gestures.
 */
export const setPointerCaptureIfAvailable = ({
  target,
  pointerId,
}: {
  target: HTMLElement;
  pointerId: number;
}) => {
  if (typeof target.setPointerCapture !== "function") return;
  try {
    target.setPointerCapture(pointerId);
  } catch {
    // Ignore sporadic pointer-capture errors during rapid gesture transitions.
  }
};

export const releasePointerCaptureIfHeld = ({
  target,
  pointerId,
}: {
  target: HTMLElement;
  pointerId: number;
}) => {
  if (typeof target.releasePointerCapture !== "function") return;
  if (typeof target.hasPointerCapture === "function" && !target.hasPointerCapture(pointerId)) {
    return;
  }
  try {
    target.releasePointerCapture(pointerId);
  } catch {
    // Ignore release errors if capture was already lost.
  }
};
