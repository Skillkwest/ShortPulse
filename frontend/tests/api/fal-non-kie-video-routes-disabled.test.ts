import { describe, expect, it, vi } from "vitest";
import seedanceSubmit from "../../pages/api/fal/seedance-submit";
import seedanceI2vSubmit from "../../pages/api/fal/seedance-i2v-submit";

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

describe("disabled non-Kie Fal video routes", () => {
  it("returns 410 for Fal Seedance text submit", () => {
    const res = createResponse();

    seedanceSubmit({ method: "POST" } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal Seedance text-to-video is disabled.",
      detail: "Use Kie Veo 3.1 or Kie Kling 3.0 instead.",
    });
  });

  it("returns 410 for Fal Seedance image submit", () => {
    const res = createResponse();

    seedanceI2vSubmit({ method: "POST" } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(410);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal Seedance image-to-video is disabled.",
      detail: "Use Kie Veo 3.1 or Kie Kling 3.0 instead.",
    });
  });

  it("rejects non-POST methods", () => {
    const res = createResponse();

    seedanceSubmit({ method: "GET" } as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed." });
  });
});
