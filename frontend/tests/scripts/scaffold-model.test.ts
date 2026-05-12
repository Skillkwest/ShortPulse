import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const SCAFFOLD_MODEL_SCRIPT = path.join(REPO_ROOT, "scripts", "scaffold_model.js");

function runScaffold(args: string[]) {
  return execFileSync("node", [SCAFFOLD_MODEL_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

describe("scaffold_model", () => {
  it("prints queued Fal route inventory guidance and follow-up commands", () => {
    const output = runScaffold([
      "--model-id",
      "fal-ai/example/model",
      "--label",
      "Example Model",
      "--provider",
      "fal",
      "--media-type",
      "image",
      "--execution-mode",
      "queued",
      "--submit-handler",
      "image",
      "--generation-lanes",
      "text-to-image",
      "--display-family",
      "Image",
      "--display-order",
      "999",
      "--pricing-strategy",
      "example-per-image",
      "--api-route-slug",
      "example-model",
      "--route-validator",
      "generic",
    ]);

    expect(output).toContain("Fal/Kie route inventory snippet:");
    expect(output).toContain('fileBase: "example-model"');
    expect(output).toContain('validator: "generic"');
    expect(output).toContain(
      "- Add the route inventory entry in `scripts/lib/fal_route_inventory.js`."
    );
    expect(output).toContain("- Run `npm -C frontend run fal:routes:sync`");
    expect(output).toContain("- Run `npm -C frontend run fal:routes:check`.");
    expect(output).toContain("- Run `npm -C frontend run model:doctor`.");
  });

  it("prints direct ElevenLabs allowlist guidance with route authority symbols", () => {
    const output = runScaffold([
      "--model-id",
      "eleven_multilingual_v2",
      "--label",
      "Eleven Multilingual v2",
      "--provider",
      "elevenlabs",
      "--media-type",
      "audio",
      "--execution-mode",
      "direct",
      "--submit-handler",
      "audio",
      "--generation-lanes",
      "text-to-speech",
      "--display-family",
      "Audio",
      "--display-order",
      "999",
      "--pricing-strategy",
      "example-per-audio",
      "--surfaces",
      "runtime,pricing",
      "--direct-route-path",
      "frontend/pages/api/elevenlabs/text-to-speech.ts",
      "--direct-route-kind",
      "audio-generate",
      "--direct-route-authority",
      "catalog-default-role-allowlist",
      "--direct-route-requires-billing",
      "true",
    ]);

    expect(output).toContain("Direct provider route inventory snippet:");
    expect(output).toContain('directRouteKind: "audio-generate"');
    expect(output).toContain('authority: "catalog-default-role-allowlist"');
    expect(output).toContain('"resolveRequiredCatalogRoleModelId"');
    expect(output).toContain('"ALLOWED_MODEL_IDS"');
    expect(output).toContain('"ALLOWED_MODEL_IDS.has(modelId)"');
    expect(output).toContain('"chargeGenerationRequest"');
    expect(output).toContain(
      "- Resolve the approved model id from the catalog, enforce a route-local allowlist, and reject unsupported client model ids before billing/provider execution."
    );
    expect(output).toContain(
      "- Wire `chargeGenerationRequest` because the route is user-billable."
    );
  });
});
