import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCharacterQuickSwapDeck } from "../useCharacterQuickSwapDeck";
import {
  countQuickSwapArchived,
  listQuickSwapActive,
  listQuickSwapArchived,
  removeQuickSwapItem,
  restoreQuickSwapItem,
} from "../../logic/characterQuickSwapPersistence";
import type { CharacterQuickSwapItem } from "../../types";

vi.mock("../../logic/characterQuickSwapPersistence", () => ({
  appendQuickSwapFiles: vi.fn(),
  countQuickSwapArchived: vi.fn(),
  listQuickSwapActive: vi.fn(),
  listQuickSwapArchived: vi.fn(),
  removeQuickSwapItem: vi.fn(),
  restoreQuickSwapItem: vi.fn(),
}));

const listQuickSwapActiveMock = vi.mocked(listQuickSwapActive);
const listQuickSwapArchivedMock = vi.mocked(listQuickSwapArchived);
const countQuickSwapArchivedMock = vi.mocked(countQuickSwapArchived);
const removeQuickSwapItemMock = vi.mocked(removeQuickSwapItem);
const restoreQuickSwapItemMock = vi.mocked(restoreQuickSwapItem);

const createQuickSwapItem = (
  id: string,
  overrides: Partial<CharacterQuickSwapItem> = {}
): CharacterQuickSwapItem => ({
  id,
  characterMediaId: `media-${id}`,
  storagePath: `user-1/characters/char-1/quickswap/${id}.png`,
  previewUrl: `https://signed.example/${id}.png`,
  status: "active",
  createdAt: `2026-03-17T00:00:0${id.slice(-1)}.000Z`,
  archivedAt: null,
  legacySlotKey: null,
  ...overrides,
});

describe("useCharacterQuickSwapDeck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listQuickSwapActiveMock.mockResolvedValue([
      createQuickSwapItem("item-1"),
      createQuickSwapItem("item-2"),
    ]);
    countQuickSwapArchivedMock.mockResolvedValue(2);
    listQuickSwapArchivedMock.mockResolvedValue({
      items: [
        createQuickSwapItem("item-3", {
          status: "archived",
          archivedAt: "2026-03-17T00:01:00.000Z",
        }),
        createQuickSwapItem("item-4", {
          status: "archived",
          archivedAt: "2026-03-17T00:02:00.000Z",
        }),
      ],
      nextCursor: null,
    });
  });

  it("removes an active item without reloading the full deck", async () => {
    const { result } = renderHook(() => useCharacterQuickSwapDeck({ characterId: "char-1" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.activeItems).toHaveLength(2);
    });

    await act(async () => {
      const ok = await result.current.removeItem("item-1");
      expect(ok).toBe(true);
    });

    expect(removeQuickSwapItemMock).toHaveBeenCalledWith({
      characterId: "char-1",
      itemId: "item-1",
    });
    expect(result.current.activeItems.map((item) => item.id)).toEqual(["item-2"]);
    expect(listQuickSwapActiveMock).toHaveBeenCalledTimes(1);
    expect(countQuickSwapArchivedMock).toHaveBeenCalledTimes(1);
  });

  it("restores an archived item without clearing the loaded archive window", async () => {
    listQuickSwapActiveMock
      .mockResolvedValueOnce([createQuickSwapItem("item-1")])
      .mockResolvedValueOnce([
        createQuickSwapItem("item-3", { status: "active", archivedAt: null }),
        createQuickSwapItem("item-1"),
      ]);
    countQuickSwapArchivedMock.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const { result } = renderHook(() => useCharacterQuickSwapDeck({ characterId: "char-1" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.loadMoreArchived();
    });

    expect(result.current.archivedItems.map((item) => item.id)).toEqual(["item-3", "item-4"]);

    await act(async () => {
      const ok = await result.current.restoreItem("item-3");
      expect(ok).toBe(true);
    });

    expect(restoreQuickSwapItemMock).toHaveBeenCalledWith({
      characterId: "char-1",
      itemId: "item-3",
    });
    expect(result.current.activeItems.map((item) => item.id)).toEqual(["item-3", "item-1"]);
    expect(result.current.archivedItems.map((item) => item.id)).toEqual(["item-4"]);
    expect(result.current.archivedCount).toBe(1);
  });
});
