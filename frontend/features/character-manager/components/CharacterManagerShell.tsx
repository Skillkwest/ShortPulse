/**
 * Character Manager page shell.
 * Provides a simplified character creation uploader and a placeholder manage tab.
 */
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, PencilSimpleLine, ShieldCheck, Trash, UploadSimple, XCircle } from "phosphor-react";
import { DashboardNavPrefab } from "../../../components/DashboardNavPrefab";
import { buildPlanView, normalizePlanId, type BillingPlanRecord } from "../../billing/catalog";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import {
  CHARACTER_MANAGER_SLOT_DEFINITIONS,
  CHARACTER_MANAGER_SLOT_LABEL_BY_KEY,
  CHARACTER_SHEET_DROP_ZONES,
} from "../constants";
import { useCharacterManagerDraft } from "../hooks/useCharacterManagerDraft";
import type {
  CharacterProfileImageTransform,
  CharacterSheetDropZoneKey,
  CharacterSheetAssignments,
  CharacterReferenceSlotKey,
} from "../types";

type CharacterWorkflowTab = "create" | "manage";
const SIMPLE_REFERENCE_IMAGE_LIMIT = 8;
const PROFILE_ZOOM_MIN = 1;
const PROFILE_ZOOM_MAX = 2.4;
const PROFILE_OFFSET_MIN = -40;
const PROFILE_OFFSET_MAX = 40;
const PROFILE_PREVIEW_IMAGE_SIZE = 172;
const CHARACTER_CHIP_AVATAR_SIZE = 44;
const CHARACTER_DESCRIPTION_MAX_LENGTH = 150;
const DEFAULT_REFERENCE_PREVIEW_ASPECT_RATIO = 4 / 5;
const DEFAULT_PLAN_TIER = "business";
const DND_REFERENCE_SLOT_KEY = "application/x-shortpulse-reference-slot-key";
const DND_CHARACTER_SHEET_ZONE_KEY = "application/x-shortpulse-character-sheet-zone-key";
const DRAG_GHOST_SCALE = 0.74;
const CHARACTER_SHEET_FULL_NOTICE = "Click and drag a reference from your drop references.";
const CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY = "shortpulse.character_manager.beginner_mode";

const DEFAULT_PROFILE_IMAGE_TRANSFORM: CharacterProfileImageTransform = {
  zoom: PROFILE_ZOOM_MIN,
  offsetX: 0,
  offsetY: 0,
};

const PLAN_MAP: Record<string, { label: string; className: string }> = {
  free: { label: "Free", className: "plan-free" },
  media: { label: "Media", className: "plan-media" },
  studio: { label: "Studio", className: "plan-studio" },
  business: { label: "Business", className: "plan-business" },
};

function clampReferencePreviewAspectRatio(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_REFERENCE_PREVIEW_ASPECT_RATIO;
  }
  return Math.min(Math.max(value, 0.45), 2.8);
}

