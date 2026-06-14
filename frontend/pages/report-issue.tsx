/**
 * Signed-in issue intake page for sending user reports into the admin review queue.
 */
import Head from "next/head";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { AppMessage } from "../components/AppMessage";
import { ISSUE_REPORT_MESSAGE_MAX_LENGTH, resolveIssueReportSourcePath } from "../lib/issueReports";
import { fetchWithAuth } from "../lib/authenticatedFetch";
import { useProtectedRoute } from "../lib/authGuard";
import styles from "../styles/report-issue.module.css";

type SubmitState = {
  kind: "idle" | "success" | "error";
  message: string | null;
};

export default function ReportIssuePage() {
  const router = useRouter();
  const { loading, user } = useProtectedRoute(true);
  const [message, setMessage] = useState("");
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
      const response = await fetchWithAuth("/api/report-issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          sourcePath: capturedContext,
        }),
      });

      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        throw new Error(details?.error || "Unable to send your report right now.");
      }

      setMessage("");
      setSubmitState({
        kind: "success",
        message: "Report sent. It is now in the admin Reports queue.",
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
