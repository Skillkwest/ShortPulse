import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeCandidateRow,
  parseArgs,
  resolveSupabaseRuntimeEnv,
} from "../backfill_dashboard_tutorial_thumbnail_derivatives.mjs";

describe("backfill_dashboard_tutorial_thumbnail_derivatives", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses dry-run defaults and force apply mode", () => {
    expect(parseArgs([])).toEqual(
      expect.objectContaining({
        apply: false,
        force: false,
        environment: null,
        limit: 25,
        timeoutMs: 120000,
        tutorialId: null,
      })
    );

    expect(
      parseArgs([
        "--force",
        "--apply",
        "--limit",
        "3",
        "--tutorial-id",
        "067d924e-6861-464d-bfe0-f41f30a0e6d5",
        "--confirm-project-id",
        "ftgrqgjrchpimronuhop",
        "--environment",
        "production",
      ])
    ).toEqual(
      expect.objectContaining({
        apply: true,
        force: true,
        environment: "production",
        limit: 3,
        tutorialId: "067d924e-6861-464d-bfe0-f41f30a0e6d5",
        confirmProjectId: "ftgrqgjrchpimronuhop",
      })
    );
  });

  it("skips existing derivatives by default and includes them when forced", () => {
    const row = {
      id: "tutorial-1",
      title: "Using Frames",
      thumbnail_storage_path: "tutorial-thumbnails/source.mp4",
      thumbnail_content_type: "video/mp4",
      thumbnail_display_storage_path: "tutorial-thumbnail-variants/old/display.mp4",
      thumbnail_poster_storage_path: "tutorial-thumbnail-variants/old/poster.jpg",
    };

    expect(normalizeCandidateRow(row)).toBeNull();
    expect(normalizeCandidateRow(row, { force: true })).toEqual({
      id: "tutorial-1",
      title: "Using Frames",
      sourcePath: "tutorial-thumbnails/source.mp4",
      sourceContentType: "video/mp4",
      existingDisplayPath: "tutorial-thumbnail-variants/old/display.mp4",
      existingPosterPath: "tutorial-thumbnail-variants/old/poster.jpg",
    });
  });

  it("resolves explicit production scoped Supabase env without using unscoped defaults", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://staging.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "staging-service-role");
    vi.stubEnv("SHORTPULSE_PRODUCTION_SUPABASE_URL", "https://production.supabase.co");
    vi.stubEnv("SHORTPULSE_PRODUCTION_SUPABASE_SERVICE_ROLE_KEY", "production-service-role");

    expect(resolveSupabaseRuntimeEnv("production")).toEqual({
      supabaseUrl: "https://production.supabase.co",
      serviceRoleKey: "production-service-role",
      environment: "production",
    });
  });
});
