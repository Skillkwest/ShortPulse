/**
 * Prevents overlapping Create submit clicks from dispatching duplicate runs
 * while keeping the owning Generate CTA visually unchanged.
 */
import { useCallback, useRef } from "react";

/**
 * Wraps a Create-submit callback in a behavior-only single-flight guard.
 * The guard suppresses overlapping clicks until the first submit handoff settles.
 */
export const useAiStudioCreateSubmitSingleFlight = <Args extends readonly unknown[]>(
  submit: (...args: Args) => void | Promise<unknown>
) => {
  const inFlightRef = useRef(false);

  return useCallback(
    (...args: Args) => {
      if (inFlightRef.current) {
        return;
      }
      inFlightRef.current = true;
      void (async () => {
        try {
          await submit(...args);
        } finally {
          inFlightRef.current = false;
        }
      })();
    },
    [submit]
  );
};
