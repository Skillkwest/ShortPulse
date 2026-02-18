/**
 * AI Studio shell render counters used by local perf audits.
 * Tracks render counts for isolated shell sections without external tooling dependencies.
 */
export type AiStudioShellSection = "toolbar" | "properties" | "reference" | "preview";

export type AiStudioShellSectionRenderCounters = Record<AiStudioShellSection, number>;

const createInitialCounters = (): AiStudioShellSectionRenderCounters => ({
  toolbar: 0,
  properties: 0,
  reference: 0,
  preview: 0,
});

let shellSectionRenderCounters = createInitialCounters();

/**
 * Increments a render counter for a specific shell section.
 */
export const recordAiStudioShellSectionRender = (section: AiStudioShellSection) => {
  shellSectionRenderCounters = {
    ...shellSectionRenderCounters,
    [section]: shellSectionRenderCounters[section] + 1,
  };
};

/**
 * Resets all shell section render counters.
 */
export const resetAiStudioShellSectionRenderCounters = () => {
  shellSectionRenderCounters = createInitialCounters();
};

/**
 * Returns a snapshot of section render counters.
 */
export const getAiStudioShellSectionRenderCounters = (): AiStudioShellSectionRenderCounters => ({
  ...shellSectionRenderCounters,
});
