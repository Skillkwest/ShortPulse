import Link from "next/link";
import { useState } from "react";
import {
  ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH,
  type IssueReportStatus,
} from "../../../lib/issueReports";
import type { AdminIssueReportRow } from "../types";
import { useGuardedBackdropDismiss } from "../../../components/useGuardedBackdropDismiss";
import styles from "../../../styles/admin.module.css";

type AdminReportDetailModalProps = {
  selectedReport: AdminIssueReportRow | null;
  updatingReportId: string | null;
  onClose: () => void;
  onUpdateReport: (
    reportId: string,
    updates: { status?: IssueReportStatus; adminNotes?: string }
  ) => Promise<AdminIssueReportRow | null>;
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const statusLabel = (status: IssueReportStatus): string => {
  if (status === "reviewing") return "Reviewing";
  if (status === "resolved") return "Resolved";
  return "New";
};

export function AdminReportDetailModal({
  selectedReport,
  updatingReportId,
  onClose,
  onUpdateReport,
}: AdminReportDetailModalProps) {
  const backdropDismiss = useGuardedBackdropDismiss<HTMLElement>(onClose, {
    disabled: !selectedReport,
  });
  const [adminNotesDraft, setAdminNotesDraft] = useState(selectedReport?.adminNotes ?? "");

  if (!selectedReport) return null;

  const isUpdating = updatingReportId === selectedReport.id;
  const trimmedDraft = adminNotesDraft.trim();
  const notesDirty = trimmedDraft !== (selectedReport.adminNotes ?? "");
  const remainingCharacters = ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH - adminNotesDraft.length;
  const userHealthHref = selectedReport.userId
    ? `/admin/user-health?lookup=${encodeURIComponent(selectedReport.userId)}&lookupMode=user_id`
    : null;
  const traceHref = selectedReport.userId
    ? `/admin/generation-trace?userId=${encodeURIComponent(selectedReport.userId)}`
    : null;

  return (
    <section
      {...backdropDismiss}
      className={styles.adminModalBackdrop}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.adminModalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.adminSectionHead}>
          <div>
            <p className="eyebrow">Report Detail</p>
            <p className="tiny subdued">{selectedReport.id}</p>
          </div>
          <button type="button" className="ghost-btn mini" onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.adminModalGrid}>
          <div className={styles.errorCell}>
            <span className="tiny subdued">Status</span>
            <span>{statusLabel(selectedReport.status)}</span>
          </div>
          <div className={styles.errorCell}>
            <span className="tiny subdued">Submitted</span>
            <span>{formatDateTime(selectedReport.createdAt)}</span>
          </div>
          <div className={styles.errorCell}>
            <span className="tiny subdued">Reporter email</span>
            <span>{selectedReport.submitterEmail}</span>
          </div>
          <div className={styles.errorCell}>
            <span className="tiny subdued">User id</span>
            <span>{selectedReport.userId ?? "Detached"}</span>
          </div>
        </div>

        <div className={styles.errorCell}>
          <span className="tiny subdued">Message</span>
          <pre className={styles.adminPreBlock}>{selectedReport.message}</pre>
        </div>

        <div className={styles.adminModalGrid}>
          <div className={styles.errorCell}>
            <span className="tiny subdued">Source path</span>
            <span>{selectedReport.sourcePath ?? "Unknown"}</span>
          </div>
          <div className={styles.errorCell}>
            <span className="tiny subdued">User agent</span>
            <span>{selectedReport.userAgent ?? "Unknown"}</span>
          </div>
          <div className={styles.errorCell}>
            <span className="tiny subdued">Last reviewed</span>
            <span>{formatDateTime(selectedReport.reviewedAt)}</span>
          </div>
          <div className={styles.errorCell}>
            <span className="tiny subdued">Reviewer user id</span>
            <span>{selectedReport.reviewedByUserId ?? "Not reviewed yet"}</span>
          </div>
        </div>

        <label className={styles.errorCell}>
          <span className="tiny subdued">Admin notes</span>
          <textarea
            className={styles.reportNotesInput}
            value={adminNotesDraft}
            onChange={(event) => setAdminNotesDraft(event.target.value)}
            maxLength={ISSUE_REPORT_ADMIN_NOTES_MAX_LENGTH}
            rows={5}
            placeholder="Capture what you learned, next actions, or why this was resolved."
          />
          <span className="tiny subdued">{remainingCharacters} characters remaining</span>
        </label>

        <div className={styles.errorActions}>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() =>
              onUpdateReport(selectedReport.id, {
                adminNotes: adminNotesDraft,
              })
            }
            disabled={isUpdating || !notesDirty}
          >
            {isUpdating ? "Saving…" : "Save notes"}
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => onUpdateReport(selectedReport.id, { status: "reviewing" })}
            disabled={isUpdating || selectedReport.status === "reviewing"}
          >
            Mark reviewing
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => onUpdateReport(selectedReport.id, { status: "resolved" })}
            disabled={isUpdating || selectedReport.status === "resolved"}
          >
            Mark resolved
          </button>
          <button
            type="button"
            className="ghost-btn mini"
            onClick={() => onUpdateReport(selectedReport.id, { status: "new" })}
            disabled={isUpdating || selectedReport.status === "new"}
          >
            Reopen as new
          </button>
          {userHealthHref ? (
            <Link href={userHealthHref} className="ghost-btn mini">
              Open user health
            </Link>
          ) : null}
          {traceHref ? (
            <Link href={traceHref} className="ghost-btn mini">
              Open generation trace
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
