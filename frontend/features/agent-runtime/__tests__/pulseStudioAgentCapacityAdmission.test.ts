/**
 * Guards the Pulse runtime's durable OpenAI admission and settlement wiring.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = fs.existsSync(path.resolve(process.cwd(), "features/agent-runtime"))
  ? process.cwd()
  : path.resolve(process.cwd(), "frontend");
const runtime = fs.readFileSync(
  path.join(frontendRoot, "features/agent-runtime/pulseStudioAgentRuntime/runtime.ts"),
  "utf8"
);
const coordinator = fs.readFileSync(
  path.join(frontendRoot, "features/agent-runtime/pulseStudioAgentRuntime/coordinator.ts"),
  "utf8"
);

describe("Pulse Studio OpenAI capacity admission wiring", () => {
  it("creates one Pulse parent before vision/coordinator work", () => {
    const admissionIndex = runtime.indexOf("await admitOpenAiInternalCapacityRequest({");
    const visionIndex = runtime.indexOf("await buildStudioAgentImageSummaryMap({");
    const coordinatorIndex = runtime.indexOf("await executeStudioAgentCoordinator({");

    expect(admissionIndex).toBeGreaterThan(0);
    expect(admissionIndex).toBeLessThan(visionIndex);
    expect(admissionIndex).toBeLessThan(coordinatorIndex);
    expect(runtime).toContain('lane: "studio_agent.pulse"');
  });

  it("consumes attempts through the shared hook and settles every coordinator result", () => {
    expect(runtime).toContain("await beginOpenAiInternalCapacityAttempt({");
    expect(runtime).toContain("await beforeProviderCall();");
    expect(runtime).toContain("beforeProviderCall,");
    expect(runtime).toContain("extractOpenAiInternalCapacityUsage(coordinatorResult.payload)");
    expect(coordinator).toContain("await beforeProviderCall?.();");
    expect(coordinator).toContain("onProviderCall: recordProviderCall");
  });
});
