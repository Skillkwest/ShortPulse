/**
 * Character Manager page shell.
 * Provides a simplified character creation uploader and a placeholder manage tab.
 */
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, ShieldCheck, Trash, UploadSimple, XCircle } from "phosphor-react";
import { DashboardNavPrefab } from "../../../components/DashboardNavPrefab";
import { buildPlanView, normalizePlanId, type BillingPlanRecord } from "../../billing/catalog";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import {
  CHARACTER_MANAGER_SLOT_DEFINITIONS,
  CHARACTER_MANAGER_SLOT_LABEL_BY_KEY,
} from "../constants";
import { useCharacterManagerDraft } from "../hooks/useCharacterManagerDraft";
import type { CharacterProfileImageTransform } from "../types";

type CharacterWorkflowTab = "create" | "manage";
const SIMPLE_REFERENCE_IMAGE_LIMIT = 4;
const PROFILE_ZOOM_MIN = 1;
const PROFILE_ZOOM_MAX = 2.4;
const PROFILE_OFFSET_MIN = -40;
const PROFILE_OFFSET_MAX = 40;
const DEFAULT_PLAN_TIER = "business";
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

/**
 * Orchestrates simple character creation flow while advanced uploader remains hidden.
 */
export function CharacterManagerShell() {
  const {
    characters,
    selectedCharacterId,
    characterName,
    profileImageUrl,
    profileImageTransform,
    slots,
    error,
    notice,
    loading,
    isSavingName,
    isActivating,
    isCreatingCharacter,
    isDeletingCharacter,
    isSwitchingCharacter,
    isRevalidating,
    isSavingProfileImage,
    setCharacterName,
    setProfileImageFile,
    saveProfileImageTransform,
    clearProfileImage,
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
  const [characterDescription, setCharacterDescription] = useState("");
  const [isProfileAdjusterVisible, setIsProfileAdjusterVisible] = useState(false);
  const [profileAdjustDraft, setProfileAdjustDraft] =
    useState<CharacterProfileImageTransform | null>(null);
  const [deleteTargetCharacter, setDeleteTargetCharacter] = useState<{
    characterId: string;
    characterName: string;
  } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [resolvedPlan, setResolvedPlan] = useState<{ label: string; className: string } | null>(
    null
  );
  const characterNameInputRef = useRef<HTMLInputElement | null>(null);
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);
  const simpleFileInputRef = useRef<HTMLInputElement | null>(null);
  const pageBusy =
    loading ||
    isSwitchingCharacter ||
    isRevalidating ||
    isActivating ||
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
    setCharacterDescription("");
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

  return (
    <main id="main-content" className="page page-wide character-manager-page">
      <div className="page-top">
        <DashboardNavPrefab />
      </div>

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
          <button
            type="button"
            className="character-mode-create-btn"
            onClick={handleCreateNewCharacter}
            disabled={isCreatingCharacter || loading}
          >
            {isCreatingCharacter ? "Creating..." : "Create New Character"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="character-feedback error" role="status">
          <XCircle size={16} weight="fill" />
          <span>{error}</span>
        </div>
      ) : null}
      {notice ? (
        <div className="character-feedback notice" role="status">
          <CheckCircle size={16} weight="fill" />
          <span>{notice}</span>
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
            <section className="character-section">
              <div className="character-section-head">
                <div>
                  <p className="eyebrow">1. Character Identity</p>
                  <h3 className="character-section-title">Profile Setup</h3>
                </div>
              </div>

              <div className="character-profile-card">
                <div className="character-profile-photo-stack">
                  <button
                    type="button"
                    className="character-profile-photo-btn"
                    onClick={openProfilePicker}
                    disabled={pageBusy}
                    aria-label={
                      profileImageUrl && !isProfileAdjusterVisible
                        ? "Edit profile photo adjustments"
                        : "Upload profile photo"
                    }
                  >
                    {profileImageUrl ? (
                      <Image
                        src={profileImageUrl}
                        alt="Character profile"
                        className="character-profile-photo"
                        style={{
                          transform: `translate(${activeProfileImageTransform.offsetX}px, ${activeProfileImageTransform.offsetY}px) scale(${activeProfileImageTransform.zoom})`,
                          transformOrigin: "center center",
                        }}
                        width={172}
                        height={172}
                        unoptimized
                      />
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

                <div className="character-profile-fields">
                  <label
                    className="control-row character-simple-field"
                    htmlFor="character-manager-name"
                  >
                    <span className="input-label">Character Name</span>
                    <input
                      ref={characterNameInputRef}
                      id="character-manager-name"
                      className="character-name-input"
                      type="text"
                      value={characterName}
                      maxLength={80}
                      onChange={(event) => setCharacterName(event.target.value)}
                      placeholder="Enter character name"
                      disabled={loading || isActivating}
                    />
                  </label>

                  <label
                    className="control-row character-simple-field"
                    htmlFor="character-manager-description"
                  >
                    <span className="input-label">Character Description</span>
                    <textarea
                      id="character-manager-description"
                      className="character-description-input"
                      rows={6}
                      value={characterDescription}
                      maxLength={500}
                      onChange={(event) => setCharacterDescription(event.target.value)}
                      placeholder="Describe this character (style, vibe, outfit, key visual traits)."
                      disabled={loading || isActivating}
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="character-section">
              <div className="character-section-head">
                <div>
                  <p className="eyebrow">2. Reference Images</p>
                  <h3 className="character-section-title">Reference Pack</h3>
                </div>
              </div>

              <button
                type="button"
                className={`character-simple-dropzone ${isDropActive ? "is-active" : ""}`}
                onClick={openSimplePicker}
                disabled={pageBusy || !availableReferenceSlotKeys.length}
                onDragOver={(event) => {
                  if (pageBusy || !availableReferenceSlotKeys.length) return;
                  event.preventDefault();
                  setIsDropActive(true);
                }}
                onDragLeave={() => setIsDropActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDropActive(false);
                  if (pageBusy || !availableReferenceSlotKeys.length) return;
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
                    {availableReferenceSlotKeys.length > 0
                      ? `Up to ${availableReferenceSlotKeys.length} more image(s) can be added (max ${SIMPLE_REFERENCE_IMAGE_LIMIT})`
                      : `Maximum of ${SIMPLE_REFERENCE_IMAGE_LIMIT} reference images reached`}
                  </p>
                </div>
              </button>

              {uploadedReferenceEntries.length ? (
                <div
                  className="character-reference-upload-grid"
                  role="list"
                  aria-label="Uploaded references"
                >
                  {uploadedReferenceEntries.map((entry, index) => (
                    <article
                      key={entry.slotKey}
                      role="listitem"
                      className="character-reference-upload-card"
                    >
                      <div className="character-reference-upload-image-wrap">
                        <Image
                          src={entry.slotFile.previewUrl}
                          alt={`Reference ${index + 1}: ${entry.slotLabel}`}
                          className="character-reference-upload-image"
                          width={320}
                          height={240}
                          unoptimized
                        />
                      </div>
                      <div className="character-reference-upload-meta">
                        <p className="character-reference-upload-label tiny">
                          Reference {index + 1}
                        </p>
                        <p className="character-reference-upload-name" title={entry.slotFile.name}>
                          {entry.slotFile.name}
                        </p>
                        <button
                          type="button"
                          className="ghost-btn small character-reference-upload-remove character-remove-btn"
                          onClick={() => {
                            void clearSlot(entry.slotKey);
                          }}
                          disabled={pageBusy || isSlotBusy(entry.slotKey)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="character-reference-empty-grid" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </section>
          </div>
        </section>
      ) : (
        <section className="panel media-panel character-manage-panel">
          <div>
            <p className="eyebrow">Manage Existing</p>
            <h2>Character Library</h2>
            <p className="tiny subdued">
              Select a character to continue editing it in the create flow.
            </p>
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
                            width={44}
                            height={44}
                            unoptimized
                          />
                        ) : (
                          <span className="character-list-avatar-initials">{chipInitials}</span>
                        )}
                      </span>
                      <div className="character-list-copy">
                        <p className="metric-label tiny">
                          {isSelected ? "Current draft" : "Character"}
                        </p>
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
    </main>
  );
}
