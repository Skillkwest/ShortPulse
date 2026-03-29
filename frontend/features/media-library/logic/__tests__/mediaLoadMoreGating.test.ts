import { describe, expect, it } from "vitest";
import {
  canRequestLoadMore,
  shouldAutoLoadFromObserver,
  shouldAutoLoadNearBottom,
  shouldEnableObserverLoadMore,
} from "../mediaLoadMoreGating";

describe("mediaLoadMoreGating", () => {
  it("blocks load-more requests when loading, exhausted, or already in flight", () => {
    expect(canRequestLoadMore({ hasMore: true, loading: false })).toBe(true);
    expect(canRequestLoadMore({ hasMore: false, loading: false })).toBe(false);
    expect(canRequestLoadMore({ hasMore: true, loading: true })).toBe(false);
    expect(canRequestLoadMore({ hasMore: true, inFlight: true, loading: false })).toBe(false);
  });

  it("enables observer auto-load only when the surface is fetch-ready", () => {
    expect(
      shouldEnableObserverLoadMore({
        fetchEnabled: true,
        hasMore: true,
        loaded: true,
        loading: false,
      })
    ).toBe(true);
    expect(
      shouldEnableObserverLoadMore({
        fetchEnabled: false,
        hasMore: true,
        loaded: true,
        loading: false,
      })
    ).toBe(false);
    expect(
      shouldEnableObserverLoadMore({
        fetchEnabled: true,
        hasMore: false,
        loaded: true,
        loading: false,
      })
    ).toBe(false);
    expect(
      shouldEnableObserverLoadMore({
        fetchEnabled: true,
        hasMore: true,
        loaded: false,
        loading: false,
      })
    ).toBe(false);
  });

  it("requires observer intent, exit reset, and cooldown before auto-loading", () => {
    expect(
      shouldAutoLoadFromObserver({
        awaitExit: false,
        cooldownMs: 450,
        fetchEnabled: true,
        hasMore: true,
        lastAutoLoadAtMs: 100,
        loaded: true,
        loading: false,
        now: 600,
        scrollIntentArmed: true,
      })
    ).toBe(true);
    expect(
      shouldAutoLoadFromObserver({
        awaitExit: true,
        cooldownMs: 450,
        fetchEnabled: true,
        hasMore: true,
        lastAutoLoadAtMs: 100,
        loaded: true,
        loading: false,
        now: 600,
        scrollIntentArmed: true,
      })
    ).toBe(false);
    expect(
      shouldAutoLoadFromObserver({
        awaitExit: false,
        cooldownMs: 450,
        fetchEnabled: true,
        hasMore: true,
        lastAutoLoadAtMs: 300,
        loaded: true,
        loading: false,
        now: 600,
        scrollIntentArmed: false,
      })
    ).toBe(false);
    expect(
      shouldAutoLoadFromObserver({
        awaitExit: false,
        cooldownMs: 450,
        fetchEnabled: true,
        hasMore: true,
        lastAutoLoadAtMs: 300,
        loaded: true,
        loading: false,
        now: 600,
        scrollIntentArmed: true,
      })
    ).toBe(false);
  });

  it("only auto-loads panel rows when near the bottom and not blocked", () => {
    expect(
      shouldAutoLoadNearBottom({
        clientHeight: 400,
        hasMore: true,
        loading: false,
        scrollHeight: 1000,
        scrollTop: 650,
        surfaceBlocked: false,
        thresholdPx: 220,
      })
    ).toBe(true);
    expect(
      shouldAutoLoadNearBottom({
        clientHeight: 400,
        hasMore: true,
        loading: false,
        scrollHeight: 1000,
        scrollTop: 200,
        surfaceBlocked: false,
        thresholdPx: 220,
      })
    ).toBe(false);
    expect(
      shouldAutoLoadNearBottom({
        clientHeight: 400,
        hasMore: true,
        inFlight: true,
        loading: false,
        scrollHeight: 1000,
        scrollTop: 650,
        surfaceBlocked: false,
        thresholdPx: 220,
      })
    ).toBe(false);
    expect(
      shouldAutoLoadNearBottom({
        clientHeight: 400,
        hasMore: true,
        loading: false,
        scrollHeight: 1000,
        scrollTop: 650,
        surfaceBlocked: true,
        thresholdPx: 220,
      })
    ).toBe(false);
  });
});
