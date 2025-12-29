/**
 * Collapsible cohort analytics section with stats rail and scatter chart.
 * Keeps aggregation logic outside the page so the layout can stay declarative.
 */
import { PerformanceScatter } from "../../../components/PerformanceScatter";
import { BREAKOUT_SCORE } from "../constants";
import { CohortSummary, summarizeCohort } from "../logic/analytics";
import { ScoredVideo } from "../types";
import { formatCompact, formatPercent } from "../utils/formatters";

export type CohortAnalyticsSectionProps = {
  dataset: ScoredVideo[];
  advancedOpen: boolean;
  onToggle: () => void;
};

/**
 * Render the advanced analytics panel containing cohort stats and scatter plot.
 */
export function CohortAnalyticsSection({ dataset, advancedOpen, onToggle }: CohortAnalyticsSectionProps) {
  const summary: CohortSummary = summarizeCohort(dataset, BREAKOUT_SCORE);

  return (
    <section className="panel">
      <button className="collapse-header" onClick={onToggle} aria-expanded={advancedOpen}>
        <span>{advancedOpen ? "Advanced cohort analytics ▴" : "Advanced cohort analytics ▾"}</span>
      </button>
      {advancedOpen ? (
        <>
          <div className="stat-rail minimal">
            <div className="stat-card">
              <p className="stat-label">Breakout share</p>
              <p className="stat-value">
                <span>{summary.breakoutShare.toFixed(0)}%</span>
              </p>
              <p className="stat-sub">
                {summary.breakoutCount} videos ≥ {BREAKOUT_SCORE} score
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Median engagement</p>
              <p className="stat-value">{summary.medianEngagement.toFixed(2)}%</p>
              <p className="stat-sub">Across current filters</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Median velocity</p>
              <p className="stat-value">{formatCompact(summary.medianVelocity)}/hr</p>
              <p className="stat-sub">Views per hour</p>
            </div>
            <div className="stat-card stat-card-accent">
              <p className="stat-label">Median outlier factor</p>
              <p className="stat-value">
                {summary.medianOutlier ? `${summary.medianOutlier.toFixed(1)}×` : "—"}
              </p>
              <p className="stat-sub">Outlier baseline multiplier</p>
            </div>
          </div>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Momentum field</p>
              <h3>Velocity vs engagement</h3>
            </div>
            <span className="chip">Cohort · {dataset.length}</span>
          </div>
          <PerformanceScatter data={dataset} loading={false} />
        </>
      ) : null}
    </section>
  );
}
