/**
 * Global React error boundary for capturing render-time failures.
 * Adds `componentStack` and context that window.onerror cannot provide.
 */

import React from "react";
import { reportAppError } from "../lib/appErrorReporter";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

const GENERIC_USER_FACING_ERROR_MESSAGE = "Please reload the page or try again in a moment.";

const currentRoute = (): string | null => {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`.slice(0, 300);
};

/**
 * Catches React render errors and reports them to the client error ingest endpoint.
 */
export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = {
    hasError: false,
    message: GENERIC_USER_FACING_ERROR_MESSAGE,
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    const message = error instanceof Error ? error.message : "A rendering error occurred.";
    void message;
    return { hasError: true, message: GENERIC_USER_FACING_ERROR_MESSAGE };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const message = error instanceof Error ? error.message : "A rendering error occurred.";
    const stack = error instanceof Error ? error.stack : null;

    void reportAppError({
      source: "client.react_error_boundary",
      scope: "app",
      severity: "high",
      message,
      stack,
      route: currentRoute(),
      metadata: {
        react_component_stack: info.componentStack?.slice(0, 6000) ?? null,
      },
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="page page-wide">
        <div className="panel">
          <p className="eyebrow">Something went wrong</p>
          <h1 className="title" style={{ fontSize: 22 }}>
            We hit a rendering error
          </h1>
          <p className="subdued" style={{ marginTop: 10 }}>
            {this.state.message}
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="primary-btn small"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
            >
              Reload
            </button>
            <button
              type="button"
              className="ghost-btn small"
              onClick={() => {
                this.setState({ hasError: false, message: GENERIC_USER_FACING_ERROR_MESSAGE });
              }}
            >
              Try to recover
            </button>
          </div>
        </div>
      </main>
    );
  }
}
