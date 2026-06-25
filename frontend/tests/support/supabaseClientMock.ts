import { vi } from "vitest";

type SupabaseSessionMock = {
  user?: {
    id?: string | null;
  } | null;
  access_token?: string | null;
} | null;

export const createSupabaseSessionMock = (
  userId: string | null = "user-1",
  overrides: Partial<Exclude<SupabaseSessionMock, null>> = {}
): SupabaseSessionMock => {
  if (!userId) return null;
  return {
    user: {
      id: userId,
    },
    access_token: null,
    ...overrides,
  };
};

export const createSupabaseClientModuleMock = () => ({
  supabaseClient: null,
  supabaseQueryClient: null,
  ensureSupabaseClient: vi.fn(),
  ensureSupabaseQueryClient: vi.fn(),
  readSupabaseSession: vi.fn(async () => null),
  primeSupabaseSession: vi.fn(),
  clearSupabaseSessionSnapshot: vi.fn(),
  refreshSupabaseSession: vi.fn(async () => null),
  signOutSupabaseSession: vi.fn(async () => undefined),
  readSupabaseUser: vi.fn(async () => null),
  readSupabaseUserId: vi.fn(async () => null),
  readSupabaseAccessToken: vi.fn(async () => null),
  useSupabaseSessionState: vi.fn(() => ({
    initialized: true,
    session: null,
    user: null,
  })),
  isSupabaseAbortError: (error: unknown) =>
    error instanceof Error && error.message.toLowerCase().includes("signal is aborted"),
});
