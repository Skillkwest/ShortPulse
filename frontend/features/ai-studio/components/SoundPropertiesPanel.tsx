/**
 * Placeholder properties panel for the Sound workflow.
 * Keeps toolbar-to-panel wiring in place while audio controls are staged.
 */
import React from "react";

/**
 * Renders the temporary Sound panel copy until full controls ship.
 */
export const SoundPropertiesPanel = React.memo(function SoundPropertiesPanel() {
  return (
    <section className="sound-properties-panel" aria-label="Sound properties">
      <p className="eyebrow">Sound</p>
      <h2 className="panel-title">Sound Properties</h2>
      <p className="tiny subdued">
        Sound controls are not implemented yet. This panel is now wired and selectable.
      </p>
    </section>
  );
});
