/**
 * Shared right-rail Styles chooser surface.
 * Reuses the same selection-only Styles rail markup across the split-layout branches.
 */
import React from "react";
import {
  NONE_STYLE_ID,
  prependNoneStyleTile,
  resolveStylePreviewBackgroundImage,
  type ExpertEditStyleTile,
} from "../../components/edit/expertEditStyles";
import { Prohibit } from "phosphor-react";

type ReferenceStylesChooserProps = {
  showStylesReferenceDivider: boolean;
  showStylesInventoryDivider: boolean;
  showStylesTitleInHeader: boolean;
  showTopStylesHeaderDivider: boolean;
  stylesHeaderRef: React.MutableRefObject<HTMLDivElement | null>;
  stylesPanel?: {
    selectedStyleId: string | null;
    styles: readonly ExpertEditStyleTile[];
    onSelectStyle?: (styleId: string | null) => void;
  };
  isReferenceGridExpanded: boolean;
  sectionStyle?: React.CSSProperties;
};

export function ReferenceStylesChooser({
  showStylesReferenceDivider,
  showStylesInventoryDivider,
  showStylesTitleInHeader,
  showTopStylesHeaderDivider,
  stylesHeaderRef,
  stylesPanel,
  isReferenceGridExpanded,
  sectionStyle,
}: ReferenceStylesChooserProps) {
  const styleTiles = stylesPanel?.styles ?? [];
  const styleTilesWithNone = prependNoneStyleTile(styleTiles);

  return (
    <section
      id="reference-rail-styles-section"
      className={`reference-styles-section${
        showStylesReferenceDivider && isReferenceGridExpanded ? " is-reference-grid-expanded" : ""
      }`}
      style={showStylesInventoryDivider ? sectionStyle : undefined}
      aria-label="Styles"
    >
      <div
        ref={stylesHeaderRef}
        className={`reference-styles-header${!showStylesTitleInHeader ? " is-title-hidden" : ""}`}
      >
        {showStylesTitleInHeader ? (
          <div
            className={`reference-section-title-row${
              showTopStylesHeaderDivider ? " is-top-section-header" : ""
            }`}
          >
            <p className="eyebrow">Styles</p>
            {showTopStylesHeaderDivider ? (
              <span className="reference-section-title-divider" aria-hidden="true" />
            ) : null}
          </div>
        ) : null}
        <p className="tiny subdued helper-text">
          Choose a style preset now. Drag-and-drop workflow support is coming soon.
        </p>
      </div>
      <div className="reference-styles-scroll">
        <div className="reference-styles-grid" role="list" aria-label="Style options">
          {styleTilesWithNone.map((style) => {
            const isNoneStyle = style.id === NONE_STYLE_ID;
            const isSelected = isNoneStyle
              ? stylesPanel?.selectedStyleId == null
              : !style.placeholder && stylesPanel?.selectedStyleId === style.id;
            return (
              <button
                key={style.id}
                type="button"
                className={`reference-styles-tile ${isSelected ? "is-selected" : ""} ${
                  style.placeholder ? "is-placeholder" : ""
                }`.trim()}
                aria-label={`Style tile: ${style.title}${style.placeholder ? " (coming soon)" : ""}`}
                aria-pressed={style.placeholder ? undefined : isSelected}
                disabled={style.placeholder}
                onClick={() => {
                  if (style.placeholder) return;
                  stylesPanel?.onSelectStyle?.(isNoneStyle ? null : style.id);
                }}
              >
                <span className="reference-styles-tile-title">{style.title}</span>
                <span
                  className="reference-styles-tile-preview"
                  style={
                    style.previewUrl
                      ? {
                          backgroundImage: resolveStylePreviewBackgroundImage(style.previewUrl),
                        }
                      : undefined
                  }
                  aria-hidden="true"
                >
                  {style.placeholder ? (
                    <span className="reference-styles-tile-coming-soon">Coming soon</span>
                  ) : isNoneStyle ? (
                    <span className="reference-styles-none-icon" aria-hidden="true">
                      <Prohibit size={28} weight="duotone" />
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
