/**
 * Resilient loader for the AI Studio Presets library panel.
 * Handles lazy-import stalls/failures with retry UI instead of indefinite loading.
 */
import React from "react";
import { reportAppError } from "../../../lib/appErrorReporter";
import type { UnifiedPresetsLibraryPanelProps } from "./UnifiedPresetsLibraryPanel";

type UnifiedPresetsLibraryPanelModule = typeof import("./UnifiedPresetsLibraryPanel");

type PresetsPanelLoaderProps = UnifiedPresetsLibraryPanelProps & {
  loadPanel?: () => Promise<UnifiedPresetsLibraryPanelModule>;
  timeoutMs?: number;
};

type PresetsPanelLoadState =
  | { status: "loading" }
  | {
      status: "ready";
      Component: React.ComponentType<UnifiedPresetsLibraryPanelProps>;
    }
  | {
      status: "error" | "timeout";
      message: string;
    };

const DEFAULT_TIMEOUT_MS = 8_000;

const loadUnifiedPresetsLibraryPanel = async (): Promise<UnifiedPresetsLibraryPanelModule> =>
  await import("./UnifiedPresetsLibraryPanel");

/**
 * Loads the Presets panel with retry affordances for stalled or failed lazy imports.
 */
export function PresetsPanelLoader({
  loadPanel = loadUnifiedPresetsLibraryPanel,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  ...panelProps
}: PresetsPanelLoaderProps) {
  const [retryCount, setRetryCount] = React.useState(0);
  const requestTokenRef = React.useRef(0);
  const [loadState, setLoadState] = React.useState<PresetsPanelLoadState>({
    status: "loading",
  });

  React.useEffect(() => {
    let active = true;
    const requestToken = requestTokenRef.current + 1;
    requestTokenRef.current = requestToken;
    setLoadState({ status: "loading" });

    const timeoutId = window.setTimeout(() => {
      if (!active || requestTokenRef.current !== requestToken) return;
      void reportAppError({
        source: "client.ai_studio.presets_panel_load_timeout",
        scope: "app",
        severity: "high",
        message: "AI Studio Presets panel timed out while loading.",
        route:
          typeof window !== "undefined"
            ? `${window.location.pathname}${window.location.search}`
            : null,
        metadata: {
          panel: "presets",
          retry_count: retryCount,
          timeout_ms: timeoutMs,
        },
      });
      setLoadState({
        status: "timeout",
        message: "Presets is taking longer than expected to open.",
      });
    }, timeoutMs);

    void loadPanel()
      .then((module) => {
        if (!active || requestTokenRef.current !== requestToken) return;
        window.clearTimeout(timeoutId);
        setLoadState({
          status: "ready",
          Component: module.UnifiedPresetsLibraryPanel,
        });
      })
      .catch((error) => {
        if (!active || requestTokenRef.current !== requestToken) return;
        window.clearTimeout(timeoutId);
        void reportAppError({
          source: "client.ai_studio.presets_panel_load_failure",
          scope: "app",
          severity: "high",
          message:
            error instanceof Error ? error.message : "AI Studio Presets panel failed to load.",
          stack: error instanceof Error ? error.stack : null,
          route:
            typeof window !== "undefined"
              ? `${window.location.pathname}${window.location.search}`
              : null,
          metadata: {
            panel: "presets",
            retry_count: retryCount,
          },
        });
        setLoadState({
          status: "error",
          message: "We couldn't open Presets right now.",
        });
      });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [loadPanel, retryCount, timeoutMs]);

  if (loadState.status === "ready") {
    const LoadedComponent = loadState.Component;
    return <LoadedComponent {...panelProps} />;
  }

  if (loadState.status === "loading") {
    return <p className="tiny subdued">Loading panel...</p>;
  }

  return (
    <section className="merged-presets-library-panel" aria-label="Presets library">
      <header className="merged-presets-library-header">
        <p className="eyebrow">Presets Library</p>
      </header>
      <div style={{ display: "grid", gap: 12 }}>
        <p className="tiny subdued">{loadState.message}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="primary-btn small"
            onClick={() => {
              setRetryCount((previous) => previous + 1);
            }}
          >
            Retry
          </button>
          <button
            type="button"
            className="ghost-btn small"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      </div>
    </section>
  );
}
