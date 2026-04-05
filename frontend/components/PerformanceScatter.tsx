/**
 * Scatter chart for visualizing performance percentiles.
 * Consumed by the performance analytics page and encapsulates all Recharts styling and tooltip logic.
 */
import React, { useMemo } from "react";
import {
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { BREAKOUT_SCORE } from "../features/performance/constants";
import { ReelPerformance } from "../features/performance/types";
import {
  formatCompact,
  formatNumber,
  formatPercentile,
  formatRate,
  prettifyUrl,
} from "../features/performance/utils/formatters";
import { median } from "../features/performance/utils/statistics";

type Props = {
  data: ReelPerformance[];
  loading: boolean;
};

const AXIS_TICK = { fill: "var(--color-ash-70)", fontSize: 12 };
const AXIS_LINE = { stroke: "var(--color-ash-40)" };
const TICK_LINE = { stroke: "var(--color-ash-30)" };

const CustomTooltip = ({
  active,
  payload,
}: TooltipProps<ValueType, NameType> & {
  payload?: Array<{ payload: ReelPerformance }>;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tooltip-card">
      <div className="tooltip-header">
        <a href={d.reel_url} target="_blank" rel="noreferrer" className="tooltip-title">
          {prettifyUrl(d.reel_url)}
        </a>
        <span className="metric-chip">{d.platform}</span>
      </div>
      <div className="tooltip-badges">
        <span className="pill pill-teal">
          Velocity · {formatPercentile(d.views_per_hour_percentile)}
        </span>
        <span className="pill pill-amber">
          Engagement · {formatPercentile(d.engagement_rate_percentile)}
        </span>
      </div>
      <div className="tooltip-grid">
        <div className="tooltip-metric">
          <span>Performance score</span>
          <strong>{d.performance_score.toFixed(2)}</strong>
        </div>
        <div className="tooltip-metric">
          <span>Engagement rate</span>
          <strong>{formatRate(d.engagement_rate)}</strong>
        </div>
        <div className="tooltip-metric">
          <span>Views per hour</span>
          <strong>{formatNumber(d.views_per_hour)}</strong>
        </div>
        <div className="tooltip-metric">
          <span>Total views</span>
          <strong>{formatNumber(d.views)}</strong>
        </div>
      </div>
      <div className="tooltip-meta">
        <span>Published</span>
        <span>{new Date(d.publish_time).toUTCString()}</span>
      </div>
    </div>
  );
};

/**
 * Render the performance scatter plot with highlight and baseline cohorts.
 */
export function PerformanceScatter({ data, loading }: Props) {
  const highlightThreshold = BREAKOUT_SCORE;

  const { highlighted, baseline } = useMemo(() => {
    const highlightedItems: ReelPerformance[] = [];
    const baselineItems: ReelPerformance[] = [];

    data.forEach((d) => {
      if (d.performance_score >= highlightThreshold) {
        highlightedItems.push(d);
      } else {
        baselineItems.push(d);
      }
    });

    return { highlighted: highlightedItems, baseline: baselineItems };
  }, [data, highlightThreshold]);

  const breakoutShare = data.length ? (highlighted.length / data.length) * 100 : 0;

  const summary = useMemo(() => {
    if (!data.length) {
      return {
        medianEngagement: 0,
        medianVelocity: 0,
        top: undefined as ReelPerformance | undefined,
      };
    }
    const medianEngagement = median(data.map((d) => d.engagement_rate * 100));
    const medianVelocity = median(data.map((d) => d.views_per_hour));
    const top = data.reduce((prev, curr) =>
      curr.performance_score > prev.performance_score ? curr : prev
    );
    return { medianEngagement, medianVelocity, top };
  }, [data]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Scatter · 7d cohort</p>
          <h2>Reels performance field</h2>
          <p className="subdued">X: views/hr percentile · Y: engagement percentile · Size: views</p>
        </div>
        <div className="chip-row">
          <span className="chip">Total: {data.length}</span>
          <span className="chip chip-highlight">Breakouts: {highlighted.length}</span>
          <span className="chip chip-ghost">Score ≥ {highlightThreshold}</span>
        </div>
      </div>
      <div className="stat-rail">
        <div className="stat-card">
          <div className="stat-label">Breakout share</div>
          <div className="stat-value">
            <span>{breakoutShare.toFixed(0)}%</span>
            <span className="stat-tag">of {data.length || 0} reels</span>
          </div>
          <div className="stat-sub">Performance score ≥ {highlightThreshold}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Median engagement</div>
          <div className="stat-value">
            <span>{summary.medianEngagement.toFixed(2)}%</span>
            <span className="stat-tag">rate</span>
          </div>
          <div className="stat-sub">
            Percentile median:{" "}
            {formatPercentile(median(data.map((d) => d.engagement_rate_percentile)))}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Median velocity</div>
          <div className="stat-value">
            <span>{formatCompact(summary.medianVelocity)} / hr</span>
            <span className="stat-tag">speed</span>
          </div>
          <div className="stat-sub">Views per hour across cohort</div>
        </div>
        <div className="stat-card stat-card-accent">
          <div className="stat-label">Top performer</div>
          <div className="stat-value">
            <span>{summary.top ? summary.top.performance_score.toFixed(1) : "—"}</span>
            <span className="stat-tag">
              {summary.top ? prettifyUrl(summary.top.reel_url) : "Waiting for data"}
            </span>
          </div>
          <div className="stat-sub">
            {summary.top
              ? `${summary.top.platform} · ${formatNumber(summary.top.views)} views`
              : "Loaded when data arrives"}
          </div>
        </div>
      </div>
      <div className="legend-row">
        <div className="legend-pill">
          <span className="legend-dot legend-dot-base" />
          <span>Cohort</span>
          <span className="legend-sublabel">Performance &lt; {highlightThreshold}</span>
        </div>
        <div className="legend-pill legend-pill-highlight">
          <span className="legend-dot legend-dot-highlight" />
          <span>Top performers</span>
          <span className="legend-sublabel">Performance ≥ {highlightThreshold}</span>
        </div>
      </div>
      <div className="chart-shell">
        {loading ? (
          <div className="loading">Pulling latest signals…</div>
        ) : data.length === 0 ? (
          <div className="chart-empty">
            <div className="empty-dot" />
            <p>No data yet. Try refreshing or load a sample cohort.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <defs>
                <linearGradient id="breakoutZone" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--color-teal)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--color-amber)" stopOpacity={0.12} />
                </linearGradient>
              </defs>
              <ReferenceArea x1={80} x2={100} y1={70} y2={100} fill="url(#breakoutZone)" />
              <CartesianGrid stroke="rgba(201,205,214,0.14)" strokeDasharray="3 7" />
              <XAxis
                type="number"
                dataKey="views_per_hour_percentile"
                name="Views/hour pct"
                domain={[0, 100]}
                tick={AXIS_TICK}
                axisLine={AXIS_LINE}
                tickLine={TICK_LINE}
                label={{
                  value: "Velocity percentile",
                  position: "insideBottomRight",
                  offset: -4,
                  fill: "var(--color-ash-70)",
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="engagement_rate_percentile"
                name="Engagement pct"
                domain={[0, 100]}
                tick={AXIS_TICK}
                axisLine={AXIS_LINE}
                tickLine={TICK_LINE}
                label={{
                  value: "Engagement percentile",
                  position: "insideLeft",
                  angle: -90,
                  offset: 10,
                  fill: "var(--color-ash-70)",
                  fontSize: 11,
                }}
              />
              <ZAxis type="number" dataKey="views" range={[60, 280]} name="Views" />
              <Tooltip
                cursor={{ stroke: "var(--color-ash-30)" }}
                content={<CustomTooltip />}
                wrapperStyle={{ outline: "none" }}
              />
              <Scatter
                name="Cohort"
                data={baseline}
                fill="var(--color-teal-soft)"
                opacity={0.85}
                shape="circle"
                stroke="var(--color-teal)"
                strokeWidth={1}
              />
              <Scatter
                name="Top performers"
                data={highlighted}
                fill="var(--color-amber)"
                shape="circle"
                stroke="#ffd472"
                strokeWidth={1.4}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
