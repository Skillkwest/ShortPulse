import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

const originalCwd = process.cwd();

describe("hasFreshLocalGenerationWorkerHeartbeat", () => {
  afterEach(() => {
    process.chdir(originalCwd);
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("accepts a fresh frontend/.tmp heartbeat when the app cwd is the repo root", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shortpulse-heartbeat-"));
    const repoRoot = path.join(tempRoot, "repo");
    const frontendRoot = path.join(repoRoot, "frontend");
    const heartbeatPath = path.join(
      frontendRoot,
      ".tmp",
      "generation-control-plane-worker-heartbeat.json"
    );

    fs.mkdirSync(path.dirname(heartbeatPath), { recursive: true });
    fs.writeFileSync(
      heartbeatPath,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        status: "running",
      })
    );

    process.chdir(repoRoot);
    vi.stubEnv("SHORTPULSE_FAL_DEV_WORKER_HEARTBEAT_PATH", "");
    getSupabaseAdminMock.mockImplementation(() => {
      throw new Error("db fallback should not be used when file heartbeat is fresh");
    });

    const { hasFreshLocalGenerationWorkerHeartbeat } = await import("../localWorkerHeartbeat");

    await expect(hasFreshLocalGenerationWorkerHeartbeat()).resolves.toBe(true);
  });
});
