/**
 * Character tool page.
 * Frontend-first workflow for building a persistent identity and generating consistent shots.
 */
import Head from "next/head";
import Link from "next/link";
import React, { useCallback, useRef } from "react";
import { ArrowLeft } from "phosphor-react";
import { CharacterPropertiesPanel } from "../features/character/components/CharacterPropertiesPanel";
import { CharacterPreview } from "../features/character/components/CharacterPreview";
import { useCharacterWorkflow } from "../features/character/hooks/useCharacterWorkflow";
import type { CharacterEngine, CharacterModelId } from "../features/character/types";

export default function CharacterPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    identity,
    aspect,
    modelId,
    engine,
    prompt,
    poseId,
    results,
    isBuildingIdentity,
    isGenerating,
    error,
    setPrompt,
    setAspect,
    setModelId,
    setEngine,
    setPoseId,
    addReferences,
    removeReference,
    buildIdentity,
    generate,
    clearError,
  } = useCharacterWorkflow();

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      addReferences(files);
    }
    event.target.value = "";
  };

  const canGenerate = prompt.trim().length > 0 && !isGenerating;

  const handleGenerate = useCallback(() => {
    if (!canGenerate) return;
    void generate();
  }, [canGenerate, generate]);

  return (
    <>
      <Head>
        <title>Character | ShortPulse</title>
      </Head>
      <div className="ai-studio-page workspace-page character-page">
        <header className="workspace-header">
          <div className="workspace-breadcrumb">
            <Link className="workspace-back" href="/dashboard">
              <ArrowLeft size={16} weight="bold" /> Back to dashboard
            </Link>
            <p className="eyebrow">Pulse · Character</p>
            <p className="tiny subdued">Identity-first image generation with minimal safety.</p>
          </div>
        </header>

        {error ? (
          <div className="inline-error-banner" role="status">
            <span>{error}</span>
            <button type="button" className="ghost-btn mini" onClick={clearError}>
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="studio-grid">
          <div className="studio-column studio-column-left">
            <CharacterPropertiesPanel
              identity={identity}
              aspect={aspect}
              modelId={modelId}
              engine={engine}
              prompt={prompt}
              poseId={poseId}
              isBuildingIdentity={isBuildingIdentity}
              isGenerating={isGenerating}
              onPromptChange={setPrompt}
              onAspectChange={setAspect}
              onModelChange={(value) => setModelId(value as CharacterModelId)}
              onEngineChange={(value) => setEngine(value as CharacterEngine)}
              onPoseChange={setPoseId}
              onUploadClick={handleUploadClick}
              onDropFiles={(files) => addReferences(files)}
              onRemoveReference={removeReference}
              onBuildIdentity={buildIdentity}
              onGenerate={handleGenerate}
            />
          </div>
          <div className="studio-column studio-column-right">
            <CharacterPreview identity={identity} results={results} onUploadClick={handleUploadClick} />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          hidden
        />
      </div>
    </>
  );
}
