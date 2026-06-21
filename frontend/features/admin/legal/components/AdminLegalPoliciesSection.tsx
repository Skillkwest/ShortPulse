/**
 * Admin Legal workspace section.
 * Renders policy selection, draft editing, text upload, preview, publication controls, and history.
 */
import { useRef, type ChangeEvent } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  ClockCounterClockwise,
  FileText,
  FloppyDisk,
  UploadSimple,
} from "phosphor-react";
import { AppMessage } from "../../../../components/AppMessage";
import { LEGAL_POLICY_SOURCES, type LegalPolicySlug } from "../../../legal/data/legalPolicies";
import {
  parseLegalPolicyMarkdown,
  type LegalPolicyBlock,
} from "../../../legal/logic/markdownPolicyParser";
import adminStyles from "../../../../styles/admin.module.css";
import legalStyles from "../../../../styles/admin-legal.module.css";
import type { AdminLegalPolicyDocument } from "../types";

type AdminLegalPoliciesSectionProps = {
  documents: AdminLegalPolicyDocument[];
  selectedSlug: LegalPolicySlug;
  selectedDocument: AdminLegalPolicyDocument | null;
  draftMarkdown: string;
  publishNote: string;
  loading: boolean;
  publishing: boolean;
  uploadReading: boolean;
  error: string | null;
  result: string | null;
  onSelectSlug: (slug: LegalPolicySlug) => void;
  onChangeDraftMarkdown: (markdown: string) => void;
  onChangePublishNote: (note: string) => void;
  onRefresh: () => void;
  onResetDraft: () => void;
  onReadUploadFile: (file: File) => void;
  onPublish: () => void;
};

