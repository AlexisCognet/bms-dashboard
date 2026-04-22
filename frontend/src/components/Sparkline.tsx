interface SparklineProps {
  data: Float32Array | number[];
  width: number;
  height: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  gradientId?: string;
  baselineZero?: boolean;
  min?: number;
  max?: number;
  padY?: number;
  smooth?: boolean;
}

export function Sparkline({
  data,
  width,
  height,
  stroke = "#fff",
  strokeWidth = 1.5,
  fill,
  gradientId,
  baselineZero,
  min,
  max,
  padY = 4,
  smooth = true,
}: SparklineProps) {
  if (!data || data.length === 0) return null;

  const step = Math.max(1, Math.floor(data.length / (width * 2)));
  const pts: number[] = [];
  for (let i = 0; i < data.length; i += step) pts.push(data[i]);
  if (pts[pts.length - 1] !== data[data.length - 1])
    pts.push(data[data.length - 1]);

  let lo = min ?? Infinity;
  let hi = max ?? -Infinity;
  if (min == null || max == null) {
    for (const v of pts) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (baselineZero) lo = Math.min(lo, 0);
    const pad = (hi - lo) * 0.08 || 0.1;
    lo -= pad;
    hi += pad;
  }
  const range = hi - lo || 1;
  const xs = (i: number) => (i / (pts.length - 1)) * width;
  const ys = (v: number) => padY + (1 - (v - lo) / range) * (height - padY * 2);

  let d = "";
  if (smooth) {
    for (let i = 0; i < pts.length; i++) {
      const x = xs(i),
        y = ys(pts[i]);
      if (i === 0) {
        d += `M${x.toFixed(1)},${y.toFixed(1)}`;
      } else {
        const px = xs(i - 1),
          py = ys(pts[i - 1]);
        const mx = (px + x) / 2;
        d += ` Q${px.toFixed(1)},${py.toFixed(1)} ${mx.toFixed(1)},${((py + y) / 2).toFixed(1)} T${x.toFixed(1)},${y.toFixed(1)}`;
      }
    }
  } else {
    for (let i = 0; i < pts.length; i++) {
      const x = xs(i),
        y = ys(pts[i]);
      d += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
    }
  }

  const areaD = d + ` L${width},${height} L0,${height} Z`;
  const baselineY = ys(0);

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {gradientId && fill && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.35" />
            <stop offset="100%" stopColor={fill} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {baselineZero && baselineY > 0 && baselineY < height && (
        <line
          x1="0"
          x2={width}
          y1={baselineY}
          y2={baselineY}
          stroke={stroke}
          strokeOpacity="0.25"
          strokeDasharray="2 3"
        />
      )}
      {fill && (
        <path
          d={areaD}
          fill={gradientId ? `url(#${gradientId})` : fill}
          fillOpacity={gradientId ? 1 : 0.15}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
