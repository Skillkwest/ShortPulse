import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import { sortStudioOutputsByCreatedAtDesc } from "../outputOrdering";

const createOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "1:1",
  model: "Seedream 4.5",
  status: "ready",
  timestamp: "Now",
  ...overrides,
});

describe("outputOrdering", () => {
  it("sorts newest first when every output has a durable createdAt", () => {
    const ordered = sortStudioOutputsByCreatedAtDesc([
      createOutput("oldest", { createdAt: "2026-05-24T10:00:00.000Z" }),
      createOutput("newest", { createdAt: "2026-05-24T12:00:00.000Z" }),
      createOutput("middle", { createdAt: "2026-05-24T11:00:00.000Z" }),
    ]);

    expect(ordered.map((output) => output.id)).toEqual(["newest", "middle", "oldest"]);
  });

  it("keeps valid createdAt rows newest-first and pushes legacy rows after them", () => {
    const ordered = sortStudioOutputsByCreatedAtDesc([
      createOutput("legacy-upload"),
      createOutput("new-generated", { createdAt: "2026-05-24T12:00:00.000Z" }),
      createOutput("legacy-library", { createdAt: "not-a-date" }),
      createOutput("older-generated", { createdAt: "2026-05-24T11:00:00.000Z" }),
    ]);

    expect(ordered.map((output) => output.id)).toEqual([
      "new-generated",
      "older-generated",
      "legacy-upload",
      "legacy-library",
    ]);
  });
});
