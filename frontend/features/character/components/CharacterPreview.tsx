/**
 * Preview + references column for the Character tool.
 */
import React from "react";
import type { CharacterGenerationResult, CharacterIdentity } from "../types";

type CharacterPreviewProps = {
  identity: CharacterIdentity;
  results: CharacterGenerationResult[];
  onUploadClick: () => void;
};

export function CharacterPreview({ identity, results, onUploadClick }: CharacterPreviewProps) {
  const latest = results[0];
  return (
    <div className="studio-preview">
      <div className="preview-header">
        <div>
          <p className="eyebrow">Preview</p>
          <p className="tiny subdued helper-text">Most recent generation appears here.</p>
        </div>
        <button type="button" className="ghost-btn mini" onClick={onUploadClick}>
          Add refs
        </button>
      </div>

      <div className="preview-frame">
        {latest ? (
          <>
            {/* Generated/reference sources may include signed URLs and blob URLs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={latest.imageUrl} alt="Latest generation" className="preview-image" />
          </>
        ) : (
          <div className="preview-placeholder">
            <p className="subdued tiny helper-text">Generate to see the character preview.</p>
          </div>
        )}
      </div>

      <div className="preview-reel">
        <p className="eyebrow">Recent generations</p>
        <div className="preview-reel-grid">
          {results.length ? (
            results.map((result) => (
              <div className="preview-reel-card" key={result.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.imageUrl} alt="Character output" />
                <p className="tiny subdued">
                  {new Date(result.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))
          ) : (
            <p className="tiny subdued helper-text">Outputs will appear here.</p>
          )}
        </div>
      </div>

      <div className="identity-strip">
        <p className="eyebrow">Identity references</p>
        <div className="identity-ref-grid">
          {identity.references.length ? (
            identity.references.map((ref) => (
              <div className="identity-ref-card" key={ref.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ref.url} alt={ref.name ?? "Reference"} />
              </div>
            ))
          ) : (
            <p className="tiny subdued helper-text">No references yet. Upload to start.</p>
          )}
        </div>
      </div>
    </div>
  );
}
