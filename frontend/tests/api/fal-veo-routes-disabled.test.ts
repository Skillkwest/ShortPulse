import { describe, expect, it, vi } from "vitest";
import veoSubmit from "../../pages/api/fal/veo-submit";
import veoImageToVideoSubmit from "../../pages/api/fal/veo-image-to-video-submit";
import veoFirstLastFrameSubmit from "../../pages/api/fal/veo-first-last-frame-submit";

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

describe("disabled Fal Veo API routes", () => {
  it("returns 410 for Fal Veo text submit", () => {
    const res = createResponse();

    veoSubmit({ method: "POST" } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal Veo 3.1 text-to-video is disabled.",
      detail: "Use Kie Veo 3.1 or another active video model instead.",
    });
  });

  it("returns 410 for Fal Veo image submit", () => {
    const res = createResponse();

    veoImageToVideoSubmit({ method: "POST" } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal Veo 3.1 image-to-video is disabled.",
      detail: "Use Kie Veo 3.1 or another active video model instead.",
    });
  });

  it("returns 410 for Fal Veo first-last submit", () => {
    const res = createResponse();

    veoFirstLastFrameSubmit({ method: "POST" } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal Veo 3.1 first-last-frame is disabled.",
      detail: "Use Kie Veo 3.1 or another active video model instead.",
    });
  });

  it("rejects non-POST methods", () => {
    const res = createResponse();

    veoSubmit({ method: "GET" } as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed." });
  });
});
