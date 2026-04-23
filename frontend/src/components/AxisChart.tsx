// Responsive SVG line chart with numeric X/Y axes.
//
// Supports:
//   - one or more data series (overlaid)
//   - optional dual Y axes (left + right) for series with different units
//   - auto "nice" tick values, or fixed min/max per axis
//   - smooth curves, area fills with gradients, dashed strokes
//
// Usage:
//   <AxisChart
//     series={[{ data: V, stroke: '#5aa5ff', axis: 'left' }]}
//     yLeft={{ label: 'V', color: '#5aa5ff', unit: 'V' }}
//     xLabels={['-60s','-40s','-20s','now']}
//     theme={{ mute, soft, border, text }}
//     width={600} height={400}
//   />

export interface ChartSeries {
  data: ArrayLike<number>;
  stroke: string;
  strokeWidth?: number;
  fill?: string;
  gradientId?: string;
  dashed?: boolean;
  axis?: "left" | "right";
}

export interface AxisSpec {
  label?: string;
  unit?: string;
  color?: string;
  min?: number;
  max?: number;
  tickCount?: number;
  format?: (v: number) => string;
}

export interface ChartTheme {
  mute: string;
  soft: string;
  border: string;
  text: string;
}

interface AxisChartProps {
  series: ChartSeries[];
  width: number;
  height: number;
  yLeft?: AxisSpec;
  yRight?: AxisSpec;
  xLabels?: string[];
  theme: ChartTheme;
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
}

// ---------------------------------------------------------------------------
// niceTicks — returns "nice" (human-readable) tick values covering [min, max].
// Algorithm: pick step ∈ {1, 2, 5} × 10^k matching the target tick count.
// ---------------------------------------------------------------------------
function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max) || min === max) {
    return [min];
  }
  const range = max - min;
  const roughStep = range / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const norm = roughStep / mag;
  let step: number;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max + step * 1e-6; v += step) {
    // clamp floating-point drift
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

function formatTick(v: number, step: number): string {
  if (step >= 10) return v.toFixed(0);
  if (step >= 1) return v.toFixed(0);
  if (step >= 0.1) return v.toFixed(1);
  if (step >= 0.01) return v.toFixed(2);
  return v.toFixed(3);
}

function seriesRange(series: ChartSeries[]): { min: number; max: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) {
    const d = s.data;
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!isFinite(lo) || !isFinite(hi)) {
    lo = 0;
    hi = 1;
  }
  if (lo === hi) {
    lo -= 0.5;
    hi += 0.5;
  }
  const pad = (hi - lo) * 0.05;
  return { min: lo - pad, max: hi + pad };
}

function buildPath(
  data: ArrayLike<number>,
  x0: number,
  y0: number,
  chartW: number,
  chartH: number,
  yMin: number,
  yMax: number,
  smooth = true
): string {
  if (data.length === 0) return "";
  const range = yMax - yMin || 1;
  const step = Math.max(1, Math.floor(data.length / (chartW * 2)));
  const pts: number[] = [];
  for (let i = 0; i < data.length; i += step) pts.push(data[i]);
  if (pts[pts.length - 1] !== data[data.length - 1])
    pts.push(data[data.length - 1] as number);

  const xAt = (i: number) => x0 + (i / (pts.length - 1)) * chartW;
  const yAt = (v: number) => y0 + (1 - (v - yMin) / range) * chartH;

  let d = "";
  if (!smooth) {
    for (let i = 0; i < pts.length; i++) {
      const x = xAt(i);
      const y = yAt(pts[i]);
      d += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
    }
    return d;
  }
  for (let i = 0; i < pts.length; i++) {
    const x = xAt(i);
    const y = yAt(pts[i]);
    if (i === 0) {
      d += `M${x.toFixed(1)},${y.toFixed(1)}`;
    } else {
      const px = xAt(i - 1);
      const py = yAt(pts[i - 1]);
      const mx = (px + x) / 2;
      d += ` Q${px.toFixed(1)},${py.toFixed(1)} ${mx.toFixed(1)},${(
        (py + y) /
        2
      ).toFixed(1)} T${x.toFixed(1)},${y.toFixed(1)}`;
    }
  }
  return d;
}

