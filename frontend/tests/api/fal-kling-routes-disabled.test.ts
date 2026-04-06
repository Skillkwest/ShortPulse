import { describe, expect, it, vi } from "vitest";
import klingV3ImageToVideoSubmit from "../../pages/api/fal/kling-v3-image-to-video-submit";
import klingV3TextSubmit from "../../pages/api/fal/kling-v3-text-submit";

type MockResponse = {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
};

const createResponse = (): MockResponse => {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  response.status.mockReturnValue(response);
  return response;
};

describe("disabled Fal Kling API routes", () => {
  it("returns 410 for Fal Kling text submit", () => {
    const res = createResponse();

    klingV3TextSubmit({ method: "POST" } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal Kling 3.0 text-to-video is disabled.",
      detail: "Use Kie Kling 3.0 or another active video model instead.",
    });
  });

  it("returns 410 for Fal Kling image submit", () => {
    const res = createResponse();

    klingV3ImageToVideoSubmit({ method: "POST" } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal Kling 3.0 image-to-video is disabled.",
      detail: "Use Kie Kling 3.0 or another active video model instead.",
    });
  });

  it("rejects non-POST methods", () => {
    const res = createResponse();

    klingV3TextSubmit({ method: "GET" } as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed." });
  });
});
