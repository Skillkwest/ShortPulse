import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = path.resolve(process.cwd(), "../scripts/recover_voice_changer_video.ts");

describe("Voice Changer recovery command source contract", () => {
  it("loads frontend environment before dynamically importing env-capturing server modules", async () => {
    const source = await readFile(scriptPath, "utf8");

    expect(source).toContain("loadEnvConfig(frontendDirectory)");
    expect(source).not.toMatch(
      /^import .*frontend\/lib\/server\/(?:api\/supabaseAdmin|mediaAudioExtraction|voiceChangerRemux)/m
    );
    const envLoadIndex = source.indexOf("loadEnvConfig(frontendDirectory)");
    const adminImportIndex = source.indexOf('import("../frontend/lib/server/api/supabaseAdmin")');
    expect(envLoadIndex).toBeGreaterThanOrEqual(0);
    expect(adminImportIndex).toBeGreaterThan(envLoadIndex);
  });

  it("remains dry-run-first and clears stale terminal failure metadata on apply success", async () => {
    const source = await readFile(scriptPath, "utf8");

    expect(source).toContain('const apply = process.argv.includes("--apply")');
    expect(source).toContain("if (!apply) process.exit(0)");
    expect(source).toContain("allowMutations: false");
    expect(source).toContain("allowMutations: true");
    expect(source.indexOf("if (!audioExists || !videoExists)")).toBeLessThan(
      source.indexOf("allowMutations: true")
    );
    expect(source).toContain('remux_status: "succeeded"');
    expect(source).toContain("remux_failure_code: null");
    expect(source).toContain("remux_failure_stage: null");
  });
});
