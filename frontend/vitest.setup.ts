// Shared Vitest setup for DOM and matcher extensions.
import "@testing-library/jest-dom";

// jsdom logs a noisy "not implemented" warning for canvas context access by default.
// Keep the default null return value unless individual tests install a richer mock.
if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: () => null,
  });
}

// jsdom also leaves media playback methods unimplemented. Provide quiet no-ops
// while keeping them writable so focused media tests can install spies.
if (typeof HTMLMediaElement !== "undefined") {
  Object.defineProperty(HTMLMediaElement.prototype, "load", {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    writable: true,
    value: () => Promise.resolve(),
  });
}
