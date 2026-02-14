import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

describe("API proxy protections", () => {
  it("blocks direct /api/_utils/* access", async () => {
    const request = new NextRequest("http://localhost:3000/api/_utils/auth");
    const response = await proxy(request);
    expect(response.status).toBe(404);
  });

  it("keeps auth enforcement for protected API prefixes", async () => {
    const request = new NextRequest("http://localhost:3000/api/fal/status");
    const response = await proxy(request);
    expect(response.status).toBe(401);
  });
});
