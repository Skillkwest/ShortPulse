import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMotionReferenceVideoLeaseForGeneration,
  releaseMotionReferenceVideoLeasesForGeneration,
  retireMotionReferenceVideoStoragePathForUser,
} from "../motionReferenceVideoAssetLease";

const deleteSignedStorageAssetForUserMock = vi.fn();

type LeaseRow = {
  generation_id: string;
  user_id: string;
  storage_path: string;
  released_at: string | null;
  metadata: Record<string, unknown>;
};

type RetirementRow = {
  user_id: string;
  storage_path: string;
  retired_at: string;
  deleted_at: string | null;
  last_delete_attempt_at: string | null;
  delete_error: string | null;
};

let leaseRows: LeaseRow[] = [];
let retirementRows: RetirementRow[] = [];

const applyFilters = <T extends Record<string, unknown>>(
  rows: T[],
  filters: Array<(row: T) => boolean>
): T[] => rows.filter((row) => filters.every((filter) => filter(row)));

vi.mock("../mediaUploadService", () => ({
  deleteSignedStorageAssetForUser: (...args: unknown[]) =>
    deleteSignedStorageAssetForUserMock(...args),
}));

vi.mock("../api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "motion_reference_video_generation_leases") {
        return {
          select: (_fields: string, options?: { count?: "exact"; head?: boolean }) => {
            const filters: Array<(row: LeaseRow) => boolean> = [];
            const builder = {
              eq(column: keyof LeaseRow, value: unknown) {
                filters.push((row) => row[column] === value);
                return builder;
              },
              is(column: keyof LeaseRow, value: unknown) {
                filters.push((row) => row[column] === value);
                return Promise.resolve({
                  count:
                    options?.count === "exact" ? applyFilters(leaseRows, filters).length : null,
                  data: options?.head ? null : applyFilters(leaseRows, filters),
                  error: null,
                });
              },
            };
            return builder;
          },
          upsert: async (payload: LeaseRow) => {
            const existingIndex = leaseRows.findIndex(
              (row) =>
                row.generation_id === payload.generation_id &&
                row.storage_path === payload.storage_path
            );
            if (existingIndex >= 0) {
              leaseRows[existingIndex] = {
                ...leaseRows[existingIndex],
                ...payload,
              };
            } else {
              leaseRows.push(payload);
            }
            return { error: null };
          },
          update: (updates: Partial<LeaseRow>) => {
            const filters: Array<(row: LeaseRow) => boolean> = [];
            const builder = {
              eq(column: keyof LeaseRow, value: unknown) {
                filters.push((row) => row[column] === value);
                return builder;
              },
              is(column: keyof LeaseRow, value: unknown) {
                filters.push((row) => row[column] === value);
                return {
                  select: async () => {
                    const updatedRows: Array<Pick<LeaseRow, "storage_path">> = [];
                    leaseRows = leaseRows.map((row) => {
                      if (!filters.every((filter) => filter(row))) return row;
                      const nextRow = {
                        ...row,
                        ...updates,
                      };
                      updatedRows.push({ storage_path: nextRow.storage_path });
                      return nextRow;
                    });
                    return {
                      data: updatedRows,
                      error: null,
                    };
                  },
                };
              },
            };
            return builder;
          },
        };
      }

      if (table === "motion_reference_video_retirements") {
        return {
          upsert: async (payload: RetirementRow) => {
            const existingIndex = retirementRows.findIndex(
              (row) => row.user_id === payload.user_id && row.storage_path === payload.storage_path
            );
            if (existingIndex >= 0) {
              retirementRows[existingIndex] = {
                ...retirementRows[existingIndex],
                ...payload,
              };
            } else {
              retirementRows.push(payload);
            }
            return { error: null };
          },
          select: () => {
            const filters: Array<(row: RetirementRow) => boolean> = [];
            const builder = {
              eq(column: keyof RetirementRow, value: unknown) {
                filters.push((row) => row[column] === value);
                return builder;
              },
              is(column: keyof RetirementRow, value: unknown) {
                filters.push((row) => row[column] === value);
                return {
                  limit: async (count: number) => ({
                    data: applyFilters(retirementRows, filters).slice(0, count),
                    error: null,
                  }),
                };
              },
            };
            return builder;
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

describe("motionReferenceVideoAssetLease", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    leaseRows = [];
    retirementRows = [];
    deleteSignedStorageAssetForUserMock.mockResolvedValue(undefined);
  });

  it("creates an active lease from shortpulse motion asset context", async () => {
    await createMotionReferenceVideoLeaseForGeneration({
      generationId: "gen-1",
      userId: "user-1",
      shortpulseContext: {
        motion_reference_asset: {
          storage_path: "user-1/videos/motion-control/ref.mp4",
        },
      },
    });

    expect(leaseRows).toEqual([
      expect.objectContaining({
        generation_id: "gen-1",
        user_id: "user-1",
        storage_path: "user-1/videos/motion-control/ref.mp4",
        released_at: null,
      }),
    ]);
  });

  it("retires a committed motion asset without deleting it immediately", async () => {
    const result = await retireMotionReferenceVideoStoragePathForUser({
      userId: "user-1",
      storagePath: "user-1/videos/motion-control/ref.mp4",
    });

    expect(result).toEqual({
      deleted: false,
      waitingOnLease: false,
    });
    expect(deleteSignedStorageAssetForUserMock).not.toHaveBeenCalled();
    expect(retirementRows[0]?.deleted_at).toBeNull();
    expect(retirementRows[0]?.last_delete_attempt_at).toBeNull();
  });

  it("releases a generation lease without deleting retired motion storage", async () => {
    leaseRows = [
      {
        generation_id: "gen-1",
        user_id: "user-1",
        storage_path: "user-1/videos/motion-control/ref.mp4",
        released_at: null,
        metadata: {},
      },
    ];
    retirementRows = [
      {
        user_id: "user-1",
        storage_path: "user-1/videos/motion-control/ref.mp4",
        retired_at: new Date().toISOString(),
        deleted_at: null,
        last_delete_attempt_at: null,
        delete_error: null,
      },
    ];

    await releaseMotionReferenceVideoLeasesForGeneration({
      generationId: "gen-1",
      userId: "user-1",
    });

    expect(leaseRows[0]?.released_at).toEqual(expect.any(String));
    expect(deleteSignedStorageAssetForUserMock).not.toHaveBeenCalled();
    expect(retirementRows[0]?.deleted_at).toBeNull();
  });

  it("retires a released generation lease for later lifecycle cleanup", async () => {
    leaseRows = [
      {
        generation_id: "gen-1",
        user_id: "user-1",
        storage_path: "user-1/videos/motion-control/ref.mp4",
        released_at: null,
        metadata: {},
      },
    ];

    await releaseMotionReferenceVideoLeasesForGeneration({
      generationId: "gen-1",
      userId: "user-1",
    });

    expect(leaseRows[0]?.released_at).toEqual(expect.any(String));
    expect(retirementRows).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        storage_path: "user-1/videos/motion-control/ref.mp4",
        deleted_at: null,
        last_delete_attempt_at: null,
      }),
    ]);
    expect(deleteSignedStorageAssetForUserMock).not.toHaveBeenCalled();
  });
});