export function AxisChart({
  series,
  width,
  height,
  yLeft,
  yRight,
  xLabels,
  theme,
  padding,
}: AxisChartProps) {
  const pad = {
    top: padding?.top ?? 12,
    right: padding?.right ?? (yRight ? 48 : 14),
    bottom: padding?.bottom ?? 26,
    left: padding?.left ?? 48,
  };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const leftSeries = series.filter((s) => s.axis !== "right");
  const rightSeries = series.filter((s) => s.axis === "right");

  const autoLeft = seriesRange(leftSeries);
  const leftMin = yLeft?.min ?? autoLeft.min;
  const leftMax = yLeft?.max ?? autoLeft.max;
  const leftTicks = niceTicks(leftMin, leftMax, yLeft?.tickCount ?? 5);
  const leftStep =
    leftTicks.length > 1 ? leftTicks[1] - leftTicks[0] : leftMax - leftMin;

  const autoRight = rightSeries.length ? seriesRange(rightSeries) : null;
  const rightMin = yRight?.min ?? autoRight?.min ?? 0;
  const rightMax = yRight?.max ?? autoRight?.max ?? 1;
  const rightTicks =
    rightSeries.length > 0
      ? niceTicks(rightMin, rightMax, yRight?.tickCount ?? 5)
      : [];
  const rightStep =
    rightTicks.length > 1
      ? rightTicks[1] - rightTicks[0]
      : rightMax - rightMin;

  // Build series paths
  const paths = series.map((s) => {
    const isRight = s.axis === "right";
    const yMin = isRight ? rightMin : leftMin;
    const yMax = isRight ? rightMax : leftMax;
    const d = buildPath(s.data, pad.left, pad.top, chartW, chartH, yMin, yMax);
    let areaD = "";
    if (s.fill) {
      areaD =
        d + ` L${pad.left + chartW},${pad.top + chartH} L${pad.left},${pad.top + chartH} Z`;
    }
    return { ...s, d, areaD };
  });

  const yAt = (v: number, isRight: boolean) => {
    const yMin = isRight ? rightMin : leftMin;
    const yMax = isRight ? rightMax : leftMax;
    return pad.top + (1 - (v - yMin) / (yMax - yMin)) * chartH;
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height }}
    >
      <defs>
        {paths.map((p, i) =>
          p.gradientId && p.fill ? (
            <linearGradient
              key={i}
              id={p.gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={p.fill} stopOpacity="0.35" />
              <stop offset="100%" stopColor={p.fill} stopOpacity="0" />
            </linearGradient>
          ) : null
        )}
      </defs>

      {/* Horizontal grid lines (based on left axis ticks) */}
      {leftTicks.map((t) => (
        <line
          key={`gh-${t}`}
          x1={pad.left}
          x2={pad.left + chartW}
          y1={yAt(t, false)}
          y2={yAt(t, false)}
          stroke={theme.border}
          strokeDasharray="2 4"
        />
      ))}

      {/* Area fills (drawn first, under the lines) */}
      {paths.map((p, i) =>
        p.areaD ? (
          <path
            key={`area-${i}`}
            d={p.areaD}
            fill={p.gradientId ? `url(#${p.gradientId})` : p.fill}
            fillOpacity={p.gradientId ? 1 : 0.14}
          />
        ) : null
      )}

      {/* Series lines */}
      {paths.map((p, i) => (
        <path
          key={`line-${i}`}
          d={p.d}
          fill="none"
          stroke={p.stroke}
          strokeWidth={p.strokeWidth ?? 2}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={p.dashed ? "6 4" : undefined}
        />
      ))}

      {/* Left Y axis */}
      <line
        x1={pad.left}
        x2={pad.left}
        y1={pad.top}
        y2={pad.top + chartH}
        stroke={theme.border}
      />
      {leftTicks.map((t) => (
        <g key={`ly-${t}`}>
          <line
            x1={pad.left - 4}
            x2={pad.left}
            y1={yAt(t, false)}
            y2={yAt(t, false)}
            stroke={theme.border}
          />
          <text
            x={pad.left - 8}
            y={yAt(t, false)}
            textAnchor="end"
            dominantBaseline="middle"
            fill={yLeft?.color ?? theme.mute}
            fontSize={10}
            fontFamily='"JetBrains Mono", monospace'
          >
            {(yLeft?.format ?? ((v) => formatTick(v, leftStep)))(t)}
          </text>
        </g>
      ))}
      {yLeft?.unit && (
        <text
          x={pad.left - 8}
          y={pad.top - 4}
          textAnchor="end"
          fill={yLeft.color ?? theme.mute}
          fontSize={10}
          fontWeight={600}
        >
          {yLeft.unit}
        </text>
      )}

      {/* Right Y axis (optional) */}
      {rightSeries.length > 0 && (
        <>
          <line
            x1={pad.left + chartW}
            x2={pad.left + chartW}
            y1={pad.top}
            y2={pad.top + chartH}
            stroke={theme.border}
          />
          {rightTicks.map((t) => (
            <g key={`ry-${t}`}>
              <line
                x1={pad.left + chartW}
                x2={pad.left + chartW + 4}
                y1={yAt(t, true)}
                y2={yAt(t, true)}
                stroke={theme.border}
              />
              <text
                x={pad.left + chartW + 8}
                y={yAt(t, true)}
                textAnchor="start"
                dominantBaseline="middle"
                fill={yRight?.color ?? theme.mute}
                fontSize={10}
                fontFamily='"JetBrains Mono", monospace'
              >
                {(yRight?.format ?? ((v) => formatTick(v, rightStep)))(t)}
              </text>
            </g>
          ))}
          {yRight?.unit && (
            <text
              x={pad.left + chartW + 8}
              y={pad.top - 4}
              textAnchor="start"
              fill={yRight.color ?? theme.mute}
              fontSize={10}
              fontWeight={600}
            >
              {yRight.unit}
            </text>
          )}
        </>
      )}

      {/* X axis */}
      <line
        x1={pad.left}
        x2={pad.left + chartW}
        y1={pad.top + chartH}
        y2={pad.top + chartH}
        stroke={theme.border}
      />
      {xLabels?.map((label, i) => {
        const x = pad.left + (i / (xLabels.length - 1)) * chartW;
        return (
          <g key={`x-${i}`}>
            <line
              x1={x}
              x2={x}
              y1={pad.top + chartH}
              y2={pad.top + chartH + 4}
              stroke={theme.border}
            />
            <text
              x={x}
              y={pad.top + chartH + 16}
              textAnchor="middle"
              fill={theme.soft}
              fontSize={10}
              fontFamily='"JetBrains Mono", monospace'
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
