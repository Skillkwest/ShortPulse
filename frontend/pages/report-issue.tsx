import Head from "next/head";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
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
        message: "Your report was sent to the ShortPulse admins. Thank you.",
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
            <p className="eyebrow">Support</p>
            <h1 className={styles.reportTitle}>Report an issue</h1>
            <p className="subdued">
              Send a note directly to the ShortPulse admin review queue if something is broken,
              confusing, or blocking your work.
            </p>
          </div>

          <div className={styles.reportCard}>
            {loading ? (
              <p className="subdued">Checking your session…</p>
            ) : (
              <form className={styles.reportForm} onSubmit={handleSubmit}>
                <div className={styles.reportMetaRow}>
                  <div className={styles.metaCard}>
                    <span className="tiny subdued">Signed-in email</span>
                    <strong>{user?.email ?? "Unknown account"}</strong>
                  </div>
                  <div className={styles.metaCard}>
                    <span className="tiny subdued">Captured context</span>
                    <strong>
                      {capturedContext === "/report-issue" ? "Current page" : capturedContext}
                    </strong>
                    <span className="tiny subdued">
                      We attach the ShortPulse route context we can verify for triage.
                    </span>
                  </div>
                </div>

                <label className={styles.reportField}>
                  <span>What went wrong?</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    maxLength={ISSUE_REPORT_MESSAGE_MAX_LENGTH}
                    rows={8}
                    placeholder="Tell us what happened, what you expected, and anything else that might help us reproduce it."
                  />
                </label>

                <div className={styles.reportFooter}>
                  <span className="tiny subdued">{remainingCharacters} characters remaining</span>
                  <button type="submit" className="ghost-btn" disabled={submitting || loading}>
                    {submitting ? "Sending…" : "Send report"}
                  </button>
                </div>

                {submitState.kind !== "idle" && submitState.message ? (
                  <p
                    className={
                      submitState.kind === "success" ? styles.successMessage : styles.errorMessage
                    }
                  >
                    {submitState.message}
                  </p>
                ) : null}
              </form>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
