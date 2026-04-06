import { describe, expect, it, vi } from "vitest";
import klingStatus from "../../pages/api/fal/kling-status";
import klingImageStatus from "../../pages/api/fal/kling-v3-image-to-video-status";
import veoStatus from "../../pages/api/fal/veo-status";
import veoImageStatus from "../../pages/api/fal/veo-image-to-video-status";
import seedanceStatus from "../../pages/api/fal/seedance-status";
import seedanceI2vStatus from "../../pages/api/fal/seedance-i2v-status";

type MockResponse = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};

const createResponse = (): MockResponse => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    end: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
};

describe("disabled Fal video status routes", () => {
  it("returns 410 for disabled Fal video status fetches", async () => {
    const handlers = [
      [klingStatus, "Fal Kling 3.0 status route is disabled."],
      [klingImageStatus, "Fal Kling 3.0 image status route is disabled."],
      [veoStatus, "Fal Veo 3.1 status route is disabled."],
      [veoImageStatus, "Fal Veo 3.1 image status route is disabled."],
      [seedanceStatus, "Fal Seedance status route is disabled."],
      [seedanceI2vStatus, "Fal Seedance image status route is disabled."],
    ] as const;

    for (const [handler, expectedError] of handlers) {
      const res = createResponse();
      await handler({ method: "POST" } as never, res as never);
      expect(res.status).toHaveBeenCalledWith(410);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expectedError,
        })
      );
    }
  });

  it("allows OPTIONS preflight for disabled status routes", async () => {
    const res = createResponse();

    await veoImageStatus({ method: "OPTIONS" } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(204);
  });
});
