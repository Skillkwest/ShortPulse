/**
 * Lazy loader for browser growth telemetry helpers.
 * Keeps public route entry chunks from statically owning the telemetry client.
 */
let growthTelemetryPromise: Promise<typeof import("./growthTelemetry")> | null = null;

/**
 * Loads the growth telemetry helpers on demand with one shared in-flight import.
 */
export const loadGrowthTelemetry = async (): Promise<typeof import("./growthTelemetry")> => {
  if (!growthTelemetryPromise) {
    growthTelemetryPromise = import("./growthTelemetry");
  }
  return await growthTelemetryPromise;
};
