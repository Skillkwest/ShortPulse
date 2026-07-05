import { describe, expect, it } from "vitest";
import {
  MEDIA_LIST_EXPANDED_SELECT_COLUMNS,
  MEDIA_LIST_MINIMAL_SELECT_COLUMNS,
} from "../mediaListProfile";

describe("media list profiles", () => {
  it("selects top-level duration seconds for media-library duration badges", () => {
    expect(MEDIA_LIST_MINIMAL_SELECT_COLUMNS).toContain("duration_seconds");
    expect(MEDIA_LIST_EXPANDED_SELECT_COLUMNS).toContain("duration_seconds");
  });
});
