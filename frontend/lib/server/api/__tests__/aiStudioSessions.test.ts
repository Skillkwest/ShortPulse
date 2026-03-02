import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decodeAiStudioSessionCursor,
  encodeAiStudioSessionCursor,
  getAiStudioSessionSnapshot,
  listAiStudioSessions,
  parseAiStudioSessionId,
  parseAiStudioSessionSnapshot,
  saveAiStudioSessionSnapshot,
} from "../aiStudioSessions";

const rpcMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

describe("aiStudioSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdminMock.mockReturnValue({
      rpc: (...args: unknown[]) => rpcMock(...args),
    });
  });

  it("parses valid session ids and rejects invalid values", () => {
    expect(parseAiStudioSessionId("f7f45245-f204-4ece-8f9e-c9a66a9d8d2a")).toBe(
      "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a"
    );
    expect(parseAiStudioSessionId("not-a-uuid")).toBeNull();
    expect(parseAiStudioSessionId(123)).toBeNull();
  });

  it("accepts object snapshots and rejects invalid/oversized payloads", () => {
    expect(parseAiStudioSessionSnapshot({ a: 1 })).toEqual({ a: 1 });
    expect(parseAiStudioSessionSnapshot(["x"])).toBeNull();
    const oversized = { data: "x".repeat(950_000) };
    expect(parseAiStudioSessionSnapshot(oversized)).toBeNull();
  });

  it("encodes and decodes cursor payloads", () => {
    const encoded = encodeAiStudioSessionCursor({
      updatedAt: "2026-03-02T00:00:00.000Z",
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
    });
    expect(decodeAiStudioSessionCursor(encoded)?.sessionId).toBe(
      "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a"
    );
    expect(decodeAiStudioSessionCursor("invalid")).toBeNull();
  });

  it("saves snapshots through RPC and maps response shape", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          user_id: "user-1",
          session_id: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
          title: "Session",
          schema_version: 1,
          save_seq: 2,
          updated_at: "2026-03-02T01:00:00.000Z",
          expires_at: "2026-08-29T01:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await saveAiStudioSessionSnapshot({
      userId: "user-1",
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      snapshot: { schemaVersion: 1 },
    });

    expect(result.saveSeq).toBe(2);
    expect(rpcMock).toHaveBeenCalledWith(
      "upsert_ai_studio_session_snapshot",
      expect.objectContaining({
        p_user_id: "user-1",
        p_session_id: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      })
    );
  });

  it("gets snapshots through RPC", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          user_id: "user-1",
          session_id: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
          title: null,
          schema_version: 1,
          save_seq: 4,
          snapshot: { workspace: { mode: "image" } },
          updated_at: "2026-03-02T01:00:00.000Z",
          expires_at: "2026-08-29T01:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await getAiStudioSessionSnapshot({
      userId: "user-1",
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
    });
    expect(result?.snapshot).toEqual({ workspace: { mode: "image" } });
  });

  it("lists sessions through RPC", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          session_id: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
          title: "Session A",
          schema_version: 1,
          save_seq: 3,
          updated_at: "2026-03-02T01:00:00.000Z",
          expires_at: "2026-08-29T01:00:00.000Z",
        },
      ],
      error: null,
    });
    const result = await listAiStudioSessions({
      userId: "user-1",
      limit: 10,
      cursor: {
        updatedAt: "2026-03-03T01:00:00.000Z",
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      },
    });
    expect(result).toHaveLength(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "list_ai_studio_sessions",
      expect.objectContaining({
        p_user_id: "user-1",
        p_limit: 10,
      })
    );
  });
});
