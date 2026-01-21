/**
 * Media Library page for per-user uploads/downloads/deletes in the private Supabase bucket.
 * Handles filtering, signed URL fetches, and UI orchestration while delegating storage to Supabase client helpers.
 */
/* eslint-disable @next/next/no-img-element */
import Head from "next/head";
import Link from "next/link";
import { CheckCircle, CloudArrowUp, DownloadSimple, MagnifyingGlass, Trash } from "phosphor-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ensureSupabaseClient } from "../lib/supabaseClient";

type MediaRow = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: "image" | "video" | string;
  file_size: number | null;
  created_at: string;
  signedUrl?: string;
  status?: "uploading" | "ready";
};

type MediaFilter = "images" | "videos";
type MediaFilterFull = "all" | MediaFilter;

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

export default function MediaLibrary() {
  const [files, setFiles] = useState<MediaRow[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MediaFilterFull>("all");
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
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + (file.file_size || 0), 0), [files]);
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
        const { data, error: fetchError } = await supabase
          .from("media_files")
          .select("*")
          .order("created_at", { ascending: false });
        if (fetchError) throw fetchError;

        const rows = data || [];
        const signed = await Promise.all(
          rows.map(async (row) => {
            const { data: signedData, error: signedError } = await supabase.storage
              .from(BUCKET)
              .createSignedUrl(row.storage_path, 3600);
            if (signedError) {
              // eslint-disable-next-line no-console
              console.error("Signed URL error", signedError);
            }
            return {
              ...row,
              signedUrl: signedData?.signedUrl,
            } as MediaRow;
          }),
        );
        if (active) {
          setFiles(signed);
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
  }, []);

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
        created_at: new Date().toISOString(),
        status: "uploading",
      }));
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

        uploads.push({
          ...inserted,
          signedUrl: signedData?.signedUrl,
          status: "ready",
        });

        // swap placeholder with real row
        setFiles((prev) =>
          prev.map((f) => (placeholderId && f.id === placeholderId ? { ...uploads[uploads.length - 1] } : f)),
        );
      }

      if (uploads.length) {
        setFiles((prev) => {
          // filter out any placeholders not replaced
          const withoutDangling = prev.filter((f) => f.status !== "uploading" || uploads.some((u) => u.id === f.id));
          // ensure new uploads are present (already inserted via swap above)
          return withoutDangling;
        });
      }
      setSelectedFiles([]);
      setUploadCount(0);
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      setUploadCount(0);
    }
  };

  const filteredFiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return files.filter((f) => {
      const matchesType =
        filter === "all"
          ? true
          : filter === "images"
            ? (f.file_type || "").startsWith("image")
            : (f.file_type || "").startsWith("video");
      const matchesSearch = !term || f.filename.toLowerCase().includes(term) || (f.storage_path || "").toLowerCase().includes(term);
      return matchesType && matchesSearch;
    });
  }, [files, filter, search]);

  const handleSelectFilter = (next: MediaFilterFull) => {
    setFilter(next);
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const deleteFile = async (row: MediaRow) => {
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const { error: storageError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await supabase.from("media_files").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
      setFiles((prev) => prev.filter((f) => f.id !== row.id));
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
    } catch (err: any) {
      setError(err?.message || "Unable to delete media");
    }
  };

  const handleImageLoad = (id: string, event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    setAspectMap((prev) => ({ ...prev, [id]: img.naturalWidth / img.naturalHeight }));
  };

  const handleVideoMeta = (id: string, event: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = event.currentTarget;
    if (!vid.videoWidth || !vid.videoHeight) return;
    setAspectMap((prev) => ({ ...prev, [id]: vid.videoWidth / vid.videoHeight }));
  };

  const toggleSelect = (file: MediaRow) => {
    if (file.status === "uploading") return;
    setSelectedIds((prev) => (prev.includes(file.id) ? prev.filter((id) => id !== file.id) : [...prev, file.id]));
  };

  const selectAllVisible = () => {
    setSelectedIds(filteredFiles.filter((f) => f.status !== "uploading").map((f) => f.id));
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
        const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths as string[]);
        if (storageError) throw storageError;
      }
      if (targets.length) {
        const ids = targets.map((t) => t.id);
        const { error: deleteError } = await supabase.from("media_files").delete().in("id", ids);
        if (deleteError) throw deleteError;
      }
      setFiles((prev) => prev.filter((f) => !selectedIds.includes(f.id)));
      setSelectedIds([]);
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
      const supabase = ensureSupabaseClient();
      const { error } = await supabase.from("media_files").update({ filename: renameValue.trim() }).eq("id", focusedFile.id);
      if (error) throw error;
      setFiles((prev) => prev.map((f) => (f.id === focusedFile.id ? { ...f, filename: renameValue.trim() } : f)));
      setFocusedFile((prev) => (prev ? { ...prev, filename: renameValue.trim() } : prev));
      setRenameSuccess(true);
      setTimeout(() => setRenameSuccess(false), 1800);
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
      <main className="page page-wide">
        <div className="page-top">
          <Link href="/dashboard" className="ghost-btn small">← Back to dashboard</Link>
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
              <p className="subdued">Upload, organize, and manage your workspace media in one place.</p>
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
            <div className="search-usage-card plan-card" aria-label="Plan status" role="button" tabIndex={0}>
              <div className="search-usage-icon plan-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="9" cy="9" r="7" stroke="#25A9BF" strokeWidth="1.4" />
                  <path d="M6.3 9.1 8 10.8 11.7 7" stroke="#25A9BF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
          >
            <p className="title">Drag and drop media here</p>
            {uploading && <div className="subdued tiny">Uploading {uploadCount || ""} file{uploadCount === 1 ? "" : "s"}…</div>}
            {error && <div className="auth-error">{error}</div>}
          </div>

          <div className="upload-side">
            <p className="eyebrow">Add files</p>
            <h3>Browse your computer</h3>
            <button className="primary-btn add-files-cta" type="button" onClick={triggerFilePicker}>
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
              <div className="subdued tiny">{selectedFiles.length} selected • {selectedFiles.map((f) => f.name).slice(0, 3).join(", ")}{selectedFiles.length > 3 ? "…" : ""}</div>
            )}
            <div className="upload-storage">
              <div>
                <p className="tiny subdued">Storage used</p>
                <strong>{(totalBytes / (1024 * 1024)).toFixed(1)} MB</strong>
                <span className="tiny subdued">of {(planLimitMb / 1024).toFixed(1)} GB</span>
              </div>
              <button type="button" className="ghost-btn upgrade-btn">
                Need more storage?
              </button>
            </div>
          </div>
        </section>

        <section className="panel media-filters media-panel">
          <div className="filter-tabs">
            <button
              type="button"
              className={`pill-toggle big ${filter === "all" ? "active" : ""}`}
              onClick={() => handleSelectFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`pill-toggle big ${filter === "images" ? "active" : ""}`}
              onClick={() => handleSelectFilter("images")}
            >
              Images
            </button>
            <button
              type="button"
              className={`pill-toggle big ${filter === "videos" ? "active" : ""}`}
              onClick={() => handleSelectFilter("videos")}
            >
              Videos
            </button>
          </div>
          <span className="pill tiny filter-count">{filteredFiles.length} files</span>
          <div className="search-wrap">
            <div className="search-input">
              <MagnifyingGlass size={16} weight="bold" />
              <input
                type="text"
                placeholder="Search media by name or file"
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
                  {filter === "all" ? "All media" : filter === "images" ? "Images" : "Videos"}
                </p>
                <h3>Your uploaded {filter === "all" ? "media" : filter === "images" ? "images" : "videos"}</h3>
              </div>
            </div>
          <div className="gallery-btns">
            {selectedIds.length ? (
              <button type="button" className="ghost-btn" onClick={() => setSelectedIds([])}>
                Deselect all
              </button>
            ) : null}
            <button type="button" className="ghost-btn" onClick={selectAllVisible} disabled={!filteredFiles.length}>
              Select all
            </button>
            <button
              type="button"
                className="danger-btn"
                onClick={deleteSelected}
                disabled={!selectedIds.length || bulkDeleting}
              >
                Delete
              </button>
            </div>
          </div>
          {loading && <div className="subdued tiny">Loading media…</div>}
          {!loading && !filteredFiles.length && (
            <div className="subdued tiny">No {filter === "all" ? "media" : filter} uploaded yet.</div>
          )}
          <div className="media-grid media-grid-fixed media-grid-shell">
            {filteredFiles.map((file) => {
              const aspectRatio =
                aspectMap[file.id] || (file.file_type.startsWith("video") ? 9 / 16 : 4 / 5);
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
                    file.file_type.startsWith("video") ? (
                      <video
                        className="media-thumb"
                        controls
                        src={file.signedUrl}
                        onLoadedMetadata={(e) => handleVideoMeta(file.id, e)}
                        style={{ aspectRatio }}
                      />
                    ) : (
                      <img
                        src={file.signedUrl}
                        alt={file.filename}
                        className="media-thumb"
                        onLoad={(e) => handleImageLoad(file.id, e)}
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
                    <span className="pill tiny">{file.file_type.startsWith("video") ? "Video" : "Image"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {focusedFile ? (
        <div className="media-modal" role="dialog" aria-modal="true">
          <div className="media-modal-backdrop" onClick={closeModal} />
          <div className="media-modal-content">
            <button className="ghost-btn close-btn" type="button" onClick={closeModal} aria-label="Close preview">
              ×
            </button>
            <div className="modal-body">
              <div className="modal-preview" style={{ aspectRatio: aspectMap[focusedFile.id] || (focusedFile.file_type.startsWith("video") ? 9 / 16 : 4 / 5) }}>
                {focusedFile.signedUrl ? (
                  focusedFile.file_type.startsWith("video") ? (
                    <video src={focusedFile.signedUrl} controls />
                  ) : (
                    <img src={focusedFile.signedUrl} alt={focusedFile.filename} />
                  )
                ) : (
                  <div className="placeholder">No preview available</div>
                )}
              </div>
              <div className="modal-meta">
                <label htmlFor="renameInput" className="eyebrow">
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
                />
                {modalError && <div className="auth-error">{modalError}</div>}
                <button className="primary-btn" type="button" onClick={saveRename} disabled={savingRename || !renameValue.trim()}>
                  {savingRename ? "Saving..." : "Save name"}
                </button>
                {renameSuccess && !modalError && !savingRename && (
                  <div className="rename-toast">
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
