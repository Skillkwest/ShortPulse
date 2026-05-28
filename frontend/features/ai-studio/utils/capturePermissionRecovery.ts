/**
 * Best-effort helpers for opening OS privacy settings when camera or microphone
 * access is blocked during browser capture flows.
 */

export type CapturePermissionRecoveryTarget = "camera" | "microphone";

const resolveCaptureSettingsUrl = (target: CapturePermissionRecoveryTarget): string | null => {
  if (typeof navigator === "undefined") {
    return null;
  }

  const userAgent = navigator.userAgent;
  const isMacDesktop =
    /Macintosh|Mac OS X/i.test(userAgent) && !/iPhone|iPad|iPod/i.test(userAgent);
  const isWindows = /Windows/i.test(userAgent);

  if (isMacDesktop) {
    return target === "camera"
      ? "x-apple.systempreferences:com.apple.preference.security?Privacy_Camera"
      : "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone";
  }

  if (isWindows) {
    return target === "camera" ? "ms-settings:privacy-webcam" : "ms-settings:privacy-microphone";
  }

  return null;
};

/**
 * Attempts to open the platform privacy settings page for the blocked target.
 *
 * Inputs: blocked camera or microphone target.
 * Outputs: true when a supported settings URI was attempted, otherwise false.
 * Side effects: asks the browser/OS to launch an external settings target.
 */
export function attemptOpenCapturePermissionSettings(
  target: CapturePermissionRecoveryTarget
): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const settingsUrl = resolveCaptureSettingsUrl(target);
  if (!settingsUrl) {
    return false;
  }

  try {
    window.open(settingsUrl, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}
