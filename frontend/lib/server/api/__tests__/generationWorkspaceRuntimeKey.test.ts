import { describe, expect, it } from "vitest";
import {
  readGenerationWorkspaceRuntimeKeyFromContext,
  readGenerationWorkspaceRuntimeKeyFromMetadata,
} from "../generationWorkspaceRuntimeKey";

describe("generationWorkspaceRuntimeKey", () => {
  it("reads plain-session workspace keys from shortpulse context", () => {
    expect(
      readGenerationWorkspaceRuntimeKeyFromContext({
        context: {
          workspace_runtime_key: "session:session-1",
        },
      })
    ).toBe("session:session-1");
  });

  it("suppresses workspace keys when a project id is present", () => {
    expect(
      readGenerationWorkspaceRuntimeKeyFromContext({
        context: {
          project_id: "project-1",
          workspace_runtime_key: "session:session-1",
        },
      })
    ).toBeNull();
  });

  it("reads mirrored metadata keys for terminal convergence", () => {
    expect(
      readGenerationWorkspaceRuntimeKeyFromMetadata({
        workspace_runtime_key: "session:metadata-1",
      })
    ).toBe("session:metadata-1");
  });
});