function buildProfileImageTransformStyle(
  transform: CharacterProfileImageTransform,
  renderSize: number
): React.CSSProperties {
  const offsetScale = renderSize / PROFILE_PREVIEW_IMAGE_SIZE;
  const offsetX = Math.round(transform.offsetX * offsetScale * 100) / 100;
  const offsetY = Math.round(transform.offsetY * offsetScale * 100) / 100;
  return {
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${transform.zoom})`,
    transformOrigin: "center center",
  };
}

const resolveInitialBeginnerMode = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY);
    if (stored == null) return true;
    return stored === "true";
  } catch {
    return true;
  }
};

/**
 * Orchestrates simple character creation flow while advanced uploader remains hidden.
 */
export function CharacterManagerShell() {
  const {
    characters,
    selectedCharacterId,
    characterName,
    characterDescription,
    characterSheetAssignments,
    profileImageUrl,
    profileImageTransform,
    slots,
    error,
    loading,
    isSavingName,
    isCreatingCharacter,
    isDeletingCharacter,
    isSwitchingCharacter,
    isSavingProfileImage,
    setCharacterName,
    setCharacterDescription,
    setProfileImageFile,
    saveProfileImageTransform,
    clearProfileImage,
    saveCharacterSheetAssignments,
    setSlotFile,
    clearSlot,
    createCharacter,
    selectCharacter,
    deleteCharacter,
    isSlotBusy,
    clearMessages,
  } = useCharacterManagerDraft();

  const [activeTab, setActiveTab] = useState<CharacterWorkflowTab>("create");
  const [isDropActive, setIsDropActive] = useState(false);
  const [draggedReferenceSlotKey, setDraggedReferenceSlotKey] =
    useState<CharacterReferenceSlotKey | null>(null);
  const [draggedCharacterSheetZoneKey, setDraggedCharacterSheetZoneKey] =
    useState<CharacterSheetDropZoneKey | null>(null);
  const [activeCharacterSheetDropZone, setActiveCharacterSheetDropZone] =
    useState<CharacterSheetDropZoneKey | null>(null);
  const [isProfileAdjusterVisible, setIsProfileAdjusterVisible] = useState(false);
  const [profileAdjustDraft, setProfileAdjustDraft] =
    useState<CharacterProfileImageTransform | null>(null);
  const [deleteTargetCharacter, setDeleteTargetCharacter] = useState<{
    characterId: string;
    characterName: string;
  } | null>(null);
  const [referencePreview, setReferencePreview] = useState<{
    index: number;
    aspectRatio: number;
  } | null>(null);
  const [pendingCharacterSheetUploadZoneKey, setPendingCharacterSheetUploadZoneKey] =
    useState<CharacterSheetDropZoneKey | null>(null);
  const [characterSheetUploadNotice, setCharacterSheetUploadNotice] = useState<string | null>(null);
  const [beginnerMode, setBeginnerMode] = useState(resolveInitialBeginnerMode);
  const [user, setUser] = useState<User | null>(null);
  const [resolvedPlan, setResolvedPlan] = useState<{ label: string; className: string } | null>(
    null
  );
  const characterNameInputRef = useRef<HTMLInputElement | null>(null);
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);
  const simpleFileInputRef = useRef<HTMLInputElement | null>(null);
  const characterSheetFileInputRef = useRef<HTMLInputElement | null>(null);
  const dragGhostMapRef = useRef(new Map<HTMLElement, HTMLElement>());
  const pageBusy =
    loading ||
    isSwitchingCharacter ||
    isCreatingCharacter ||
    isDeletingCharacter ||
    isSavingProfileImage;
  const profileInitials = useMemo(() => {
    const words = characterName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!words.length) return "NC";
    return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  }, [characterName]);
  const accountDisplayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "ShortPulse";
  const accountInitials = useMemo(() => {
    return (
      accountDisplayName
        .split(" ")
        .filter((part) => part.trim().length > 0)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "SP"
    );
  }, [accountDisplayName]);
  const fallbackPlanTier = normalizePlanId(
    (user?.user_metadata?.plan as string | undefined) ?? DEFAULT_PLAN_TIER
  );
  const fallbackPlanMeta = PLAN_MAP[fallbackPlanTier] ?? PLAN_MAP.business;
  const planMeta = resolvedPlan ?? fallbackPlanMeta;
  const activeProfileImageTransform =
    isProfileAdjusterVisible && profileAdjustDraft ? profileAdjustDraft : profileImageTransform;

  const simpleReferenceSlotKeys = useMemo(
    () =>
      CHARACTER_MANAGER_SLOT_DEFINITIONS.map((slot) => slot.key).slice(
        0,
        SIMPLE_REFERENCE_IMAGE_LIMIT
      ),
    []
  );

  const availableReferenceSlotKeys = useMemo(
    () => simpleReferenceSlotKeys.filter((slotKey) => !slots[slotKey]),
    [simpleReferenceSlotKeys, slots]
  );

  const uploadedReferenceEntries = useMemo(
    () =>
      simpleReferenceSlotKeys
        .map((slotKey) => {
          const slotFile = slots[slotKey];
          if (!slotFile) return null;
          return {
            slotKey,
            slotFile,
            slotLabel: CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[slotKey],
          };
        })
        .filter(
          (
            entry
          ): entry is {
            slotKey: (typeof simpleReferenceSlotKeys)[number];
            slotFile: NonNullable<(typeof slots)[(typeof simpleReferenceSlotKeys)[number]]>;
            slotLabel: string;
          } => Boolean(entry)
        ),
    [simpleReferenceSlotKeys, slots]
  );
  const totalReferenceSlotCount = simpleReferenceSlotKeys.length;
  const usedReferenceSlotCount = uploadedReferenceEntries.length;
  const remainingReferenceSlotCount = Math.max(
    0,
    SIMPLE_REFERENCE_IMAGE_LIMIT - uploadedReferenceEntries.length
  );
  const referencePreviewEntry =
    referencePreview && uploadedReferenceEntries[referencePreview.index]
      ? uploadedReferenceEntries[referencePreview.index]
      : null;
  const uploadedReferenceBySlotKey = useMemo(
    () => new Map(uploadedReferenceEntries.map((entry) => [entry.slotKey, entry])),
    [uploadedReferenceEntries]
  );
  const characterSheetAssignmentsUi = characterSheetAssignments;

  const effectiveCharacterSheetAssignments = useMemo(() => {
    const next = { ...characterSheetAssignmentsUi };
    for (const dropZone of CHARACTER_SHEET_DROP_ZONES) {
      const assignedSlotKey = next[dropZone.key];
      if (assignedSlotKey && !uploadedReferenceBySlotKey.has(assignedSlotKey)) {
        next[dropZone.key] = null;
      }
    }
    return next;
  }, [characterSheetAssignmentsUi, uploadedReferenceBySlotKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY, String(beginnerMode));
  }, [beginnerMode]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const bootstrapUser = async () => {
      try {
        const supabase = ensureSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        setUser(data.user ?? null);
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          if (event === "USER_UPDATED" || event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
            setUser(session?.user ?? null);
          }
          if (event === "SIGNED_OUT") {
            setUser(null);
          }
        });
        unsubscribe = () => authListener?.subscription?.unsubscribe();
      } catch {
        if (active) {
          setUser(null);
        }
      }
    };

    void bootstrapUser();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadPlan = async () => {
      if (!user) {
        if (!active) return;
        setResolvedPlan(null);
        return;
      }

      try {
        const supabase = ensureSupabaseClient();
        const [billingProfileResponse, billingPlansResponse] = await Promise.all([
          supabase.from("billing_profiles").select("plan_id").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("billing_plans")
            .select("id, display_name, monthly_price_cents, monthly_credits_cents, is_active")
            .eq("is_active", true),
        ]);

        const billingPlanId =
          !billingProfileResponse.error && billingProfileResponse.data
            ? ((billingProfileResponse.data as { plan_id: string | null }).plan_id ?? null)
            : null;
        const effectivePlanId =
          billingPlanId ?? (user.user_metadata?.plan as string | undefined) ?? DEFAULT_PLAN_TIER;
        const normalizedPlanId = normalizePlanId(effectivePlanId);
        const plans =
          !billingPlansResponse.error && Array.isArray(billingPlansResponse.data)
            ? (billingPlansResponse.data as BillingPlanRecord[])
            : [];
        const planView = buildPlanView({
          planId: normalizedPlanId,
          plans,
        });
        const planFallback = PLAN_MAP[normalizedPlanId] ?? PLAN_MAP.business;
        const nextPlanLabel = plans.length > 0 ? planView.displayName : planFallback.label;

        if (!active) return;
        setResolvedPlan({
          label: nextPlanLabel,
          className: planView.className,
        });
      } catch {
        if (!active) return;
        setResolvedPlan(null);
      }
    };

    void loadPlan();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(
    () => () => {
      for (const ghost of dragGhostMapRef.current.values()) {
        ghost.remove();
      }
      dragGhostMapRef.current.clear();
    },
    []
  );

  const uploadSimpleFiles = useCallback(
    async (incomingFiles: FileList | File[]) => {
      const files = Array.from(incomingFiles);
      if (!files.length || pageBusy || !availableReferenceSlotKeys.length) return;

      clearMessages();
      const assignableFiles = files.slice(0, availableReferenceSlotKeys.length);
      for (let index = 0; index < assignableFiles.length; index += 1) {
        const slotKey = availableReferenceSlotKeys[index];
        const file = assignableFiles[index];
        if (!slotKey || !file) continue;
        // Keep mapping deterministic: first dropped files fill first open reference slots.
        await setSlotFile(slotKey, file);
      }
    },
    [availableReferenceSlotKeys, clearMessages, pageBusy, setSlotFile]
  );

  const openSimplePicker = useCallback(() => {
    if (pageBusy) return;
    clearMessages();
    simpleFileInputRef.current?.click();
  }, [clearMessages, pageBusy]);

  const handleSimpleFileSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      event.target.value = "";
      if (!files.length) return;
      void uploadSimpleFiles(files);
    },
    [uploadSimpleFiles]
  );

  const openCharacterSheetPicker = useCallback(
    (dropZoneKey: CharacterSheetDropZoneKey) => {
      if (pageBusy) return;
      clearMessages();
      if (!availableReferenceSlotKeys.length) {
        setCharacterSheetUploadNotice(CHARACTER_SHEET_FULL_NOTICE);
        return;
      }
      setCharacterSheetUploadNotice(null);
      setPendingCharacterSheetUploadZoneKey(dropZoneKey);
      characterSheetFileInputRef.current?.click();
    },
    [availableReferenceSlotKeys.length, clearMessages, pageBusy]
  );

  const openProfilePicker = useCallback(() => {
    if (pageBusy) return;
    if (profileImageUrl && !isProfileAdjusterVisible) {
      setProfileAdjustDraft(profileImageTransform);
      setIsProfileAdjusterVisible(true);
      return;
    }
    clearMessages();
    profileFileInputRef.current?.click();
  }, [clearMessages, isProfileAdjusterVisible, pageBusy, profileImageTransform, profileImageUrl]);

  const handleProfileSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || pageBusy) return;
      void setProfileImageFile(file);
      setProfileAdjustDraft(DEFAULT_PROFILE_IMAGE_TRANSFORM);
      setIsProfileAdjusterVisible(true);
    },
    [pageBusy, setProfileImageFile]
  );

  const clearProfilePreview = useCallback(() => {
    void clearProfileImage();
    setProfileAdjustDraft(null);
    setIsProfileAdjusterVisible(false);
    if (profileFileInputRef.current) {
      profileFileInputRef.current.value = "";
    }
  }, [clearProfileImage]);

  const handleCreateNewCharacter = useCallback(() => {
    setActiveTab("create");
    setProfileAdjustDraft(null);
    setIsProfileAdjusterVisible(false);

    void createCharacter().finally(() => {
      setActiveTab("create");
      window.requestAnimationFrame(() => {
        characterNameInputRef.current?.focus();
      });
    });
  }, [createCharacter]);

  const saveProfileAdjustments = useCallback(async () => {
    if (!profileImageUrl) {
      setProfileAdjustDraft(null);
      setIsProfileAdjusterVisible(false);
      return;
    }

    const didSave = await saveProfileImageTransform({
      zoom: activeProfileImageTransform.zoom,
      offsetX: activeProfileImageTransform.offsetX,
      offsetY: activeProfileImageTransform.offsetY,
    });
    if (didSave) {
      setProfileAdjustDraft(null);
      setIsProfileAdjusterVisible(false);
    }
  }, [activeProfileImageTransform, profileImageUrl, saveProfileImageTransform]);

  const getCharacterInitials = useCallback((name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!words.length) return "NC";
    return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  }, []);

  const cancelDeleteCharacter = useCallback(() => {
    if (isDeletingCharacter) return;
    setDeleteTargetCharacter(null);
  }, [isDeletingCharacter]);

  const confirmDeleteCharacter = useCallback(async () => {
    if (!deleteTargetCharacter) return;
    const deleted = await deleteCharacter(deleteTargetCharacter.characterId);
    if (deleted) {
      setDeleteTargetCharacter(null);
    }
  }, [deleteCharacter, deleteTargetCharacter]);

  const applyDragGhost = useCallback((event: React.DragEvent<HTMLElement>) => {
    const dragNode = event.currentTarget as HTMLElement;
    const transfer = event.dataTransfer;
    try {
      const rect = dragNode.getBoundingClientRect();
      const ghost = dragNode.cloneNode(true) as HTMLElement;
      const scaledWidth = Math.max(56, rect.width * DRAG_GHOST_SCALE);
      const scaledHeight = Math.max(72, rect.height * DRAG_GHOST_SCALE);
      ghost.classList.add("character-drag-ghost");
      ghost.style.boxSizing = "border-box";
      ghost.style.width = `${scaledWidth}px`;
      ghost.style.height = `${scaledHeight}px`;
      ghost.style.transform = `scale(${DRAG_GHOST_SCALE}) rotate(-2deg)`;
      ghost.style.transformOrigin = "center";
      ghost.style.position = "absolute";
      ghost.style.top = "-9999px";
      ghost.style.left = "-9999px";
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.96";

      document.body.appendChild(ghost);
      dragGhostMapRef.current.set(dragNode, ghost);
      transfer.setDragImage(ghost, scaledWidth / 2, scaledHeight / 2);
    } catch {
      transfer.setDragImage(dragNode, dragNode.offsetWidth / 2, dragNode.offsetHeight / 2);
    }
    dragNode.classList.add("is-dragging");
  }, []);

  const persistCharacterSheetAssignments = useCallback(
    (nextAssignments: CharacterSheetAssignments) => {
      if (!selectedCharacterId) return;
      void saveCharacterSheetAssignments(nextAssignments);
    },
    [saveCharacterSheetAssignments, selectedCharacterId]
  );

  const assignReferenceToCharacterSheetSlot = useCallback(
    (
      characterSheetSlotKey: CharacterSheetDropZoneKey,
      referenceSlotKey: CharacterReferenceSlotKey
    ) => {
      if (!selectedCharacterId) return;
      const nextAssignments = {
        ...effectiveCharacterSheetAssignments,
        [characterSheetSlotKey]: referenceSlotKey,
      };
      persistCharacterSheetAssignments(nextAssignments);
    },
    [effectiveCharacterSheetAssignments, persistCharacterSheetAssignments, selectedCharacterId]
  );

  const handleCharacterSheetFileSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      const targetDropZone = pendingCharacterSheetUploadZoneKey;
      setPendingCharacterSheetUploadZoneKey(null);

      if (!file || !targetDropZone || pageBusy) return;
      const targetSlotKey = availableReferenceSlotKeys[0];
      if (!targetSlotKey) {
        setCharacterSheetUploadNotice(CHARACTER_SHEET_FULL_NOTICE);
        return;
      }

      setCharacterSheetUploadNotice(null);
      void (async () => {
        const didSave = await setSlotFile(targetSlotKey, file);
        if (!didSave) return;
        assignReferenceToCharacterSheetSlot(targetDropZone, targetSlotKey);
      })();
    },
    [
      assignReferenceToCharacterSheetSlot,
      availableReferenceSlotKeys,
      pageBusy,
      pendingCharacterSheetUploadZoneKey,
      setSlotFile,
    ]
  );

  const clearReferenceAssignmentsFromCharacterSheet = useCallback(
    (referenceSlotKey: CharacterReferenceSlotKey) => {
      if (!selectedCharacterId) return;
      let changed = false;
      const nextAssignments = { ...effectiveCharacterSheetAssignments };
      for (const dropZone of CHARACTER_SHEET_DROP_ZONES) {
        if (nextAssignments[dropZone.key] !== referenceSlotKey) {
          continue;
        }
        nextAssignments[dropZone.key] = null;
        changed = true;
      }
      if (!changed) return;
      persistCharacterSheetAssignments(nextAssignments);
    },
    [effectiveCharacterSheetAssignments, persistCharacterSheetAssignments, selectedCharacterId]
  );

  const openReferencePreview = useCallback((index: number, aspectRatio: number | null) => {
    setReferencePreview({
      index,
      aspectRatio: clampReferencePreviewAspectRatio(aspectRatio),
    });
  }, []);

  const closeReferencePreview = useCallback(() => {
    setReferencePreview(null);
  }, []);

  const navigateReferencePreview = useCallback(
    (step: -1 | 1) => {
      setReferencePreview((current) => {
        if (!current || uploadedReferenceEntries.length === 0) return current;
        const total = uploadedReferenceEntries.length;
        const nextIndex = (current.index + step + total) % total;
        const nextEntry = uploadedReferenceEntries[nextIndex];
        return {
          index: nextIndex,
          aspectRatio: clampReferencePreviewAspectRatio(
            nextEntry?.slotFile.validationNotes.aspectRatio ?? null
          ),
        };
      });
    },
    [uploadedReferenceEntries]
  );

  const handleReferenceDragStart = useCallback(
    (slotKey: CharacterReferenceSlotKey) => (event: React.DragEvent<HTMLElement>) => {
      if (pageBusy || isSlotBusy(slotKey)) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(DND_REFERENCE_SLOT_KEY, slotKey);
      event.dataTransfer.setData("text/plain", slotKey);
      setDraggedReferenceSlotKey(slotKey);
      setDraggedCharacterSheetZoneKey(null);
      applyDragGhost(event);
    },
    [applyDragGhost, isSlotBusy, pageBusy]
  );

  const handleCharacterSheetDragStart = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: React.DragEvent<HTMLElement>) => {
      if (pageBusy) {
        event.preventDefault();
        return;
      }
      const assignedSlotKey = effectiveCharacterSheetAssignments[characterSheetSlotKey];
      if (!assignedSlotKey) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(DND_CHARACTER_SHEET_ZONE_KEY, characterSheetSlotKey);
      event.dataTransfer.setData(DND_REFERENCE_SLOT_KEY, assignedSlotKey);
      event.dataTransfer.setData("text/plain", assignedSlotKey);
      setDraggedCharacterSheetZoneKey(characterSheetSlotKey);
      setDraggedReferenceSlotKey(assignedSlotKey);
      applyDragGhost(event);
    },
    [applyDragGhost, effectiveCharacterSheetAssignments, pageBusy]
  );

  const handleReferenceDragEnd = useCallback((event: React.DragEvent<HTMLElement>) => {
    const dragNode = event.currentTarget as HTMLElement;
    dragNode.classList.remove("is-dragging");
    const ghost = dragGhostMapRef.current.get(dragNode);
    if (ghost) {
      ghost.remove();
      dragGhostMapRef.current.delete(dragNode);
    }
    setDraggedReferenceSlotKey(null);
    setDraggedCharacterSheetZoneKey(null);
    setActiveCharacterSheetDropZone(null);
  }, []);

  const handleCharacterSheetDragOver = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: React.DragEvent<HTMLElement>) => {
      if (pageBusy) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setActiveCharacterSheetDropZone(characterSheetSlotKey);
    },
    [pageBusy]
  );

  const clearCharacterSheetAssignment = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => {
      if (!selectedCharacterId) return;
      const assignedSlotKey = effectiveCharacterSheetAssignments[characterSheetSlotKey];
      if (!assignedSlotKey) return;
      const nextAssignments = {
        ...effectiveCharacterSheetAssignments,
        [characterSheetSlotKey]: null,
      };
      persistCharacterSheetAssignments(nextAssignments);
    },
    [effectiveCharacterSheetAssignments, persistCharacterSheetAssignments, selectedCharacterId]
  );

  const handleCharacterSheetDrop = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      setActiveCharacterSheetDropZone(null);
      if (pageBusy) return;
      const sourceCharacterSheetZoneKey =
        (event.dataTransfer.getData(DND_CHARACTER_SHEET_ZONE_KEY) as
          | CharacterSheetDropZoneKey
          | "") || draggedCharacterSheetZoneKey;
      if (
        sourceCharacterSheetZoneKey &&
        CHARACTER_SHEET_DROP_ZONES.some((slot) => slot.key === sourceCharacterSheetZoneKey)
      ) {
        const sourceSlotKey = effectiveCharacterSheetAssignments[sourceCharacterSheetZoneKey];
        if (!sourceSlotKey) return;
        if (sourceCharacterSheetZoneKey === characterSheetSlotKey) return;
        const targetSlotKey = effectiveCharacterSheetAssignments[characterSheetSlotKey];
        const nextAssignments = {
          ...effectiveCharacterSheetAssignments,
          [sourceCharacterSheetZoneKey]: targetSlotKey ?? null,
          [characterSheetSlotKey]: sourceSlotKey,
        };
        persistCharacterSheetAssignments(nextAssignments);
        return;
      }

      const droppedSlotKey =
        (event.dataTransfer.getData(DND_REFERENCE_SLOT_KEY) as CharacterReferenceSlotKey | "") ||
        (event.dataTransfer.getData("text/plain") as CharacterReferenceSlotKey | "") ||
        draggedReferenceSlotKey;
      if (!droppedSlotKey) return;
      if (!uploadedReferenceBySlotKey.has(droppedSlotKey)) return;
      assignReferenceToCharacterSheetSlot(characterSheetSlotKey, droppedSlotKey);
    },
    [
      assignReferenceToCharacterSheetSlot,
      draggedCharacterSheetZoneKey,
      draggedReferenceSlotKey,
      effectiveCharacterSheetAssignments,
      pageBusy,
      persistCharacterSheetAssignments,
      uploadedReferenceBySlotKey,
    ]
  );

  const handleCharacterSheetCardClick = useCallback(
    (dropZoneKey: CharacterSheetDropZoneKey) => () => {
      if (pageBusy) return;
      const assignedSlotKey = effectiveCharacterSheetAssignments[dropZoneKey];
      if (assignedSlotKey) return;
      openCharacterSheetPicker(dropZoneKey);
    },
    [effectiveCharacterSheetAssignments, openCharacterSheetPicker, pageBusy]
  );

  useEffect(() => {
    if (!characterSheetUploadNotice) return;
    const timeoutId = window.setTimeout(() => {
      setCharacterSheetUploadNotice(null);
    }, 4200);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [characterSheetUploadNotice]);

  useEffect(() => {
    if (!referencePreview) return;
    const handleModalKeyboardShortcuts = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeReferencePreview();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateReferencePreview(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateReferencePreview(-1);
      }
    };
    window.addEventListener("keydown", handleModalKeyboardShortcuts);
    return () => {
      window.removeEventListener("keydown", handleModalKeyboardShortcuts);
    };
  }, [closeReferencePreview, navigateReferencePreview, referencePreview]);

  return (
    <main
      id="main-content"
      className="page page-wide character-manager-page"
      data-beginner-mode={beginnerMode ? "on" : "off"}
    >
      <section className="panel saved-header-bar saved-hero hero-image-card character-manager-hero">
        <div className="saved-header-left">
          <div className="saved-title-stack">
            <div className="saved-title-row">
              <h1 className="title">Character Manager</h1>
            </div>
            <p className="subdued">
              Start with a simple uploader to define your character and add reference images.
            </p>
          </div>
        </div>
        <div className="character-manager-header-right">
          <div className="header-cards character-manager-header-cards">
            <div className="header-stat-card" aria-label="Plan status">
              <div className="status-icon compact" aria-hidden="true">
                <ShieldCheck size={16} weight="bold" />
              </div>
              <div className="header-card-body">
                <p className="metric-label tiny">Plan</p>
                <p className={`status-value small ${planMeta.className ?? ""}`}>{planMeta.label}</p>
              </div>
            </div>
          </div>
          <Link
            href="/profile?section=account"
            className="avatar-card character-manager-profile-link"
            aria-label="Account and profile settings"
          >
            <div className="avatar">{accountInitials}</div>
          </Link>
        </div>
      </section>

      <section
        className="panel media-panel character-mode-panel"
        aria-label="Character workflow tabs"
      >
        <div className="character-mode-row">
          <DashboardNavPrefab variant="inline" className="character-mode-dashboard-link" />
          <div
            className="character-mode-tab-row"
            role="tablist"
            aria-label="Character workflow mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "create"}
              className={`character-mode-tab ${activeTab === "create" ? "is-active" : ""}`}
              onClick={() => setActiveTab("create")}
            >
              Character Profile
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "manage"}
              className={`character-mode-tab ${activeTab === "manage" ? "is-active" : ""}`}
              onClick={() => setActiveTab("manage")}
            >
              Manage Characters
            </button>
          </div>
          {activeTab === "create" ? (
            <div className="toolbar-beginner-toggle character-mode-beginner-toggle">
              <div className="toolbar-beginner-copy">
                <span className="toolbar-label">Beginner mode</span>
              </div>
              <button
                type="button"
                className={`reference-toggle beginner-toggle ${beginnerMode ? "is-active" : ""}`}
                aria-pressed={beginnerMode}
                aria-label={beginnerMode ? "Disable beginner mode" : "Enable beginner mode"}
                onClick={() => setBeginnerMode((current) => !current)}
              >
                <span className="reference-toggle-track" aria-hidden="true">
                  <span className="reference-toggle-dot" />
                </span>
              </button>
            </div>
          ) : null}
          {activeTab === "create" && beginnerMode ? (
            <p className="character-mode-guidance" role="note">
              <span className="character-mode-guidance-label">Tip:</span>
              Swap out your character&apos;s style on the fly by dragging and dropping references
              from the reference panel.
            </p>
          ) : null}
          {activeTab === "manage" ? (
            <button
              type="button"
              className="character-mode-create-btn"
              onClick={handleCreateNewCharacter}
              disabled={isCreatingCharacter || loading}
            >
              {isCreatingCharacter ? (
                "Creating..."
              ) : (
                <>
                  <Plus
                    size={14}
                    weight="bold"
                    className="character-mode-create-btn-icon"
                    aria-hidden
                  />
                  <span>Create New Character</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="character-feedback error" role="status">
          <XCircle size={16} weight="fill" />
          <span>{error}</span>
        </div>
      ) : null}
      {characterSheetUploadNotice ? (
        <div className="character-feedback notice" role="status">
          <UploadSimple size={16} weight="bold" />
          <span>{characterSheetUploadNotice}</span>
        </div>
      ) : null}
      {isSavingName ? (
        <p className="tiny subdued" aria-live="polite">
          Saving character name...
        </p>
      ) : null}

      {activeTab === "create" ? (
        <section className="character-simple-panel">
          <div className="character-create-flow">
            <div className="character-create-primary-column">
              <section className="character-section character-section--profile">
                <div className="character-section-head">
                  <div className="character-section-title-row">
                    {beginnerMode ? (
                      <span className="character-step-badge" aria-hidden="true">
                        1
                      </span>
                    ) : null}
                    <div className="character-section-title-copy">
                      <h3 className="character-section-title">Identity</h3>
                      {beginnerMode ? (
                        <p className="character-section-helper tiny subdued">
                          Set the photo, name, and description that define this character.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="character-profile-card">
                  <div className="character-profile-photo-stack">
                    <button
                      type="button"
                      className={`character-profile-photo-btn ${profileImageUrl ? "has-image" : ""}`}
                      onClick={openProfilePicker}
                      disabled={pageBusy}
                      aria-label={
                        profileImageUrl && !isProfileAdjusterVisible
                          ? "Edit profile photo adjustments"
                          : "Upload profile photo"
                      }
                    >
                      {profileImageUrl ? (
                        <>
                          <Image
                            src={profileImageUrl}
                            alt="Character profile"
                            className="character-profile-photo"
                            style={buildProfileImageTransformStyle(
                              activeProfileImageTransform,
                              PROFILE_PREVIEW_IMAGE_SIZE
                            )}
                            width={PROFILE_PREVIEW_IMAGE_SIZE}
                            height={PROFILE_PREVIEW_IMAGE_SIZE}
                            unoptimized
                          />
                          <span className="character-profile-edit-indicator" aria-hidden="true">
                            <PencilSimpleLine size={14} weight="bold" />
                            <span>Edit photo</span>
                          </span>
                        </>
                      ) : (
                        <span className="character-profile-initials" aria-hidden>
                          {profileInitials}
                        </span>
                      )}
                    </button>
                    {profileImageUrl && isProfileAdjusterVisible ? (
                      <div
                        className="character-profile-adjuster"
                        role="group"
                        aria-label="Profile crop controls"
                      >
                        <div className="character-profile-adjuster-row">
                          <label
                            className="character-profile-adjuster-label"
                            htmlFor="profile-adjust-zoom"
                          >
                            <span>Zoom</span>
                            <span>{Math.round(activeProfileImageTransform.zoom * 100)}%</span>
                          </label>
                          <input
                            id="profile-adjust-zoom"
                            className="character-profile-adjuster-range"
                            type="range"
                            min={PROFILE_ZOOM_MIN}
                            max={PROFILE_ZOOM_MAX}
                            step={0.01}
                            value={activeProfileImageTransform.zoom}
                            onChange={(event) => {
                              const nextZoom = Number(event.target.value);
                              setProfileAdjustDraft((previous) => ({
                                ...(previous ?? profileImageTransform),
                                zoom: nextZoom,
                              }));
                            }}
                          />
                        </div>
                        <div className="character-profile-adjuster-row">
                          <label
                            className="character-profile-adjuster-label"
                            htmlFor="profile-adjust-x"
                          >
                            <span>Horizontal</span>
                            <span>
                              {activeProfileImageTransform.offsetX > 0
                                ? `+${activeProfileImageTransform.offsetX}`
                                : activeProfileImageTransform.offsetX}
                            </span>
                          </label>
                          <input
                            id="profile-adjust-x"
                            className="character-profile-adjuster-range"
                            type="range"
                            min={PROFILE_OFFSET_MIN}
                            max={PROFILE_OFFSET_MAX}
                            step={1}
                            value={activeProfileImageTransform.offsetX}
                            onChange={(event) => {
                              const nextOffsetX = Number(event.target.value);
                              setProfileAdjustDraft((previous) => ({
                                ...(previous ?? profileImageTransform),
                                offsetX: nextOffsetX,
                              }));
                            }}
                          />
                        </div>
                        <div className="character-profile-adjuster-row">
                          <label
                            className="character-profile-adjuster-label"
                            htmlFor="profile-adjust-y"
                          >
                            <span>Vertical</span>
                            <span>
                              {activeProfileImageTransform.offsetY > 0
                                ? `+${activeProfileImageTransform.offsetY}`
                                : activeProfileImageTransform.offsetY}
                            </span>
                          </label>
                          <input
                            id="profile-adjust-y"
                            className="character-profile-adjuster-range"
                            type="range"
                            min={PROFILE_OFFSET_MIN}
                            max={PROFILE_OFFSET_MAX}
                            step={1}
                            value={activeProfileImageTransform.offsetY}
                            onChange={(event) => {
                              const nextOffsetY = Number(event.target.value);
                              setProfileAdjustDraft((previous) => ({
                                ...(previous ?? profileImageTransform),
                                offsetY: nextOffsetY,
                              }));
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="ghost-btn small character-profile-adjuster-reset"
                          onClick={() => {
                            void saveProfileAdjustments();
                          }}
                          disabled={pageBusy}
                        >
                          {isSavingProfileImage ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="ghost-btn small character-profile-adjuster-remove character-remove-btn"
                          onClick={clearProfilePreview}
                          disabled={pageBusy}
                        >
                          Remove photo
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="character-profile-fields character-profile-fields--label-serif">
                    <label
                      className="control-row character-simple-field"
                      htmlFor="character-manager-name"
                    >
                      <span className="input-label">Name:</span>
                      <input
                        ref={characterNameInputRef}
                        id="character-manager-name"
                        className="character-name-input"
                        type="text"
                        value={characterName}
                        maxLength={80}
                        onChange={(event) => setCharacterName(event.target.value)}
                        placeholder="Enter character name"
                        disabled={loading}
                      />
                    </label>

                    <label
                      className="control-row character-simple-field"
                      htmlFor="character-manager-description"
                    >
                      <span className="input-label">Description:</span>
                      <textarea
                        id="character-manager-description"
                        className="character-description-input"
                        rows={3}
                        value={characterDescription}
                        maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
                        onChange={(event) => setCharacterDescription(event.target.value)}
                        placeholder="A gorgeous woman in her early 30s with brown hair and dark amber eyes, she has a slim, toned waist, a curvy lower body, and thick thighs."
                        disabled={loading}
                      />
                      <div className="character-description-footer-row">
                        <p className="character-description-helper tiny subdued">
                          Tip: Character description will be used as part of character consistency
                          generation.
                        </p>
                        <p className="character-description-count tiny subdued">
                          {characterDescription.length}/{CHARACTER_DESCRIPTION_MAX_LENGTH}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </section>

              <section className="character-section character-section--reference-drop">
                <div className="character-section-head">
                  <div className="character-section-title-row">
                    {beginnerMode ? (
                      <span className="character-step-badge" aria-hidden="true">
                        2
                      </span>
                    ) : null}
                    <div className="character-section-title-copy">
                      <h3 className="character-section-title">Reference Panel</h3>
                      {beginnerMode ? (
                        <p className="character-section-helper tiny subdued">
                          Upload clear reference shots to build this character&apos;s source set.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p
                    className="character-reference-slot-counter tiny subdued"
                    aria-label={`Reference slots used: ${usedReferenceSlotCount} of ${totalReferenceSlotCount}`}
                  >
                    {usedReferenceSlotCount}/{totalReferenceSlotCount} slots used
                  </p>
                </div>

                {availableReferenceSlotKeys.length ? (
                  <button
                    type="button"
                    className={`character-simple-dropzone character-simple-dropzone--compact ${isDropActive ? "is-active" : ""}`}
                    onClick={openSimplePicker}
                    disabled={pageBusy}
                    onDragOver={(event) => {
                      if (pageBusy) return;
                      event.preventDefault();
                      setIsDropActive(true);
                    }}
                    onDragLeave={() => setIsDropActive(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDropActive(false);
                      if (pageBusy) return;
                      const files = event.dataTransfer?.files;
                      if (!files?.length) return;
                      void uploadSimpleFiles(files);
                    }}
                  >
                    <div className="character-dropzone-content">
                      <UploadSimple size={32} weight="bold" className="character-dropzone-icon" />
                      <p className="character-simple-drop-title">Drop reference images here</p>
                      <p className="tiny subdued">
                        Or click to browse files. Add multiple images at once for faster setup.
                      </p>
                      <p className="tiny subdued">
                        {`Up to ${availableReferenceSlotKeys.length} more image(s) can be added (max ${SIMPLE_REFERENCE_IMAGE_LIMIT})`}
                      </p>
                    </div>
                  </button>
                ) : null}

                <div
                  className="character-reference-upload-grid character-reference-upload-grid--drop-card"
                  role="list"
                  aria-label="Uploaded references"
                >
                  {uploadedReferenceEntries.map((entry, index) => (
                    <article
                      key={entry.slotKey}
                      role="listitem"
                      className={`character-reference-upload-card ${
                        draggedReferenceSlotKey === entry.slotKey ? "is-dragging" : ""
                      }`}
                      draggable={!pageBusy && !isSlotBusy(entry.slotKey)}
                      onDragStart={handleReferenceDragStart(entry.slotKey)}
                      onDragEnd={handleReferenceDragEnd}
                    >
                      <button
                        type="button"
                        className="character-list-delete-btn character-reference-delete-btn"
                        aria-label={`Remove reference ${index + 1}`}
                        onClick={() => {
                          clearReferenceAssignmentsFromCharacterSheet(entry.slotKey);
                          void clearSlot(entry.slotKey);
                        }}
                        disabled={pageBusy || isSlotBusy(entry.slotKey)}
                      >
                        <Trash size={12} weight="bold" />
                      </button>
                      <div
                        className="character-reference-upload-image-wrap"
                        onDoubleClick={() => {
                          openReferencePreview(index, entry.slotFile.validationNotes.aspectRatio);
                        }}
                        title="Double-click to preview this reference image"
                      >
                        <Image
                          src={entry.slotFile.previewUrl}
                          alt={`Reference ${index + 1}: ${entry.slotLabel}`}
                          className="character-reference-upload-image"
                          width={320}
                          height={240}
                          unoptimized
                        />
                      </div>
                    </article>
                  ))}
                  {Array.from({ length: remainingReferenceSlotCount }).map((_, index) => (
                    <span
                      key={`reference-upload-placeholder-${index}`}
                      className="character-reference-upload-placeholder"
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </section>
            </div>

            <section className="character-section character-section--references">
              <div className="character-section-head">
                <div className="character-section-title-row">
                  {beginnerMode ? (
                    <span className="character-step-badge" aria-hidden="true">
                      3
                    </span>
                  ) : null}
                  <div className="character-section-title-copy">
                    <h3 className="character-section-title">Character Sheet</h3>
                    {beginnerMode ? (
                      <p className="character-section-helper tiny subdued">
                        Drag uploaded references into each slot to map your character&apos;s look
                        and style.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="character-reference-empty-grid">
                {CHARACTER_SHEET_DROP_ZONES.map((dropZone) => {
                  const assignedSlotKey = effectiveCharacterSheetAssignments[dropZone.key];
                  const assignedReference = assignedSlotKey
                    ? uploadedReferenceBySlotKey.get(assignedSlotKey)
                    : null;
                  const isDropActive = activeCharacterSheetDropZone === dropZone.key;
                  return (
                    <article
                      key={dropZone.key}
                      className={`character-character-sheet-card ${
                        assignedReference ? "is-filled" : "is-empty"
                      } ${isDropActive ? "is-drop-active" : ""} ${
                        draggedCharacterSheetZoneKey === dropZone.key ? "is-dragging" : ""
                      }`}
                      draggable={!pageBusy && Boolean(assignedReference)}
                      onClick={handleCharacterSheetCardClick(dropZone.key)}
                      onDragStart={handleCharacterSheetDragStart(dropZone.key)}
                      onDragEnd={handleReferenceDragEnd}
                      onDragOver={handleCharacterSheetDragOver(dropZone.key)}
                      onDragLeave={() => {
                        setActiveCharacterSheetDropZone((current) =>
                          current === dropZone.key ? null : current
                        );
                      }}
                      onDrop={handleCharacterSheetDrop(dropZone.key)}
                    >
                      {assignedReference ? (
                        <button
                          type="button"
                          className="character-list-delete-btn character-reference-delete-btn character-character-sheet-delete-btn"
                          aria-label={`Clear ${dropZone.label} reference`}
                          onClick={(event) => {
                            event.stopPropagation();
                            clearCharacterSheetAssignment(dropZone.key);
                          }}
                          disabled={pageBusy}
                        >
                          <Trash size={12} weight="bold" />
                        </button>
                      ) : null}
                      <div className="character-character-sheet-media">
                        {assignedReference ? (
                          <Image
                            src={assignedReference.slotFile.previewUrl}
                            alt={`${dropZone.label} reference`}
                            className="character-character-sheet-image"
                            width={240}
                            height={300}
                            unoptimized
                          />
                        ) : (
                          <span className="character-character-sheet-drop-copy tiny">
                            Drop reference
                          </span>
                        )}
                      </div>
                      <span className="character-reference-empty-hint">{dropZone.label}</span>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </section>
      ) : (
        <section className="panel media-panel character-manage-panel">
          <div>
            <p className="eyebrow">Manage Existing</p>
            <h2>Character Library</h2>
            <p className="tiny subdued">Select a character to edit their character profile.</p>
          </div>

          <div className="character-manage-list" role="list" aria-label="Character list">
            {characters.map((character) => {
              const isSelected = character.characterId === selectedCharacterId;
              const chipName = character.characterName || "Untitled character";
              const chipInitials = getCharacterInitials(chipName);
              return (
                <article
                  key={character.characterId}
                  role="listitem"
                  className={`character-list-card ${isSelected ? "is-active" : ""} ${
                    pageBusy ? "is-disabled" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="character-list-select-btn"
                    onClick={() => {
                      void selectCharacter(character.characterId);
                      setActiveTab("create");
                    }}
                    disabled={pageBusy}
                  >
                    <div className="character-list-main">
                      <span className="character-list-avatar" aria-hidden="true">
                        {character.profileImageUrl ? (
                          <Image
                            src={character.profileImageUrl}
                            alt=""
                            className="character-list-avatar-image"
                            style={
                              character.profileImageTransform
                                ? buildProfileImageTransformStyle(
                                    character.profileImageTransform,
                                    CHARACTER_CHIP_AVATAR_SIZE
                                  )
                                : undefined
                            }
                            width={CHARACTER_CHIP_AVATAR_SIZE}
                            height={CHARACTER_CHIP_AVATAR_SIZE}
                            unoptimized
                          />
                        ) : (
                          <span className="character-list-avatar-initials">{chipInitials}</span>
                        )}
                      </span>
                      <div className="character-list-copy">
                        <p className="metric-label tiny">{isSelected ? "Selected" : "Character"}</p>
                        <p className="character-list-name">{chipName}</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="character-list-delete-btn"
                    aria-label={`Delete character: ${chipName}`}
                    onClick={() => {
                      setDeleteTargetCharacter({
                        characterId: character.characterId,
                        characterName: chipName,
                      });
                    }}
                    disabled={pageBusy}
                  >
                    <Trash size={12} weight="bold" />
                  </button>
                </article>
              );
            })}
          </div>
          {isSwitchingCharacter ? (
            <p className="tiny subdued" aria-live="polite">
              Loading selected character...
            </p>
          ) : null}
        </section>
      )}

      {referencePreview && referencePreviewEntry ? (
        <div className="character-reference-preview-overlay" role="dialog" aria-modal="true">
          <div
            className="character-reference-preview-modal"
            style={
              {
                "--character-reference-preview-aspect-ratio": String(referencePreview.aspectRatio),
              } as React.CSSProperties
            }
          >
            <button
              type="button"
              className="character-reference-preview-close"
              onClick={closeReferencePreview}
              aria-label="Close reference preview"
            >
              X
            </button>
            <Image
              src={referencePreviewEntry.slotFile.previewUrl}
              alt={`Reference ${referencePreview.index + 1}: ${referencePreviewEntry.slotLabel}`}
              className="character-reference-preview-image"
              width={1600}
              height={1600}
              onLoadingComplete={(loadedImage) => {
                const loadedAspectRatio = loadedImage.naturalWidth / loadedImage.naturalHeight;
                if (!Number.isFinite(loadedAspectRatio) || loadedAspectRatio <= 0) return;
                const clampedAspectRatio = clampReferencePreviewAspectRatio(loadedAspectRatio);
                setReferencePreview((current) => {
                  if (!current) return current;
                  const currentEntry = uploadedReferenceEntries[current.index];
                  if (!currentEntry || currentEntry.slotKey !== referencePreviewEntry.slotKey) {
                    return current;
                  }
                  if (Math.abs(current.aspectRatio - clampedAspectRatio) < 0.001) return current;
                  return { ...current, aspectRatio: clampedAspectRatio };
                });
              }}
              unoptimized
            />
          </div>
        </div>
      ) : null}

      {deleteTargetCharacter ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-character-title"
        >
          <div className="modal-card character-delete-confirm-card">
            <h3 id="delete-character-title">Delete this character?</h3>
            <p className="subdued tiny character-delete-confirm-copy">
              This will permanently remove <strong>{deleteTargetCharacter.characterName}</strong>{" "}
              and its reference images from Character Manager. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelDeleteCharacter}
                disabled={isDeletingCharacter}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger character-delete-confirm-btn"
                onClick={() => {
                  void confirmDeleteCharacter();
                }}
                disabled={isDeletingCharacter}
              >
                {isDeletingCharacter ? "Deleting..." : "Yes, delete character"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={profileFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleProfileSelection}
        hidden
      />

      <input
        ref={simpleFileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSimpleFileSelection}
        hidden
      />

      <input
        ref={characterSheetFileInputRef}
        data-testid="character-sheet-upload-input"
        type="file"
        accept="image/*"
        onChange={handleCharacterSheetFileSelection}
        hidden
      />
    </main>
  );
}
