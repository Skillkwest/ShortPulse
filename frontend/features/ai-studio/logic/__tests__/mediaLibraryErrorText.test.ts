import { describe, expect, it } from "vitest";
import {
  MEDIA_LIST_AUTH_REQUIRED_CODE,
  MEDIA_LIST_AUTH_SESSION_TIMEOUT_CODE,
  MEDIA_LIST_FORBIDDEN_CODE,
  MEDIA_LIST_SERVER_ERROR_CODE,
} from "../../../media-library/logic/mediaListApi";
import { toMediaLibraryErrorText } from "../mediaLibraryErrorText";

const createError = (code: string, message = "boom") => {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
};

describe("toMediaLibraryErrorText", () => {
  it("maps auth-required media-list failures to sign-in guidance", () => {
    expect(
      toMediaLibraryErrorText(createError(MEDIA_LIST_AUTH_REQUIRED_CODE), "Unable to load media.")
    ).toBe("Sign in again to load the Media Library.");
  });

  it("maps auth-session timeouts to refresh guidance", () => {
    expect(
      toMediaLibraryErrorText(
        createError(MEDIA_LIST_AUTH_SESSION_TIMEOUT_CODE),
        "Unable to load media."
      )
    ).toBe(
      "Media Library session timed out while checking your sign-in. Please refresh and try again."
    );
  });

  it("maps forbidden media-list failures to access guidance", () => {
    expect(
      toMediaLibraryErrorText(createError(MEDIA_LIST_FORBIDDEN_CODE), "Unable to load media.")
    ).toBe("You no longer have access to this Media Library view.");
  });

  it("maps server media-list failures to retry guidance", () => {
    expect(
      toMediaLibraryErrorText(createError(MEDIA_LIST_SERVER_ERROR_CODE), "Unable to load media.")
    ).toBe("Media Library server error. Please retry.");
  });

  it("keeps transient browser fetch failures on the network retry copy", () => {
    expect(toMediaLibraryErrorText(new Error("Failed to fetch"), "Unable to load media.")).toBe(
      "Network issue while contacting the Media Library. Please retry."
    );
  });
});