const formatPolicyTime = (value: string | null): string => {
  if (!value) return "Not published";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const renderPreviewBlock = (block: LegalPolicyBlock) => {
  if (block.type === "heading") {
    const HeadingTag = block.level === 2 ? "h3" : "h4";
    return (
      <HeadingTag key={block.id} id={`preview-${block.id}`}>
        {block.text}
      </HeadingTag>
    );
  }

  if (block.type === "list") {
    return (
      <ul key={block.id}>
        {block.items.map((item, index) => (
          <li key={`${block.id}-${index}`}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "table") {
    return (
      <div key={block.id} className={legalStyles.previewTableScroll}>
        <table className={legalStyles.previewTable}>
          <thead>
            <tr>
              {block.headers.map((header, index) => (
                <th key={`${block.id}-header-${index}`}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`${block.id}-row-${rowIndex}`}>
                {block.headers.map((_, cellIndex) => (
                  <td key={`${block.id}-row-${rowIndex}-${cellIndex}`}>{row[cellIndex] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <p key={block.id}>{block.text}</p>;
};

/**
 * Renders the admin Legal policy workspace.
 */
export function AdminLegalPoliciesSection({
  documents,
  selectedSlug,
  selectedDocument,
  draftMarkdown,
  publishNote,
  loading,
  publishing,
  uploadReading,
  error,
  result,
  onSelectSlug,
  onChangeDraftMarkdown,
  onChangePublishNote,
  onRefresh,
  onResetDraft,
  onReadUploadFile,
  onPublish,
}: AdminLegalPoliciesSectionProps) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const parsedDraft = parseLegalPolicyMarkdown(draftMarkdown);
  const selectedPolicy = LEGAL_POLICY_SOURCES[selectedSlug];
  const draftChanged = Boolean(selectedDocument && draftMarkdown !== selectedDocument.markdown);
  const actionLocked = loading || publishing || uploadReading;
  const hasDocuments = documents.length > 0 && Boolean(selectedDocument);

  const handleUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (file) {
      onReadUploadFile(file);
    }
  };

  return (
    <section className={adminStyles.adminSection}>
      <div className={adminStyles.adminSectionHead}>
        <div>
          <p className="eyebrow">Legal documents</p>
          <h2 className={adminStyles.adminSectionTitle}>Policy control plane</h2>
        </div>
        <button
          type="button"
          className="ghost-btn mini"
          onClick={onRefresh}
          disabled={actionLocked}
        >
          <ArrowClockwise size={15} weight="bold" aria-hidden />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? <AppMessage tone="error" mode="inline" message={error} /> : null}
      {result ? <AppMessage tone="success" mode="inline" message={result} /> : null}

      {loading && documents.length === 0 ? (
        <div className={legalStyles.statePanel} role="status">
          Loading legal documents...
        </div>
      ) : null}

      {!loading && !hasDocuments && !error ? (
        <div className={legalStyles.statePanel} role="status">
          No legal documents are available.
        </div>
      ) : null}

      {hasDocuments ? (
        <>
          <div className={legalStyles.policyCards} aria-label="Legal policy documents">
            {documents.map((document) => {
              const policy = LEGAL_POLICY_SOURCES[document.slug];
              const active = document.slug === selectedSlug;
              return (
                <button
                  type="button"
                  key={document.slug}
                  className={[
                    legalStyles.policyCard,
                    active ? legalStyles.policyCardActive : "",
                    document.degraded ? legalStyles.policyCardWarning : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => onSelectSlug(document.slug)}
                  aria-pressed={active}
                >
                  <span className={legalStyles.policyCardIcon}>
                    <FileText size={18} weight="bold" aria-hidden />
                  </span>
                  <span className={legalStyles.policyCardBody}>
                    <span className={legalStyles.policyCardTitle}>{policy.documentTitle}</span>
                    <span className={legalStyles.policyCardMeta}>
                      {document.version ? `v${document.version}` : "Seed"} ·{" "}
                      {document.degraded ? "Degraded" : document.source}
                    </span>
                    <span className={legalStyles.policyCardMeta}>
                      {formatPolicyTime(document.updatedAt)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className={legalStyles.workspaceGrid}>
            <div className={legalStyles.editorPanel}>
              <div className={legalStyles.panelHeader}>
                <div className={legalStyles.panelTitleGroup}>
                  <p className={adminStyles.adminSectionEyebrow}>Draft</p>
                  <h3>{selectedPolicy.documentTitle}</h3>
                  <span
                    className={[
                      legalStyles.statusPill,
                      draftChanged ? legalStyles.statusPillDirty : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {draftChanged ? "Unsaved changes" : "Live copy"}
                  </span>
                </div>
                <Link
                  href={selectedPolicy.routePath}
                  className="ghost-btn mini"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open live page
                </Link>
              </div>

              <label className={legalStyles.field}>
                <span className="tiny subdued">Markdown</span>
                <textarea
                  className={legalStyles.markdownEditor}
                  value={draftMarkdown}
                  onChange={(event) => onChangeDraftMarkdown(event.target.value)}
                  disabled={actionLocked}
                  spellCheck={false}
                />
              </label>

              <label className={legalStyles.field}>
                <span className="tiny subdued">Publish note</span>
                <input
                  className={legalStyles.noteInput}
                  type="text"
                  value={publishNote}
                  onChange={(event) => onChangePublishNote(event.target.value)}
                  maxLength={400}
                  disabled={actionLocked}
                />
              </label>

              <div className={legalStyles.actionRow}>
                <input
                  ref={uploadInputRef}
                  className={legalStyles.fileInput}
                  type="file"
                  accept=".md,.markdown,.txt,text/markdown,text/plain"
                  onChange={handleUploadChange}
                />
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={actionLocked}
                >
                  <UploadSimple size={15} weight="bold" aria-hidden />
                  {uploadReading ? "Reading..." : "Upload text"}
                </button>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={onResetDraft}
                  disabled={actionLocked || !selectedDocument || !draftChanged}
                >
                  <ClockCounterClockwise size={15} weight="bold" aria-hidden />
                  Reset to live
                </button>
                <button
                  type="button"
                  className={`ghost-btn mini ${legalStyles.publishButton}`}
                  onClick={onPublish}
                  disabled={actionLocked || !selectedDocument || !draftChanged}
                >
                  <FloppyDisk size={15} weight="bold" aria-hidden />
                  {publishing ? "Publishing..." : "Publish update"}
                </button>
              </div>
            </div>

            <div className={legalStyles.previewPanel}>
              <div className={legalStyles.panelHeader}>
                <div>
                  <p className={adminStyles.adminSectionEyebrow}>Preview</p>
                  <h3>{parsedDraft.title || selectedPolicy.documentTitle}</h3>
                </div>
                {selectedDocument ? (
                  <span className={legalStyles.versionPill}>
                    {selectedDocument.version ? `Live v${selectedDocument.version}` : "Seed"}
                  </span>
                ) : null}
              </div>
              <div className={legalStyles.previewMeta}>
                <span>Last updated: {parsedDraft.lastUpdated ?? "Not listed"}</span>
                <span>Status: {parsedDraft.publicationStatus ?? "Not listed"}</span>
              </div>
              <article className={legalStyles.previewDocument}>
                {parsedDraft.blocks.length ? (
                  parsedDraft.blocks.map(renderPreviewBlock)
                ) : (
                  <p className={legalStyles.previewEmpty}>No preview content.</p>
                )}
              </article>
            </div>
          </div>

          {selectedDocument?.history.length ? (
            <div className={legalStyles.historyPanel}>
              <div className={legalStyles.panelHeader}>
                <div>
                  <p className={adminStyles.adminSectionEyebrow}>History</p>
                  <h3>Recent versions</h3>
                </div>
              </div>
              <div className={legalStyles.historyList}>
                {selectedDocument.history.map((entry) => (
                  <div key={entry.versionId} className={legalStyles.historyRow}>
                    <span>{entry.isActive ? "Active" : "Stored"}</span>
                    <span>v{entry.version}</span>
                    <span>{formatPolicyTime(entry.createdAt)}</span>
                    <span>{entry.createdByEmail ?? "Unknown"}</span>
                    <span>{entry.note ?? "No note"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
