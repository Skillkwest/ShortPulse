/**
 * Media Library page for per-user uploads/downloads/deletes in the private Supabase bucket.
 * Handles filtering, signed URL fetches, and UI orchestration while delegating storage to Supabase client helpers.
 */
import Head from "next/head";
import Link from "next/link";
import { CheckCircle, CloudArrowUp, DownloadSimple, MagnifyingGlass, Trash } from "phosphor-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureSupabaseClient } from "../lib/supabaseClient";

type MediaRow = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: "image" | "video" | string;
  file_size: number | null;
  source?: "upload" | "ai_studio" | string | null;
  source_ref?: string | null;
  prompt_id?: string | null;
  metadata?: Record<string, unknown> | null;
  updated_at?: string;
  created_at: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

type PromptRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: "text" | "image" | "video" | string;
  model_id: string | null;
  source: "manual" | "ai_studio" | "agent" | string;
  created_at: string;
  updated_at: string;
};

type MediaTab = "uploaded_images" | "uploaded_videos" | "saved_prompts" | "ai_generations";

const BUCKET = "media_library";

const formatBytes = (bytes?: number | null) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(1)} ${units[i]}`;
};

const sanitizeFileName = (name: string) => name.replace(/[^\w.-]+/g, "_");

const fileTypeFromMime = (mime: string) => {
  if (mime.startsWith("video/")) return "video";
  return "image";
};

const isVideoFile = (fileType?: string | null) => (fileType || "").startsWith("video");

const logMediaEvent = async (
  eventType: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
) => {
  try {
    const supabase = ensureSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    const { error } = await supabase.from("media_events").insert({
      user_id: userId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn("Media event log failed", error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Media event log error", err);
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function MediaLibrary() {
  const [files, setFiles] = useState<MediaRow[]>([]);
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MediaTab>("uploaded_images");
  const [search, setSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [aspectMap, setAspectMap] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [focusedFile, setFocusedFile] = useState<MediaRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [renameSuccess, setRenameSuccess] = useState(false);
  const signedUrlRetryRef = useRef<Record<string, number>>({});
  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + (file.file_size || 0), 0),
    [files]
  );
  const planLimitMb = 1024;
  const planUsage = { label: "Plan", name: "Creative Suite" };
  const storageUsageValue = useMemo(() => {
    const usedMb = totalBytes / (1024 * 1024);
    const limitGb = planLimitMb / 1024;
    return `${usedMb.toFixed(1)} MB / ${limitGb.toFixed(1)} GB`;
  }, [planLimitMb, totalBytes]);

  useEffect(() => {
    document.body.classList.add("media-library-body");
    document.documentElement.classList.add("media-library-body");
    return () => {
      document.body.classList.remove("media-library-body");
      document.documentElement.classList.remove("media-library-body");
    };
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  const signStoragePath = useCallback(async (storagePath: string): Promise<string | null> => {
    const supabase = ensureSupabaseClient();
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, 3600);
    if (signedError) throw signedError;
    return signedData?.signedUrl ?? null;
  }, []);

  const refreshSignedUrl = useCallback(
    async (fileId: string, storagePath: string): Promise<string | null> => {
      if (!storagePath) return null;
      try {
        const nextSignedUrl = await signStoragePath(storagePath);
        setFiles((prev) =>
          prev.map((file) =>
            file.id === fileId ? { ...file, signedUrl: nextSignedUrl ?? undefined } : file
          )
        );
        setFocusedFile((prev) =>
          prev && prev.id === fileId ? { ...prev, signedUrl: nextSignedUrl ?? undefined } : prev
        );
        return nextSignedUrl;
      } catch (_error) {
        return null;
      }
    },
    [signStoragePath]
  );

  const handleMediaPreviewError = useCallback(
    (file: MediaRow) => {
      const attempts = signedUrlRetryRef.current[file.id] ?? 0;
      if (attempts >= 1) return;
      signedUrlRetryRef.current[file.id] = attempts + 1;
      void refreshSignedUrl(file.id, file.storage_path);
    },
    [refreshSignedUrl]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const supabase = ensureSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id;
        if (!userId) {
          setError("Not signed in");
          return;
        }
        const [mediaResponse, promptResponse] = await Promise.all([
          supabase.from("media_files").select("*").order("created_at", { ascending: false }),
          supabase.from("media_prompts").select("*").order("created_at", { ascending: false }),
        ]);
        if (mediaResponse.error) throw mediaResponse.error;
        if (promptResponse.error) throw promptResponse.error;

        const rows = mediaResponse.data || [];
        const promptRows = promptResponse.data || [];
        const signed = await Promise.all(
          rows.map(async (row) => {
            const signedUrl = await signStoragePath(row.storage_path).catch((signedError) => {
              // eslint-disable-next-line no-console
              console.error("Signed URL error", signedError);
              return null;
            });
            return {
              ...row,
              source: row.source ?? "upload",
              signedUrl: signedUrl ?? undefined,
            } as MediaRow;
          })
        );
        if (active) {
          setFiles(signed);
          setPrompts(promptRows as PromptRow[]);
        }
      } catch (err: any) {
        setError(err?.message || "Unable to load media");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [signStoragePath]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (!list) return;
    const filesToUpload = Array.from(list);
    setSelectedFiles(filesToUpload);
    void uploadSelected(filesToUpload);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files;
    if (!dropped?.length) return;
    const filesToUpload = Array.from(dropped);
    setSelectedFiles(filesToUpload);
    void uploadSelected(filesToUpload);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const uploadSelected = async (incoming?: File[]) => {
    setError(null);
    setUploading(true);
    let placeholderIds: string[] = [];
    try {
      const supabase = ensureSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        setError("Not signed in");
        return;
      }

      const filesToProcess = incoming ?? selectedFiles;
      const uploads: MediaRow[] = [];
      // create optimistic placeholders so users see upload activity in the grid
      const placeholders: MediaRow[] = filesToProcess.map((file) => ({
        id: crypto.randomUUID(),
        filename: file.name,
        storage_path: "",
        file_type: fileTypeFromMime(file.type || "application/octet-stream"),
        file_size: file.size,
        source: "upload",
        created_at: new Date().toISOString(),
        status: "uploading",
      }));
      placeholderIds = placeholders.map((item) => item.id);
      setFiles((prev) => [...placeholders, ...prev]);
      setUploadCount(filesToProcess.length);
      for (let idx = 0; idx < filesToProcess.length; idx += 1) {
        const file = filesToProcess[idx];
        const placeholderId = placeholders[idx]?.id;
        const mimeType = file.type || "application/octet-stream";
        const typeFolder = fileTypeFromMime(mimeType) === "video" ? "videos" : "images";
        const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
        const storedName = `${crypto.randomUUID()}-${sanitizeFileName(file.name.replace(extension, ""))}${extension}`;
        const path = `${userId}/${typeFolder}/${storedName}`;

        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
          upsert: false,
          contentType: mimeType,
        });
        if (uploadError) {
          throw uploadError;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("media_files")
          .insert({
            user_id: userId,
            filename: file.name,
            storage_path: path,
            file_type: fileTypeFromMime(mimeType),
            file_size: file.size,
            source: "upload",
          })
          .select("*")
          .single();
        if (insertError) {
          throw insertError;
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);
        if (signedError) {
          throw signedError;
        }

        if (inserted?.id) {
          void logMediaEvent("upload", "media_file", inserted.id, {
            storage_path: path,
            file_type: fileTypeFromMime(mimeType),
            file_size: file.size,
          });
        }

        uploads.push({
          ...inserted,
          signedUrl: signedData?.signedUrl,
          status: "ready",
        });

        // swap placeholder with real row
        setFiles((prev) =>
          prev.map((f) =>
            placeholderId && f.id === placeholderId ? { ...uploads[uploads.length - 1] } : f
          )
        );
      }

      if (uploads.length) {
        setFiles((prev) => {
          // filter out any placeholders not replaced
          const withoutDangling = prev.filter(
            (f) => f.status !== "uploading" || uploads.some((u) => u.id === f.id)
          );
          // ensure new uploads are present (already inserted via swap above)
          return withoutDangling;
        });
      }
      setSelectedFiles([]);
      setUploadCount(0);
    } catch (err: any) {
      setError(err?.message || "Upload failed");
      if (placeholderIds.length) {
        setFiles((prev) =>
          prev.filter((file) => !(file.status === "uploading" && placeholderIds.includes(file.id)))
        );
      }
    } finally {
      setUploading(false);
      setUploadCount(0);
    }
  };

  const searchTerm = useMemo(() => search.trim().toLowerCase(), [search]);
  const uploadFiles = useMemo(
    () => files.filter((f) => (f.source ?? "upload") === "upload"),
    [files]
  );
  const uploadedImages = useMemo(
    () => uploadFiles.filter((f) => !isVideoFile(f.file_type)),
    [uploadFiles]
  );
  const uploadedVideos = useMemo(
    () => uploadFiles.filter((f) => isVideoFile(f.file_type)),
    [uploadFiles]
  );
  const aiGenerationFiles = useMemo(
    () => files.filter((f) => (f.source ?? "upload") === "ai_studio"),
    [files]
  );

  const filteredMedia = useMemo(() => {
    const base =
      activeTab === "uploaded_images"
        ? uploadedImages
        : activeTab === "uploaded_videos"
          ? uploadedVideos
          : activeTab === "ai_generations"
            ? aiGenerationFiles
            : [];
    if (!searchTerm) return base;
    return base.filter((f) => {
      const name = f.filename?.toLowerCase() ?? "";
      const path = f.storage_path?.toLowerCase() ?? "";
      return name.includes(searchTerm) || path.includes(searchTerm);
    });
  }, [activeTab, aiGenerationFiles, searchTerm, uploadedImages, uploadedVideos]);

  const filteredPrompts = useMemo(() => {
    if (activeTab !== "saved_prompts") return [];
    if (!searchTerm) return prompts;
    return prompts.filter((p) => {
      const title = p.title?.toLowerCase() ?? "";
      const text = p.prompt_text?.toLowerCase() ?? "";
      return title.includes(searchTerm) || text.includes(searchTerm);
    });
  }, [activeTab, prompts, searchTerm]);

  const isPromptTab = activeTab === "saved_prompts";
  const visibleCount = isPromptTab ? filteredPrompts.length : filteredMedia.length;
  const countLabel = isPromptTab ? "prompts" : "files";

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const deleteFile = async (row: MediaRow) => {
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([row.storage_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await supabase.from("media_files").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
      setFiles((prev) => prev.filter((f) => f.id !== row.id));
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
      void logMediaEvent("delete", "media_file", row.id, { storage_path: row.storage_path });
    } catch (err: any) {
      setError(err?.message || "Unable to delete media");
    }
  };

  const deletePrompt = async (row: PromptRow) => {
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const { error: deleteError } = await supabase.from("media_prompts").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
      setPrompts((prev) => prev.filter((p) => p.id !== row.id));
      void logMediaEvent("delete", "media_prompt", row.id);
    } catch (err: any) {
      setError(err?.message || "Unable to delete prompt");
    }
  };

  const downloadFile = async (row: MediaRow) => {
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const { data, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(row.storage_path);
      if (downloadError) throw downloadError;
      const blob = data as Blob;
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = row.filename || "media-file";
      link.click();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setError(err?.message || "Unable to download media");
    }
  };

  const handleImageLoad = (id: string, event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    signedUrlRetryRef.current[id] = 0;
    setAspectMap((prev) => ({ ...prev, [id]: img.naturalWidth / img.naturalHeight }));
  };

  const handleVideoMeta = (id: string, event: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = event.currentTarget;
    if (!vid.videoWidth || !vid.videoHeight) return;
    signedUrlRetryRef.current[id] = 0;
    setAspectMap((prev) => ({ ...prev, [id]: vid.videoWidth / vid.videoHeight }));
  };

  const toggleSelect = (file: MediaRow) => {
    if (file.status === "uploading") return;
    setSelectedIds((prev) =>
      prev.includes(file.id) ? prev.filter((id) => id !== file.id) : [...prev, file.id]
    );
  };

  const selectAllVisible = () => {
    setSelectedIds(filteredMedia.filter((f) => f.status !== "uploading").map((f) => f.id));
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    setBulkDeleting(true);
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const targets = files.filter((f) => selectedIds.includes(f.id));
      const paths = targets.map((t) => t.storage_path).filter(Boolean);
      if (paths.length) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET)
          .remove(paths as string[]);
        if (storageError) throw storageError;
      }
      if (targets.length) {
        const ids = targets.map((t) => t.id);
        const { error: deleteError } = await supabase.from("media_files").delete().in("id", ids);
        if (deleteError) throw deleteError;
      }
      setFiles((prev) => prev.filter((f) => !selectedIds.includes(f.id)));
      setSelectedIds([]);
      targets.forEach((target) => {
        void logMediaEvent("delete", "media_file", target.id, {
          storage_path: target.storage_path,
        });
      });
    } catch (err: any) {
      setError(err?.message || "Unable to delete selected media");
    } finally {
      setBulkDeleting(false);
    }
  };

  const openModal = (file: MediaRow) => {
    setFocusedFile(file);
    setRenameValue(file.filename);
    setModalError(null);
  };

  const closeModal = () => {
    setFocusedFile(null);
    setRenameValue("");
    setModalError(null);
    setRenameSuccess(false);
  };

  const saveRename = async () => {
    if (!focusedFile) return;
    setSavingRename(true);
    setModalError(null);
    setRenameSuccess(false);
    try {
      const previousName = focusedFile.filename;
      const supabase = ensureSupabaseClient();
      const { error } = await supabase
        .from("media_files")
        .update({ filename: renameValue.trim() })
        .eq("id", focusedFile.id);
      if (error) throw error;
      setFiles((prev) =>
        prev.map((f) => (f.id === focusedFile.id ? { ...f, filename: renameValue.trim() } : f))
      );
      setFocusedFile((prev) => (prev ? { ...prev, filename: renameValue.trim() } : prev));
      setRenameSuccess(true);
      setTimeout(() => setRenameSuccess(false), 1800);
      void logMediaEvent("rename", "media_file", focusedFile.id, {
        from: previousName,
        to: renameValue.trim(),
      });
    } catch (err: any) {
      setModalError(err?.message || "Unable to rename file");
    } finally {
      setSavingRename(false);
    }
  };

  return (
    <>
      <Head>
        <title>ShortPulse · Media Library</title>
        <meta name="description" content="Secure per-user media library." />
      </Head>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <main id="main-content" className="page page-wide">
        <div className="page-top">
          <Link href="/dashboard" className="btn-secondary btn-sm">
            ← Back to dashboard
          </Link>
        </div>

        <section
          className="panel saved-header-bar saved-hero hero-image-card"
          style={{
            backgroundImage: "url('/media-library-hero.png')",
          }}
        >
          <div className="saved-header-left">
            <div className="saved-title-stack">
              <div className="saved-title-row">
                <h1 className="title">Media Library</h1>
              </div>
              <p className="subdued">
                Upload, organize, and manage your workspace media in one place.
              </p>
            </div>
          </div>
          <div className="saved-header-right">
            <div className="header-stat-card" aria-label="Media storage" role="button" tabIndex={0}>
              <div className="status-icon compact" aria-hidden="true">
                <CloudArrowUp size={18} weight="bold" />
              </div>
              <div className="header-card-body">
                <p className="metric-label tiny">Media storage</p>
                <p className="status-value small">{storageUsageValue}</p>
              </div>
            </div>
            <div
              className="search-usage-card plan-card"
              aria-label="Plan status"
              role="button"
              tabIndex={0}
            >
              <div className="search-usage-icon plan-icon" aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="9" cy="9" r="7" stroke="#25A9BF" strokeWidth="1.4" />
                  <path
                    d="M6.3 9.1 8 10.8 11.7 7"
                    stroke="#25A9BF"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="search-usage-text">
                <p className="metric-label subtle">{planUsage.label}</p>
                <p className="search-usage-value plan-value">{planUsage.name}</p>
              </div>
            </div>
          </div>
        </section>

        <section
          className="panel media-stage hero-image-card media-panel"
          style={{
            backgroundImage: "none",
          }}
        >
          <div
            className={`drop-zone ${isDragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="region"
            aria-label="File upload area"
          >
            <p className="title">Drag and drop media here</p>
            {uploading && (
              <div className="subdued tiny" role="status" aria-live="polite">
                Uploading {uploadCount || ""} file{uploadCount === 1 ? "" : "s"}…
              </div>
            )}
            {error && (
              <div className="auth-error" role="alert" aria-live="assertive">
                {error}
              </div>
            )}
          </div>

          <div className="upload-side">
            <p className="eyebrow">Add files</p>
            <h3>Browse your computer</h3>
            <button className="btn-primary add-files-cta" type="button" onClick={triggerFilePicker}>
              <DownloadSimple size={20} weight="bold" />
              Add Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
              aria-label="Select media files"
              style={{ display: "none" }}
            />
            {selectedFiles.length > 0 && (
              <div className="subdued tiny">
                {selectedFiles.length} selected •{" "}
                {selectedFiles
                  .map((f) => f.name)
                  .slice(0, 3)
                  .join(", ")}
                {selectedFiles.length > 3 ? "…" : ""}
              </div>
            )}
            <div className="upload-storage">
              <div>
                <p className="tiny subdued">Storage used</p>
                <strong>{(totalBytes / (1024 * 1024)).toFixed(1)} MB</strong>
                <span className="tiny subdued">of {(planLimitMb / 1024).toFixed(1)} GB</span>
              </div>
              <button type="button" className="btn-secondary upgrade-btn">
                Need more storage?
              </button>
            </div>
          </div>
        </section>

        <section className="panel media-filters media-panel" aria-label="Media filters and search">
          <div className="filter-tabs" role="tablist" aria-label="Media categories">
            <button
              type="button"
              className={`pill-toggle big ${activeTab === "uploaded_images" ? "active" : ""}`}
              onClick={() => setActiveTab("uploaded_images")}
            >
              Uploaded Images
            </button>
            <button
              type="button"
              className={`pill-toggle big ${activeTab === "uploaded_videos" ? "active" : ""}`}
              onClick={() => setActiveTab("uploaded_videos")}
            >
              Uploaded Videos
            </button>
            <button
              type="button"
              className={`pill-toggle big ${activeTab === "saved_prompts" ? "active" : ""}`}
              onClick={() => setActiveTab("saved_prompts")}
            >
              Saved Prompts
            </button>
            <button
              type="button"
              className={`pill-toggle big ${activeTab === "ai_generations" ? "active" : ""}`}
              onClick={() => setActiveTab("ai_generations")}
            >
              AI Studio Generations
            </button>
          </div>
          <span className="pill tiny filter-count">
            {visibleCount} {countLabel}
          </span>
          <div className="search-wrap">
            <div className="search-input">
              <MagnifyingGlass size={16} weight="bold" />
              <input
                type="text"
                placeholder={isPromptTab ? "Search saved prompts" : "Search media by name or file"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="panel media-gallery media-panel">
          <div className="gallery-actions">
            <div className="section-heading minimal">
              <div>
                <p className="eyebrow">
                  {activeTab === "uploaded_images"
                    ? "Uploaded images"
                    : activeTab === "uploaded_videos"
                      ? "Uploaded videos"
                      : activeTab === "saved_prompts"
                        ? "Saved prompts"
                        : "AI Studio generations"}
                </p>
                <h3>
                  {activeTab === "uploaded_images"
                    ? "Your uploaded images"
                    : activeTab === "uploaded_videos"
                      ? "Your uploaded videos"
                      : activeTab === "saved_prompts"
                        ? "Your saved prompts"
                        : "AI Studio generations"}
                </h3>
              </div>
            </div>
            {!isPromptTab ? (
              <div className="gallery-btns">
                {selectedIds.length ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedIds([])}
                  >
                    Deselect all
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={selectAllVisible}
                  disabled={!filteredMedia.length}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={deleteSelected}
                  disabled={!selectedIds.length || bulkDeleting}
                  aria-label={`Delete ${selectedIds.length} selected ${selectedIds.length === 1 ? "file" : "files"}`}
                >
                  {bulkDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            ) : null}
          </div>
          {loading && <div className="subdued tiny">Loading media…</div>}
          {!loading && isPromptTab && !filteredPrompts.length && (
            <div className="subdued tiny">No prompts saved yet.</div>
          )}
          {!loading && !isPromptTab && !filteredMedia.length && (
            <div className="subdued tiny">
              {activeTab === "uploaded_images"
                ? "No images uploaded yet."
                : activeTab === "uploaded_videos"
                  ? "No videos uploaded yet."
                  : "No AI Studio generations saved yet."}
            </div>
          )}
          {isPromptTab ? (
            <div className="prompt-grid">
              {filteredPrompts.map((promptItem) => (
                <div className="prompt-card" key={promptItem.id}>
                  <div className="prompt-card-header">
                    <div>
                      <p className="metric-label">{promptItem.title || "Saved prompt"}</p>
                      <p className="metric-value tiny">{formatDate(promptItem.created_at)}</p>
                    </div>
                    <span className="pill tiny">{promptItem.mode}</span>
                  </div>
                  <p className="prompt-card-body">{promptItem.prompt_text}</p>
                  <div className="prompt-card-footer">
                    <span className="metric-label tiny">
                      {promptItem.model_id || "Model not set"}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary prompt-delete-btn"
                      onClick={() => deletePrompt(promptItem)}
                      aria-label={`Delete prompt: ${promptItem.title || "Saved prompt"}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="media-grid media-grid-fixed media-grid-shell">
              {filteredMedia.map((file) => {
                const aspectRatio =
                  aspectMap[file.id] || (isVideoFile(file.file_type) ? 9 / 16 : 4 / 5);
                return (
                  <div
                    className={`media-card ${file.status === "uploading" ? "is-uploading" : ""} ${
                      selectedIds.includes(file.id) ? "is-selected" : ""
                    }`}
                    key={file.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSelect(file)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSelect(file);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      openModal(file);
                    }}
                  >
                    <button
                      className="media-delete"
                      type="button"
                      style={{ right: 40 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        void downloadFile(file);
                      }}
                      aria-label="Download media"
                    >
                      <DownloadSimple size={14} weight="bold" />
                    </button>
                    <button
                      className="media-delete"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFile(file);
                      }}
                      aria-label="Delete media"
                    >
                      <Trash size={14} weight="bold" />
                    </button>
                    {file.status === "uploading" ? (
                      <div className="media-thumb placeholder" style={{ aspectRatio }}>
                        <div className="loader-spin" />
                        <p className="tiny subdued">Uploading…</p>
                      </div>
                    ) : file.signedUrl ? (
                      isVideoFile(file.file_type) ? (
                        <video
                          className="media-thumb"
                          controls
                          src={file.signedUrl}
                          onLoadedMetadata={(e) => handleVideoMeta(file.id, e)}
                          onError={() => handleMediaPreviewError(file)}
                          style={{ aspectRatio }}
                        />
                      ) : (
                        <img
                          src={file.signedUrl}
                          alt={file.filename}
                          className="media-thumb"
                          onLoad={(e) => handleImageLoad(file.id, e)}
                          onError={() => handleMediaPreviewError(file)}
                          style={{ aspectRatio }}
                        />
                      )
                    ) : (
                      <div className="media-thumb placeholder" style={{ aspectRatio }}>
                        No preview
                      </div>
                    )}
                    <div className="media-meta">
                      <div>
                        <p className="metric-label">{file.filename}</p>
                        <p className="metric-value tiny">{formatBytes(file.file_size)}</p>
                      </div>
                      <span className="pill tiny">
                        {isVideoFile(file.file_type) ? "Video" : "Image"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {focusedFile ? (
        <div className="media-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="media-modal-backdrop" onClick={closeModal} />
          <div className="media-modal-content">
            <button
              className="btn-secondary close-btn"
              type="button"
              onClick={closeModal}
              aria-label="Close preview"
            >
              ×
            </button>
            <div className="modal-body">
              <div
                className="modal-preview"
                style={{
                  aspectRatio:
                    aspectMap[focusedFile.id] ||
                    (isVideoFile(focusedFile.file_type) ? 9 / 16 : 4 / 5),
                }}
              >
                {focusedFile.signedUrl ? (
                  isVideoFile(focusedFile.file_type) ? (
                    <video
                      src={focusedFile.signedUrl}
                      controls
                      onError={() => handleMediaPreviewError(focusedFile)}
                    />
                  ) : (
                    <img
                      src={focusedFile.signedUrl}
                      alt={focusedFile.filename}
                      onError={() => handleMediaPreviewError(focusedFile)}
                    />
                  )
                ) : (
                  <div className="placeholder">No preview available</div>
                )}
              </div>
              <div className="modal-meta">
                <label htmlFor="renameInput" id="modal-title" className="eyebrow">
                  File name
                </label>
                <input
                  id="renameInput"
                  type="text"
                  value={renameValue}
                  onChange={(e) => {
                    setRenameValue(e.target.value);
                    setRenameSuccess(false);
                  }}
                  className="input"
                  aria-label="Enter new filename"
                />
                {modalError && (
                  <div className="auth-error" role="alert" aria-live="assertive">
                    {modalError}
                  </div>
                )}
                <button
                  className="btn-primary"
                  type="button"
                  onClick={saveRename}
                  disabled={savingRename || !renameValue.trim()}
                >
                  {savingRename ? "Saving..." : "Save name"}
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => void downloadFile(focusedFile)}
                >
                  Download file
                </button>
                {renameSuccess && !modalError && !savingRename && (
                  <div className="rename-toast" role="status" aria-live="polite">
                    <CheckCircle size={16} weight="bold" />
                    <span>Saved</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
