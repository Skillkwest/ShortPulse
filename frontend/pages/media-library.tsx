/**
 * Media Library page for per-user uploads/downloads/deletes in the private Supabase bucket.
 * Handles filtering, signed URL fetches, and UI orchestration while delegating storage to Supabase client helpers.
 */
import Head from "next/head";
import Link from "next/link";
import {
  CheckCircle,
  CloudArrowUp,
  DownloadSimple,
  House,
  LockSimple,
  MagnifyingGlass,
  ShieldCheck,
  Trash,
} from "phosphor-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createMediaPerfTimer, logMediaPerf } from "../lib/mediaPerfTelemetry";
import { resolvePreviewStoragePath } from "../lib/mediaPreviewPath";
import { ensureSupabaseClient } from "../lib/supabaseClient";

type MediaRow = {
  id: string;
  filename: string;
  storage_path: string;
  preview_storage_path?: string;
  file_type: "image" | "video" | string;
  file_size: number | null;
  source?: "upload" | "ai_studio" | string | null;
  source_ref?: string | null;
  prompt_id?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
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

type MediaTab =
  | "uploaded_images"
  | "uploaded_videos"
  | "private"
  | "saved_prompts"
  | "ai_generations";

const BUCKET = "media_library";
const PRIVATE_MEDIA_SOURCE = "private_upload";
const PRIVATE_MEDIA_FOLDER = "private";

const sanitizeFileName = (name: string) => name.replace(/[^\w.-]+/g, "_");

const fileTypeFromMime = (mime: string) => {
  if (mime.startsWith("video/")) return "video";
  return "image";
};

const isVideoFile = (fileType?: string | null) => (fileType || "").startsWith("video");
const isPrivateStoragePath = (storagePath?: string | null) =>
  (storagePath ?? "").split("/").filter(Boolean).includes(PRIVATE_MEDIA_FOLDER);
const isPrivateMediaFile = (file: Pick<MediaRow, "source" | "storage_path">) =>
  (file.source ?? "") === PRIVATE_MEDIA_SOURCE || isPrivateStoragePath(file.storage_path);

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
      console.warn("Media event log failed", error);
    }
  } catch (err) {
    console.warn("Media event log error", err);
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const createdAtTime = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortByCreatedAtDesc = <T extends { created_at?: string | null; id?: string | null }>(
  rows: T[]
): T[] =>
  [...rows].sort((a, b) => {
    const createdDelta = createdAtTime(b.created_at) - createdAtTime(a.created_at);
    if (createdDelta !== 0) return createdDelta;
    return (b.id ?? "").localeCompare(a.id ?? "");
  });

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

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
  const [deleteTarget, setDeleteTarget] = useState<MediaRow | null>(null);
  const [deletingSingle, setDeletingSingle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [focusedFile, setFocusedFile] = useState<MediaRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [renameSuccess, setRenameSuccess] = useState(false);
  const signedUrlRetryRef = useRef<Record<string, number>>({});
  const firstCardShellLoggedRef = useRef(false);
  const firstMediaPaintLoggedRef = useRef(false);
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
      } catch {
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
      void refreshSignedUrl(file.id, file.preview_storage_path ?? file.storage_path);
    },
    [refreshSignedUrl]
  );

  const markFirstMediaPaint = useCallback(
    (assetKind: "image" | "video") => {
      if (firstMediaPaintLoggedRef.current) return;
      firstMediaPaintLoggedRef.current = true;
      logMediaPerf("media.route.first_media_paint", {
        surface: "media-library-route",
        tab: activeTab,
        asset_kind: assetKind,
      });
    },
    [activeTab]
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
          supabase
            .from("media_files")
            .select("*")
            .order("created_at", { ascending: false })
            .order("id", { ascending: false }),
          supabase
            .from("media_prompts")
            .select("*")
            .order("created_at", { ascending: false })
            .order("id", { ascending: false }),
        ]);
        if (mediaResponse.error) throw mediaResponse.error;
        if (promptResponse.error) throw promptResponse.error;

        const rows = mediaResponse.data || [];
        const promptRows = promptResponse.data || [];
        const finishSignBatch = createMediaPerfTimer({
          surface: "media-library-route",
          tab: activeTab,
          batch_size: rows.length,
        });
        const signed = await Promise.all(
          rows.map(async (row) => {
            const previewStoragePath = resolvePreviewStoragePath(row);
            const signedUrl = await signStoragePath(previewStoragePath ?? row.storage_path).catch(
              (signedError) => {
                console.error("Signed URL error", signedError);
                return null;
              }
            );
            return {
              ...row,
              source: row.source ?? "upload",
              preview_storage_path: previewStoragePath ?? row.storage_path,
              signedUrl: signedUrl ?? undefined,
            } as MediaRow;
          })
        );
        const signedCount = signed.filter((row) => Boolean(row.signedUrl)).length;
        const failedCount = Math.max(0, rows.length - signedCount);
        finishSignBatch("media.sign.batch.completed", {
          signed_count: signedCount,
          failed_count: failedCount,
        });
        if (failedCount > 0) {
          logMediaPerf("media.sign.batch.failed", {
            surface: "media-library-route",
            tab: activeTab,
            batch_size: rows.length,
            failed_count: failedCount,
          });
        }
        if (active) {
          setFiles(signed);
          setPrompts(promptRows as PromptRow[]);
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Unable to load media"));
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
  }, [activeTab, signStoragePath]);

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
      const isPrivateUpload = activeTab === "private";
      if (isPrivateUpload) {
        const hasUnsupportedFile = filesToProcess.some(
          (file) => !file.type.toLowerCase().startsWith("image/")
        );
        if (hasUnsupportedFile) {
          setError("Private uploads only support images.");
          return;
        }
      }
      const uploads: MediaRow[] = [];
      // create optimistic placeholders so users see upload activity in the grid
      const placeholders: MediaRow[] = filesToProcess.map((file) => ({
        id: crypto.randomUUID(),
        filename: file.name,
        storage_path: "",
        preview_storage_path: "",
        file_type: fileTypeFromMime(file.type || "application/octet-stream"),
        file_size: file.size,
        source: isPrivateUpload ? PRIVATE_MEDIA_SOURCE : "upload",
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
        const path = isPrivateUpload
          ? `${userId}/${PRIVATE_MEDIA_FOLDER}/images/${storedName}`
          : `${userId}/${typeFolder}/${storedName}`;

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
            source: isPrivateUpload ? PRIVATE_MEDIA_SOURCE : "upload",
          })
          .select("*")
          .single();
        if (insertError) {
          throw insertError;
        }

        const previewStoragePath =
          resolvePreviewStoragePath(inserted ?? { storage_path: path }) ?? path;
        const { data: signedData, error: signedError } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(previewStoragePath, 3600);
        if (signedError) {
          throw signedError;
        }

        if (inserted?.id) {
          void logMediaEvent("upload", "media_file", inserted.id, {
            storage_path: path,
            file_type: fileTypeFromMime(mimeType),
            file_size: file.size,
            visibility: isPrivateUpload ? "private" : "standard",
          });
        }

        uploads.push({
          ...inserted,
          preview_storage_path: previewStoragePath,
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Upload failed"));
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
    () =>
      sortByCreatedAtDesc(
        files.filter((f) => (f.source ?? "upload") === "upload" && !isPrivateMediaFile(f))
      ),
    [files]
  );
  const privateFiles = useMemo(
    () => sortByCreatedAtDesc(files.filter((f) => isPrivateMediaFile(f))),
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
    () => sortByCreatedAtDesc(files.filter((f) => (f.source ?? "upload") === "ai_studio")),
    [files]
  );

  const filteredMedia = useMemo(() => {
    const base =
      activeTab === "uploaded_images"
        ? uploadedImages
        : activeTab === "uploaded_videos"
          ? uploadedVideos
          : activeTab === "private"
            ? privateFiles
            : activeTab === "ai_generations"
              ? aiGenerationFiles
              : [];
    if (!searchTerm) return base;
    return base.filter((f) => {
      const name = f.filename?.toLowerCase() ?? "";
      const path = f.storage_path?.toLowerCase() ?? "";
      return name.includes(searchTerm) || path.includes(searchTerm);
    });
  }, [activeTab, aiGenerationFiles, privateFiles, searchTerm, uploadedImages, uploadedVideos]);

  const filteredPrompts = useMemo(() => {
    if (activeTab !== "saved_prompts") return [];
    const promptRows = !searchTerm
      ? prompts
      : prompts.filter((p) => {
          const title = p.title?.toLowerCase() ?? "";
          const text = p.prompt_text?.toLowerCase() ?? "";
          return title.includes(searchTerm) || text.includes(searchTerm);
        });
    return sortByCreatedAtDesc(promptRows);
  }, [activeTab, prompts, searchTerm]);

  const isPromptTab = activeTab === "saved_prompts";
  const visibleCount = isPromptTab ? filteredPrompts.length : filteredMedia.length;
  const countLabel = isPromptTab ? "prompts" : "files";
  useEffect(() => {
    if (loading || firstCardShellLoggedRef.current) return;
    if (visibleCount <= 0) return;
    firstCardShellLoggedRef.current = true;
    logMediaPerf("media.route.first_card_shell", {
      surface: "media-library-route",
      tab: activeTab,
      visible_item_count: visibleCount,
    });
  }, [activeTab, loading, visibleCount]);

  const selectableMediaIds = useMemo(
    () => filteredMedia.filter((item) => item.status !== "uploading").map((item) => item.id),
    [filteredMedia]
  );
  const selectablePromptIds = useMemo(
    () => filteredPrompts.map((item) => item.id),
    [filteredPrompts]
  );
  const selectableIds = isPromptTab ? selectablePromptIds : selectableMediaIds;
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));
  const deleteButtonLabel = allVisibleSelected ? "Delete all" : "Delete selected";
  const deleteItemLabel = isPromptTab
    ? selectedIds.length === 1
      ? "prompt"
      : "prompts"
    : selectedIds.length === 1
      ? "file"
      : "files";

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const deletePrompt = async (row: PromptRow) => {
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const { error: deleteError } = await supabase.from("media_prompts").delete().eq("id", row.id);
      if (deleteError) throw deleteError;
      setPrompts((prev) => prev.filter((p) => p.id !== row.id));
      setSelectedIds((prev) => prev.filter((id) => id !== row.id));
      void logMediaEvent("delete", "media_prompt", row.id);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete prompt"));
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to download media"));
    }
  };

  const handleImageLoad = (id: string, event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (!img.naturalWidth || !img.naturalHeight) return;
    signedUrlRetryRef.current[id] = 0;
    setAspectMap((prev) => ({ ...prev, [id]: img.naturalWidth / img.naturalHeight }));
    markFirstMediaPaint("image");
  };

  const handleVideoMeta = (id: string, event: React.SyntheticEvent<HTMLVideoElement>) => {
    const vid = event.currentTarget;
    if (!vid.videoWidth || !vid.videoHeight) return;
    signedUrlRetryRef.current[id] = 0;
    setAspectMap((prev) => ({ ...prev, [id]: vid.videoWidth / vid.videoHeight }));
    markFirstMediaPaint("video");
  };

  const toggleSelect = (file: MediaRow) => {
    if (file.status === "uploading") return;
    setSelectedIds((prev) =>
      prev.includes(file.id) ? prev.filter((id) => id !== file.id) : [...prev, file.id]
    );
  };

  const togglePromptSelect = (promptId: string) => {
    setSelectedIds((prev) =>
      prev.includes(promptId) ? prev.filter((id) => id !== promptId) : [...prev, promptId]
    );
  };

  const selectAllVisible = () => {
    setSelectedIds(isPromptTab ? selectablePromptIds : selectableMediaIds);
  };

  const deleteSelected = async () => {
    if (!selectedIds.length) return;
    setBulkDeleting(true);
    setError(null);
    const idsToDelete = [...selectedIds];
    try {
      const supabase = ensureSupabaseClient();
      if (isPromptTab) {
        const { error: deleteError } = await supabase
          .from("media_prompts")
          .delete()
          .in("id", idsToDelete);
        if (deleteError) throw deleteError;
        setPrompts((prev) => prev.filter((prompt) => !idsToDelete.includes(prompt.id)));
        setSelectedIds([]);
        idsToDelete.forEach((promptId) => {
          void logMediaEvent("delete", "media_prompt", promptId);
        });
      } else {
        const targets = files.filter((f) => idsToDelete.includes(f.id));
        const paths = Array.from(
          new Set(targets.flatMap((target) => [target.storage_path, target.preview_storage_path]))
        ).filter(isNonEmptyString);
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
        setFiles((prev) => prev.filter((f) => !idsToDelete.includes(f.id)));
        setSelectedIds([]);
        targets.forEach((target) => {
          void logMediaEvent("delete", "media_file", target.id, {
            storage_path: target.storage_path,
          });
        });
      }
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, `Unable to delete selected ${isPromptTab ? "prompts" : "media"}`)
      );
    } finally {
      setBulkDeleting(false);
    }
  };

  const requestDeleteFile = (file: MediaRow) => {
    if (file.status === "uploading") return;
    setDeleteTarget(file);
    setError(null);
  };

  const cancelDeleteFile = () => {
    if (deletingSingle) return;
    setDeleteTarget(null);
  };

  const confirmDeleteFile = async () => {
    if (!deleteTarget) return;
    setDeletingSingle(true);
    setError(null);
    try {
      const supabase = ensureSupabaseClient();
      const deletePaths = Array.from(
        new Set([deleteTarget.storage_path, deleteTarget.preview_storage_path])
      ).filter(isNonEmptyString);
      if (deletePaths.length) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove(deletePaths);
        if (storageError) throw storageError;
      }
      const { error: deleteError } = await supabase
        .from("media_files")
        .delete()
        .eq("id", deleteTarget.id);
      if (deleteError) throw deleteError;
      setFiles((prev) => prev.filter((file) => file.id !== deleteTarget.id));
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      setFocusedFile((prev) => (prev && prev.id === deleteTarget.id ? null : prev));
      setDeleteTarget(null);
      void logMediaEvent("delete", "media_file", deleteTarget.id, {
        storage_path: deleteTarget.storage_path,
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to delete file"));
    } finally {
      setDeletingSingle(false);
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
    } catch (err: unknown) {
      setModalError(getErrorMessage(err, "Unable to rename file"));
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
          <Link href="/dashboard" className="media-dashboard-link" aria-label="Dashboard">
            <House size={16} weight="regular" />
            Dashboard
          </Link>
        </div>

        <section className="panel saved-header-bar saved-hero hero-image-card">
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
          <div className="header-cards media-header-cards">
            <div className="header-stat-card" aria-label="Media storage">
              <div className="status-icon compact" aria-hidden="true">
                <CloudArrowUp size={18} weight="bold" />
              </div>
              <div className="header-card-body">
                <p className="metric-label tiny">Media storage</p>
                <p className="status-value small">{storageUsageValue}</p>
              </div>
            </div>
            <div className="header-stat-card" aria-label="Plan status">
              <div className="status-icon compact" aria-hidden="true">
                <ShieldCheck size={16} weight="bold" />
              </div>
              <div className="header-card-body">
                <p className="metric-label tiny">{planUsage.label}</p>
                <p className="status-value small">{planUsage.name}</p>
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
              accept={activeTab === "private" ? "image/*" : "image/*,video/*"}
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
              className={`pill-toggle big ${activeTab === "private" ? "active" : ""}`}
              onClick={() => setActiveTab("private")}
            >
              <LockSimple size={14} weight="bold" aria-hidden />
              Private
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

        <section
          className={`panel media-gallery media-panel ${isPromptTab ? "" : "media-gallery-packed"}`}
        >
          <div className="gallery-actions">
            <div className="section-heading minimal">
              <div>
                <p className="eyebrow">
                  {activeTab === "uploaded_images"
                    ? "Uploaded images"
                    : activeTab === "uploaded_videos"
                      ? "Uploaded videos"
                      : activeTab === "private"
                        ? "Private images"
                        : activeTab === "saved_prompts"
                          ? "Saved prompts"
                          : "AI Studio generations"}
                </p>
                <h3>
                  {activeTab === "uploaded_images"
                    ? "Your uploaded images"
                    : activeTab === "uploaded_videos"
                      ? "Your uploaded videos"
                      : activeTab === "private"
                        ? "Your private images"
                        : activeTab === "saved_prompts"
                          ? "Your saved prompts"
                          : "AI Studio generations"}
                </h3>
              </div>
            </div>
            <div className="gallery-btns">
              {selectedIds.length ? (
                <button type="button" className="btn-secondary" onClick={() => setSelectedIds([])}>
                  Deselect all
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                onClick={selectAllVisible}
                disabled={!selectableIds.length || allVisibleSelected}
              >
                Select all
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={deleteSelected}
                disabled={!selectedIds.length || bulkDeleting}
                aria-label={`${deleteButtonLabel} ${selectedIds.length} ${deleteItemLabel}`}
              >
                {bulkDeleting ? "Deleting..." : deleteButtonLabel}
              </button>
            </div>
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
                  : activeTab === "private"
                    ? "No private images uploaded yet."
                    : "No AI Studio generations saved yet."}
            </div>
          )}
          {isPromptTab ? (
            <div className="prompt-grid">
              {filteredPrompts.map((promptItem) => (
                <div
                  className={`prompt-card ${selectedIds.includes(promptItem.id) ? "is-selected" : ""}`}
                  key={promptItem.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedIds.includes(promptItem.id)}
                  onClick={() => togglePromptSelect(promptItem.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      togglePromptSelect(promptItem.id);
                    }
                  }}
                >
                  {selectedIds.includes(promptItem.id) ? (
                    <span className="prompt-select-indicator" aria-hidden>
                      <CheckCircle size={16} weight="fill" />
                    </span>
                  ) : null}
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
                      onClick={(event) => {
                        event.stopPropagation();
                        void deletePrompt(promptItem);
                      }}
                      aria-label={`Delete prompt: ${promptItem.title || "Saved prompt"}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="media-grid media-grid-fixed media-grid-shell media-grid-packed">
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
                    {file.status === "uploading" ? (
                      <div className="media-thumb placeholder" style={{ aspectRatio }}>
                        <div className="loader-spin" />
                      </div>
                    ) : file.signedUrl ? (
                      isVideoFile(file.file_type) ? (
                        <video
                          className="media-thumb"
                          src={file.signedUrl}
                          muted
                          playsInline
                          loop
                          autoPlay
                          preload="metadata"
                          onLoadedMetadata={(e) => handleVideoMeta(file.id, e)}
                          onError={() => handleMediaPreviewError(file)}
                          style={{ aspectRatio }}
                        />
                      ) : (
                        <>
                          {/* Signed URLs are dynamic and may include ephemeral query parameters. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={file.signedUrl}
                            alt={file.filename}
                            className="media-thumb"
                            onLoad={(e) => handleImageLoad(file.id, e)}
                            onError={() => handleMediaPreviewError(file)}
                            style={{ aspectRatio }}
                          />
                        </>
                      )
                    ) : (
                      <div className="media-thumb placeholder" style={{ aspectRatio }}>
                        No preview
                      </div>
                    )}
                    {file.status !== "uploading" ? (
                      <button
                        type="button"
                        className="media-delete"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          requestDeleteFile(file);
                        }}
                        aria-label={`Delete file: ${file.filename || "media file"}`}
                      >
                        <Trash size={14} weight="bold" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {deleteTarget ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-file-title"
        >
          <div className="modal-card media-delete-confirm-card">
            <h3 id="delete-file-title">Delete this file from your library?</h3>
            <p className="subdued tiny media-delete-confirm-copy">
              This will permanently remove <strong>{deleteTarget.filename}</strong> from your Media
              Library and private storage. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelDeleteFile}
                disabled={deletingSingle}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDeleteFile}
                disabled={deletingSingle}
              >
                {deletingSingle ? "Deleting..." : "Yes, delete file"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                    <>
                      {/* Signed URLs are dynamic and may include ephemeral query parameters. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={focusedFile.signedUrl}
                        alt={focusedFile.filename}
                        onError={() => handleMediaPreviewError(focusedFile)}
                      />
                    </>
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
                <button
                  className="btn-danger modal-delete-btn"
                  type="button"
                  onClick={() => requestDeleteFile(focusedFile)}
                >
                  Delete file
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
