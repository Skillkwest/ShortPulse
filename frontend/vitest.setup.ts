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
