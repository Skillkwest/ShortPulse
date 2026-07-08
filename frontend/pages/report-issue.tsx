/**
 * Signed-in issue intake page for sending user reports into the admin review queue.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AppMessage } from "../components/AppMessage";
import {
  ISSUE_REPORT_MESSAGE_MAX_LENGTH,
  ISSUE_REPORT_SCREENSHOT_BUCKET,
  ISSUE_REPORT_SCREENSHOT_MAX_BYTES,
  ISSUE_REPORT_SCREENSHOT_MAX_COUNT,
  ISSUE_REPORT_SCREENSHOT_MIME_TYPES,
  isIssueReportScreenshotMimeType,
  resolveIssueReportSourcePath,
} from "../lib/issueReports";
import { fetchWithAuth } from "../lib/authenticatedFetch";
import { useProtectedRoute } from "../lib/authGuard";
import { ensureSupabaseQueryClient } from "../lib/supabaseClient";
import styles from "../styles/report-issue.module.css";

type SubmitState = {
  kind: "idle" | "success" | "error";
  message: string | null;
};

type ScreenshotDraft = {
  id: string;
  file: File;
  previewUrl: string;
};

type PreparedScreenshotUploadTarget = {
  storagePath: string;
  uploadToken: string;
  mimeType: (typeof ISSUE_REPORT_SCREENSHOT_MIME_TYPES)[number];
  maxBytes: number;
};

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
};

const createScreenshotDraftId = (file: File): string => {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${file.name}-${file.lastModified}-${randomId}`;
};

const readResponseError = async (response: Response, fallback: string): Promise<string> => {
  const details = await response.json().catch(() => ({}));
  return typeof details?.error === "string" ? details.error : fallback;
};

const asPreparedScreenshotUploadTarget = (
  value: unknown
): PreparedScreenshotUploadTarget | null => {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  if (!record) return null;
  const storagePath = typeof record.storagePath === "string" ? record.storagePath : "";
  const uploadToken = typeof record.uploadToken === "string" ? record.uploadToken : "";
  const mimeType = isIssueReportScreenshotMimeType(record.mimeType) ? record.mimeType : null;
  const maxBytes = Number(record.maxBytes);
  if (!storagePath || !uploadToken || !mimeType || !Number.isFinite(maxBytes)) return null;
  return {
    storagePath,
    uploadToken,
    mimeType,
    maxBytes,
  };
};

export default function ReportIssuePage() {
  const router = useRouter();
  const { loading, user } = useProtectedRoute(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const screenshotsRef = useRef<ScreenshotDraft[]>([]);
  const [message, setMessage] = useState("");
  const [screenshots, setScreenshots] = useState<ScreenshotDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({
    kind: "idle",
    message: null,
  });

  const remainingCharacters = ISSUE_REPORT_MESSAGE_MAX_LENGTH - message.length;
  const capturedContext = resolveIssueReportSourcePath({
    currentPath: router.asPath || "/report-issue",
    sourcePath: router.query.sourcePath,
    from: router.query.from,
    referrer: typeof document !== "undefined" ? document.referrer : null,
    origin: typeof window !== "undefined" ? window.location.origin : null,
  });

  useEffect(() => {
    screenshotsRef.current = screenshots;
  }, [screenshots]);

  useEffect(
    () => () => {
      screenshotsRef.current.forEach((screenshot) => URL.revokeObjectURL(screenshot.previewUrl));
    },
    []
  );

  const handleScreenshotSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    if (!selectedFiles.length) return;

    const nextScreenshots = [...screenshots];
    for (const file of selectedFiles) {
      if (nextScreenshots.length >= ISSUE_REPORT_SCREENSHOT_MAX_COUNT) {
        setSubmitState({
          kind: "error",
          message: `Issue reports can include up to ${ISSUE_REPORT_SCREENSHOT_MAX_COUNT} screenshots.`,
        });
        break;
      }
      if (!isIssueReportScreenshotMimeType(file.type)) {
        setSubmitState({
          kind: "error",
          message: "Use PNG, JPEG, WebP, or GIF screenshots.",
        });
        continue;
      }
      if (file.size > ISSUE_REPORT_SCREENSHOT_MAX_BYTES) {
        setSubmitState({
          kind: "error",
          message: "One of the selected screenshots is too large.",
        });
        continue;
      }

      nextScreenshots.push({
        id: createScreenshotDraftId(file),
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setScreenshots(nextScreenshots);
    event.target.value = "";
  };

  const removeScreenshot = (id: string) => {
    setScreenshots((current) => {
      const target = current.find((screenshot) => screenshot.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((screenshot) => screenshot.id !== id);
    });
  };

  const uploadScreenshots = async () => {
    if (!screenshots.length) return [];
    const supabase = ensureSupabaseQueryClient();
    const uploadedScreenshots = [];

    for (const screenshot of screenshots) {
      const prepareResponse = await fetchWithAuth("/api/report-issue/screenshots/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceMimeType: screenshot.file.type,
          sourceSize: screenshot.file.size,
        }),
      });
      if (!prepareResponse.ok) {
        throw new Error(
          await readResponseError(prepareResponse, "Unable to prepare screenshot upload.")
        );
      }

      const preparePayload = (await prepareResponse.json().catch(() => ({}))) as {
        target?: unknown;
      };
      const target = asPreparedScreenshotUploadTarget(preparePayload.target);
      if (!target) {
        throw new Error("Screenshot upload preparation returned an invalid target.");
      }

      const uploadResult = await supabase.storage
        .from(ISSUE_REPORT_SCREENSHOT_BUCKET)
        .uploadToSignedUrl(target.storagePath, target.uploadToken, screenshot.file, {
          contentType: target.mimeType,
          upsert: false,
        });
      if (uploadResult.error) {
        throw new Error(uploadResult.error.message || "Unable to upload screenshot.");
      }

      uploadedScreenshots.push({
        storagePath: target.storagePath,
        sourceName: screenshot.file.name,
        sourceMimeType: target.mimeType,
        sourceSize: screenshot.file.size,
      });
    }

    return uploadedScreenshots;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setSubmitState({
        kind: "error",
        message: "Please describe the issue you ran into before sending the report.",
      });
      return;
    }

    setSubmitting(true);
    setSubmitState({
      kind: "idle",
      message: null,
    });

    try {
      const uploadedScreenshots = await uploadScreenshots();
      const response = await fetchWithAuth("/api/report-issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          sourcePath: capturedContext,
          screenshots: uploadedScreenshots,
        }),
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response, "Unable to send your report right now."));
      }

      setMessage("");
      screenshots.forEach((screenshot) => URL.revokeObjectURL(screenshot.previewUrl));
      setScreenshots([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSubmitState({
        kind: "success",
        message: "Report sent. We saved your note and context for review.",
      });
    } catch (error) {
      setSubmitState({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to send your report right now.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>ShortPulse · Report an issue</title>
        <meta
          name="description"
          content="Signed-in issue reporting for problems, broken flows, and account issues."
        />
      </Head>
      <main className="page">
        <section className={styles.reportShell}>
          <div className={styles.reportHeader}>
            <h1 className={styles.reportTitle}>Report an issue</h1>
            <p className={styles.reportIntro}>
              Tell us what broke or felt confusing. We attach your signed-in account and route
              context automatically.
            </p>
          </div>

          <div className={styles.reportCard}>
            {loading ? (
              <p className="subdued">Checking your session…</p>
            ) : (
              <form className={styles.reportForm} onSubmit={handleSubmit}>
                <div className={styles.reportMetaRow} aria-label="Report context">
                  <span>
                    <strong>Signed-in email:</strong> {user?.email ?? "Unknown account"}
                  </span>
                  <span>
                    <strong>Captured context:</strong>{" "}
                    {capturedContext === "/report-issue" ? "Current page" : capturedContext}
                  </span>
                </div>

                <label className={styles.reportField}>
                  <span>What went wrong?</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={ISSUE_REPORT_MESSAGE_MAX_LENGTH}
                    rows={9}
                    placeholder="What happened? What did you expect? Add any steps that would help reproduce it."
                  />
                </label>

                <label className={styles.reportField}>
                  <span>Screenshots</span>
                  <input
                    ref={fileInputRef}
                    className={styles.screenshotInput}
                    type="file"
                    accept={ISSUE_REPORT_SCREENSHOT_MIME_TYPES.join(",")}
                    multiple
                    onChange={handleScreenshotSelection}
                    disabled={submitting}
                  />
                </label>

                {screenshots.length > 0 ? (
                  <div className={styles.screenshotGrid} aria-label="Selected screenshots">
                    {screenshots.map((screenshot) => (
                      <div key={screenshot.id} className={styles.screenshotItem}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- Local object URL previews must render directly before upload. */}
                        <img
                          src={screenshot.previewUrl}
                          alt=""
                          className={styles.screenshotThumb}
                        />
                        <div className={styles.screenshotMeta}>
                          <strong>{screenshot.file.name}</strong>
                          <span className="tiny subdued">{formatBytes(screenshot.file.size)}</span>
                        </div>
                        <button
                          type="button"
                          className="ghost-btn mini"
                          onClick={() => removeScreenshot(screenshot.id)}
                          disabled={submitting}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className={styles.reportFooter}>
                  <span className="tiny subdued">{remainingCharacters} characters remaining</span>
                  <button type="submit" className="ghost-btn" disabled={submitting || loading}>
                    {submitting ? "Sending…" : "Send report"}
                  </button>
                </div>

                {submitState.kind !== "idle" && submitState.message ? (
                  <AppMessage
                    className={
                      submitState.kind === "success" ? styles.successMessage : styles.errorMessage
                    }
                    tone={submitState.kind === "success" ? "success" : "error"}
                    mode="banner"
                    message={submitState.message}
                  />
                ) : null}
              </form>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
