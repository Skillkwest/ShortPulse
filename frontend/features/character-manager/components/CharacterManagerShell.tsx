/**
 * Character Manager page shell.
 * Renders beginner-focused character setup with fixed 10-shot drop zones and activation checks.
 */
import Link from "next/link";
import Image from "next/image";
import React, { useMemo, useRef, useState } from "react";
import { CheckCircle, House, UploadSimple, WarningCircle, XCircle } from "phosphor-react";
import { CHARACTER_MANAGER_SLOT_DEFINITIONS } from "../constants";
import { useCharacterManagerDraft } from "../hooks/useCharacterManagerDraft";
import type { CharacterReferenceSlotKey, CharacterSlotFile } from "../types";

const formatBytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const resolveSlotValidationSummary = (slotFile: CharacterSlotFile | null) => {
  if (!slotFile) return null;
  if (slotFile.validationStatus === "fail") {
    return {
      statusLabel: "Fix Required",
      message: slotFile.validationNotes.hardErrors[0] ?? "This shot must be replaced.",
    };
  }
  if (slotFile.validationStatus === "warn") {
    return {
      statusLabel: "Warning",
      message: slotFile.validationNotes.warnings[0] ?? "Quality warning detected.",
    };
  }
  if (slotFile.validationStatus === "pass") {
    return {
      statusLabel: "Validated",
      message: "Shot passes current deterministic checks.",
    };
  }
  return {
    statusLabel: "Pending",
    message: "Validation is pending.",
  };
};

/**
 * Orchestrates slot uploads and progress for Character Manager.
 */
