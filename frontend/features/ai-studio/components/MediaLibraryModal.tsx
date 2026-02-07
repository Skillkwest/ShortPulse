/**
 * Media library selector modal for AI Studio.
 * Loads user media/prompts and lets creators add them to the reference grid.
 */
import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle, CloudArrowDown, ImageSquare, VideoCamera, X } from "phosphor-react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";

type MediaFileRow = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  source?: string | null;
  created_at?: string | null;
  signedUrl?: string | null;
};

type PromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode?: string | null;
  model_id?: string | null;
  source?: string | null;
  created_at?: string | null;
};

type MediaTab = "uploaded_images" | "uploaded_videos" | "saved_prompts" | "ai_generations";

type MediaLibraryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video";
    filename?: string | null;
    source?: string | null;
  }) => void;
  onSelectPrompt: (payload: { id: string; promptText: string; title?: string | null }) => void;
};

const BUCKET = "media_library";

const isVideoFile = (fileType?: string | null) => (fileType ?? "").toLowerCase().startsWith("video");

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function MediaLibraryModal({ isOpen, onClose, onSelectMedia, onSelectPrompt }: MediaLibraryModalProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>("uploaded_images");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<MediaFileRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set());
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = ensureSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          setError("Not signed in.");
          return;
        }
        const [mediaResponse, promptResponse] = await Promise.all([
          supabase.from("media_files").select("id, filename, storage_path, file_type, source, created_at").order("created_at", { ascending: false }),
          supabase.from("media_prompts").select("id, title, prompt_text, mode, model_id, source, created_at").order("created_at", { ascending: false }),
        ]);
        if (mediaResponse.error) throw mediaResponse.error;
        if (promptResponse.error) throw promptResponse.error;

        const rows = mediaResponse.data ?? [];
        const signedRows = await Promise.all(
          rows.map(async (row) => {
            const { data: signedData } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 3600);
            return {
              ...row,
              source: row.source ?? "upload",
              signedUrl: signedData?.signedUrl ?? null,
            } as MediaFileRow;
          }),
        );

        if (active) {
          setFiles(signedRows);
          setPrompts((promptResponse.data ?? []) as PromptRow[]);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || "Unable to load media library.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab((prev) => prev ?? "uploaded_images");
    }
  }, [isOpen]);

  const uploadFiles = useMemo(() => files.filter((item) => (item.source ?? "upload") === "upload"), [files]);
  const uploadedImages = useMemo(() => uploadFiles.filter((item) => !isVideoFile(item.file_type)), [uploadFiles]);
  const uploadedVideos = useMemo(() => uploadFiles.filter((item) => isVideoFile(item.file_type)), [uploadFiles]);
  const aiGenerations = useMemo(() => files.filter((item) => (item.source ?? "upload") === "ai_studio"), [files]);

  const activeMedia =
    activeTab === "uploaded_images"
      ? uploadedImages
      : activeTab === "uploaded_videos"
        ? uploadedVideos
        : activeTab === "ai_generations"
          ? aiGenerations
          : [];

  if (!isOpen) return null;

  return (
    <div className="media-library-modal-backdrop" onClick={onClose}>
      <div
        className="media-library-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Media library"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="media-library-modal-header">
          <div>
            <p className="eyebrow">Media Library</p>
            <p className="tiny subdued helper-text">Select media or prompts to add to the reference grid.</p>
          </div>
          <button type="button" className="art-close-btn" onClick={onClose} aria-label="Close media library">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="media-library-modal-tabs" role="tablist" aria-label="Media library tabs">
          <button
            type="button"
            role="tab"
            className={`media-library-tab ${activeTab === "uploaded_images" ? "is-active" : ""}`}
            aria-selected={activeTab === "uploaded_images"}
            onClick={() => setActiveTab("uploaded_images")}
          >
            <ImageSquare size={14} weight="bold" aria-hidden />
            Uploaded Images
          </button>
          <button
            type="button"
            role="tab"
            className={`media-library-tab ${activeTab === "uploaded_videos" ? "is-active" : ""}`}
            aria-selected={activeTab === "uploaded_videos"}
            onClick={() => setActiveTab("uploaded_videos")}
          >
            <VideoCamera size={14} weight="bold" aria-hidden />
            Uploaded Videos
          </button>
          <button
            type="button"
            role="tab"
            className={`media-library-tab ${activeTab === "saved_prompts" ? "is-active" : ""}`}
            aria-selected={activeTab === "saved_prompts"}
            onClick={() => setActiveTab("saved_prompts")}
          >
            <CloudArrowDown size={14} weight="bold" aria-hidden />
            Saved Prompts
          </button>
          <button
            type="button"
            role="tab"
            className={`media-library-tab ${activeTab === "ai_generations" ? "is-active" : ""}`}
            aria-selected={activeTab === "ai_generations"}
            onClick={() => setActiveTab("ai_generations")}
          >
            <CloudArrowDown size={14} weight="bold" aria-hidden />
            AI Studio Generations
          </button>
        </div>

        <div className="media-library-modal-body">
          {loading ? <p className="tiny subdued">Loading media library…</p> : null}
          {error ? <p className="tiny subdued">{error}</p> : null}

          {!loading && !error && activeTab === "saved_prompts" ? (
            <div className="prompt-grid media-library-prompt-grid">
              {prompts.length === 0 ? (
                <p className="tiny subdued">No saved prompts yet.</p>
              ) : (
                prompts.map((prompt) => {
                  const isSelected = selectedIds.has(prompt.id);
                  return (
                  <button
                    key={prompt.id}
                    type="button"
                    className={`prompt-card media-library-prompt-card${isSelected ? " is-selected" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() =>
                      {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          next.add(prompt.id);
                          return next;
                        });
                        onSelectPrompt({
                          id: prompt.id,
                          promptText: prompt.prompt_text,
                          title: prompt.title,
                        });
                      }
                    }
                  >
                    {isSelected ? (
                      <span className="media-library-select-indicator" aria-hidden>
                        <CheckCircle size={16} weight="fill" />
                      </span>
                    ) : null}
                    <div className="prompt-card-header">
                      <div>
                        <p className="metric-label">{prompt.title || "Saved prompt"}</p>
                        <p className="metric-value tiny">{formatDate(prompt.created_at)}</p>
                      </div>
                      <span className="pill tiny">Prompt</span>
                    </div>
                    <p className="prompt-card-body">{prompt.prompt_text}</p>
                  </button>
                );
                })
              )}
            </div>
          ) : null}

          {!loading && !error && activeTab !== "saved_prompts" ? (
            <div className="media-grid media-library-modal-grid">
              {activeMedia.length === 0 ? (
                <p className="tiny subdued">No media found for this tab.</p>
              ) : (
                activeMedia.map((file) => {
                  const isSelected = selectedIds.has(file.id);
                  return (
                  <button
                    key={file.id}
                    type="button"
                    className={`media-card media-library-modal-card${isSelected ? " is-selected" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      if (!file.signedUrl) return;
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        next.add(file.id);
                        return next;
                      });
                      onSelectMedia({
                        id: file.id,
                        url: file.signedUrl,
                        fileType: isVideoFile(file.file_type) ? "video" : "image",
                        filename: file.filename,
                        source: file.source ?? "upload",
                      });
                    }}
                  >
                    {isSelected ? (
                      <span className="media-library-select-indicator" aria-hidden>
                        <CheckCircle size={16} weight="fill" />
                      </span>
                    ) : null}
                    {file.signedUrl ? (
                      isVideoFile(file.file_type) ? (
                        <video className="media-thumb" src={file.signedUrl} muted playsInline />
                      ) : (
                        <img className="media-thumb" src={file.signedUrl} alt={file.filename} />
                      )
                    ) : (
                      <div className="media-thumb placeholder">No preview</div>
                    )}
                    <div className="media-meta">
                      <div>
                        <p className="metric-label">{file.filename}</p>
                        <p className="metric-value tiny">{formatDate(file.created_at)}</p>
                      </div>
                      <span className="pill tiny">{isVideoFile(file.file_type) ? "Video" : "Image"}</span>
                    </div>
                  </button>
                );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
