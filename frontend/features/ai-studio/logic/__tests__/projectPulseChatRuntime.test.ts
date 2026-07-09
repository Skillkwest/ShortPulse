import { describe, expect, it } from "vitest";
import {
  shouldPatchProjectPulseChats,
  shouldShowProjectPulseChatHistory,
} from "../projectPulseChatRuntime";

describe("projectPulseChatRuntime", () => {
  describe("shouldShowProjectPulseChatHistory", () => {
    it("keeps the Pulse Chats rail visible for project routes before any chats exist", () => {
      expect(
        shouldShowProjectPulseChatHistory({
          projectRouteRequested: true,
          projectId: null,
          threadCount: 0,
        })
      ).toBe(true);
    });

    it("keeps the Pulse Chats rail visible when project identity is resolved", () => {
      expect(
        shouldShowProjectPulseChatHistory({
          projectRouteRequested: false,
          projectId: "project-1",
          threadCount: 0,
        })
      ).toBe(true);
    });

    it("keeps existing saved chats reachable even if route identity is temporarily missing", () => {
      expect(
        shouldShowProjectPulseChatHistory({
          projectRouteRequested: false,
          projectId: null,
          threadCount: 1,
        })
      ).toBe(true);
    });
  });

  describe("shouldPatchProjectPulseChats", () => {
    it("blocks unhydrated empty state from clearing saved Pulse chats", () => {
      expect(
        shouldPatchProjectPulseChats({
          projectAuthorityKey: "project-1",
          hydratedProjectAuthorityKey: null,
          threadCount: 0,
        })
      ).toBe(false);
    });

    it("allows an empty hydrated project state to intentionally clear Pulse chats", () => {
      expect(
        shouldPatchProjectPulseChats({
          projectAuthorityKey: "project-1",
          hydratedProjectAuthorityKey: "project-1",
          threadCount: 0,
        })
      ).toBe(true);
    });

    it("allows non-empty local chat state to persist even before hydration completes", () => {
      expect(
        shouldPatchProjectPulseChats({
          projectAuthorityKey: "project-1",
          hydratedProjectAuthorityKey: null,
          threadCount: 1,
        })
      ).toBe(true);
    });

    it("does not treat null authority as hydrated", () => {
      expect(
        shouldPatchProjectPulseChats({
          projectAuthorityKey: null,
          hydratedProjectAuthorityKey: null,
          threadCount: 0,
        })
      ).toBe(false);
    });
  });
});