export function CharacterManagerShell() {
  const {
    characters,
    selectedCharacterId,
    characterName,
    slots,
    error,
    notice,
    completedCount,
    totalCount,
    canActivate,
    loading,
    isSavingName,
    isActivating,
    isCreatingCharacter,
    isSwitchingCharacter,
    isRevalidating,
    missingSlotKeys,
    failedSlotKeys,
    setCharacterName,
    setSlotFile,
    clearSlot,
    activateDraft,
    revalidateCurrentPack,
    createCharacter,
    selectCharacter,
    isSlotBusy,
    clearMessages,
  } = useCharacterManagerDraft();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSlotKey, setActiveSlotKey] = useState<CharacterReferenceSlotKey | null>(null);
  const [dragSlotKey, setDragSlotKey] = useState<CharacterReferenceSlotKey | null>(null);
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const pageBusy =
    loading || isSwitchingCharacter || isRevalidating || isActivating || isCreatingCharacter;
  const missingLabels = useMemo(
    () =>
      CHARACTER_MANAGER_SLOT_DEFINITIONS.filter((slot) => missingSlotKeys.includes(slot.key)).map(
        (slot) => slot.label
      ),
    [missingSlotKeys]
  );
  const failedLabels = useMemo(
    () =>
      CHARACTER_MANAGER_SLOT_DEFINITIONS.filter((slot) => failedSlotKeys.includes(slot.key)).map(
        (slot) => slot.label
      ),
    [failedSlotKeys]
  );

  const openSlotPicker = (slotKey: CharacterReferenceSlotKey) => {
    if (pageBusy || isSlotBusy(slotKey)) return;
    clearMessages();
    setActiveSlotKey(slotKey);
    fileInputRef.current?.click();
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const slotKey = activeSlotKey;
    event.target.value = "";
    if (!file || !slotKey) return;
    void setSlotFile(slotKey, file);
  };

  return (
    <main id="main-content" className="page page-wide character-manager-page">
      <div className="page-top">
        <Link href="/dashboard" className="media-dashboard-link" aria-label="Dashboard">
          <House size={16} weight="regular" />
          Dashboard
        </Link>
      </div>

      <section className="panel saved-header-bar saved-hero hero-image-card character-manager-hero">
        <div className="saved-header-left">
          <div className="saved-title-stack">
            <div className="saved-title-row">
              <h1 className="title">Character Manager</h1>
            </div>
            <p className="subdued">
              Upload the 10 required shots to build a consistent character reference pack for
              Seedream generation.
            </p>
          </div>
        </div>
        <div className="character-hero-summary">
          <div className="character-progress-meter" aria-label="Reference completion">
            <div className="character-progress-meta">
              <span className="metric-label tiny">Completion</span>
              <strong>
                {completedCount}/{totalCount}
              </strong>
            </div>
            <div className="character-progress-track" aria-hidden="true">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
          <span className={`pill tiny ${canActivate ? "pill-ready" : "pill-pending"}`}>
            {loading ? "Loading draft..." : canActivate ? "Ready to activate" : "Draft in progress"}
          </span>
        </div>
      </section>

      <section className="character-manager-layout">
        <aside className="panel media-panel character-list-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Characters</p>
              <h2>Library</h2>
            </div>
            <button
              type="button"
              className="ghost-btn small"
              onClick={() => void createCharacter()}
              disabled={isCreatingCharacter || loading}
            >
              New character
            </button>
          </div>
          <div className="character-list-stack" role="list" aria-label="Character list">
            {characters.map((character) => {
              const isSelected = character.characterId === selectedCharacterId;
              const listStatus =
                character.characterStatus === "active"
                  ? "Active"
                  : character.hasFailedSlots
                    ? "Needs fixes"
                    : character.completedCount >= character.totalCount
                      ? "Ready"
                      : `${character.completedCount}/${character.totalCount}`;
              return (
                <button
                  key={character.characterId}
                  type="button"
                  role="listitem"
                  className={`character-list-card ${isSelected ? "is-active" : ""}`}
                  onClick={() => void selectCharacter(character.characterId)}
                  disabled={pageBusy}
                >
                  <div>
                    <p className="metric-label tiny">
                      {isSelected ? "Current draft" : "Character"}
                    </p>
                    <p className="character-list-name">
                      {character.characterName || "Untitled character"}
                    </p>
                  </div>
                  <span
                    className={`pill tiny ${
                      character.characterStatus === "active" ||
                      character.hasFailedSlots ||
                      (isSelected && canActivate) ||
                      character.completedCount >= character.totalCount
                        ? character.hasFailedSlots
                          ? "pill-pending"
                          : "pill-ready"
                        : "pill-pending"
                    }`}
                  >
                    {listStatus}
                  </span>
                </button>
              );
            })}
          </div>
          {isSwitchingCharacter ? (
            <p className="tiny subdued" aria-live="polite">
              Loading selected character...
            </p>
          ) : null}
          <p className="tiny subdued">
            Character management actions (duplicate/archive/version history) will be added in the
            next phase.
          </p>
        </aside>

        <div className="panel media-panel character-builder-panel">
          <div className="character-builder-top">
            <label className="control-row" htmlFor="character-manager-name">
              <span className="input-label">Character Name</span>
              <input
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
            <button
              type="button"
              className="primary-btn character-primary-btn"
              onClick={() => void activateDraft()}
              disabled={
                !canActivate || loading || isSwitchingCharacter || isRevalidating || isActivating
              }
            >
              {isActivating ? "Activating..." : "Activate Reference Pack"}
            </button>
          </div>
          <div className="character-builder-actions">
            <button
              type="button"
              className="ghost-btn small"
              onClick={() => void revalidateCurrentPack()}
              disabled={loading || isSwitchingCharacter || isRevalidating || isActivating}
            >
              {isRevalidating ? "Revalidating..." : "Revalidate All Shots"}
            </button>
          </div>
          {isSavingName ? (
            <p className="tiny subdued" aria-live="polite">
              Saving character name...
            </p>
          ) : null}

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
          {!loading && failedLabels.length ? (
            <div className="character-feedback error" role="status">
              <XCircle size={16} weight="fill" />
              <span>Fix failed shots: {failedLabels.join(", ")}</span>
            </div>
          ) : null}
          {!loading && !canActivate && missingLabels.length ? (
            <div className="character-feedback warning" role="status">
              <WarningCircle size={16} weight="fill" />
              <span>Missing shots: {missingLabels.join(", ")}</span>
            </div>
          ) : null}

          <div className="character-shot-grid" role="list" aria-label="Required character shots">
            {CHARACTER_MANAGER_SLOT_DEFINITIONS.map((slot, index) => {
              const slotFile = slots[slot.key];
              const isFilled = Boolean(slotFile);
              const isDragging = dragSlotKey === slot.key;
              const slotBusy = isSlotBusy(slot.key);
              const validationSummary = resolveSlotValidationSummary(slotFile);
              const validationStatus = slotFile?.validationStatus ?? "pending";
              return (
                <article
                  key={slot.key}
                  role="listitem"
                  className={`character-shot-card ${isFilled ? "is-filled" : ""} ${isDragging ? "is-dragging" : ""} ${
                    validationStatus === "warn" ? "is-warn" : ""
                  } ${validationStatus === "fail" ? "is-fail" : ""}`}
                >
                  <div className="character-shot-header">
                    <p className="metric-label tiny">
                      Shot {index + 1}
                      <span className="character-required-tag">Required</span>
                    </p>
                    <h3>{slot.label}</h3>
                  </div>
                  <button
                    type="button"
                    className="character-shot-dropzone"
                    aria-label={`${slot.label} upload zone`}
                    disabled={slotBusy}
                    onClick={() => openSlotPicker(slot.key)}
                    onDragOver={(event) => {
                      if (slotBusy) return;
                      event.preventDefault();
                      setDragSlotKey(slot.key);
                    }}
                    onDragLeave={() => setDragSlotKey((prev) => (prev === slot.key ? null : prev))}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragSlotKey(null);
                      if (slotBusy) return;
                      const file = event.dataTransfer.files?.[0];
                      if (!file) return;
                      void setSlotFile(slot.key, file);
                    }}
                    onKeyDown={(event) => {
                      if (slotBusy) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openSlotPicker(slot.key);
                      }
                    }}
                  >
                    {slotBusy ? (
                      <span className="character-shot-empty">Saving shot...</span>
                    ) : slotFile ? (
                      <>
                        <Image
                          src={slotFile.previewUrl}
                          alt={`${slot.label} preview`}
                          className="character-shot-thumb"
                          width={640}
                          height={800}
                          unoptimized
                        />
                        <span className="character-shot-file">{slotFile.name}</span>
                      </>
                    ) : (
                      <span className="character-shot-empty">Drop image or click to upload</span>
                    )}
                  </button>
                  <p className="tiny subdued">{slot.helper}</p>
                  <p className="tiny subdued">{slot.hint}</p>
                  {validationSummary ? (
                    <p
                      className={`tiny character-validation-note ${
                        validationStatus === "fail"
                          ? "is-fail"
                          : validationStatus === "warn"
                            ? "is-warn"
                            : "is-pass"
                      }`}
                    >
                      {validationSummary.statusLabel}: {validationSummary.message}
                    </p>
                  ) : null}
                  <div className="character-shot-actions">
                    <button
                      type="button"
                      className="ghost-btn small"
                      onClick={() => openSlotPicker(slot.key)}
                      disabled={slotBusy}
                    >
                      <UploadSimple size={14} weight="bold" />
                      {slotFile ? "Replace" : "Upload"}
                    </button>
                    {slotFile ? (
                      <>
                        <span className="tiny subdued">{formatBytes(slotFile.size)}</span>
                        <button
                          type="button"
                          className="ghost-btn small character-remove-btn"
                          onClick={() => void clearSlot(slot.key)}
                          disabled={slotBusy}
                        >
                          Remove
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelection}
        hidden
      />
    </main>
  );
}
