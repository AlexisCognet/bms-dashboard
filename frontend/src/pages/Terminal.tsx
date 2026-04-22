import { useBMS } from "../hooks/useBMS";
import type { CANFrame } from "../types/bms";

const MONO =
  '"JetBrains Mono", "IBM Plex Mono", ui-monospace, "Courier New", monospace';

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
const DARK = {
  bg: "#0b0b0a",
  panel: "#0b0b0a",
  border: "#2b2b28",
  borderHi: "#4a4a45",
  text: "#e8e8e1",
  mute: "#8a8a82",
  soft: "#55554f",
  phos: "#a6e22e",
  red: "#f92672",
  amber: "#fd971f",
  blue: "#66d9ef",
  pink: "#ae81ff",
};

const LIGHT = {
  bg: "#f4f3ee",
  panel: "#f4f3ee",
  border: "#b5b2a5",
  borderHi: "#6d6a5e",
  text: "#1a1a18",
  mute: "#555",
  soft: "#8a8679",
  phos: "#2a6a0e",
  red: "#b30838",
  amber: "#a35a0e",
  blue: "#0a608a",
  pink: "#6b3fa0",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function barChars(frac: number, width: number): string {
  const full = Math.floor(frac * width);
  const rem = frac * width - full;
  const partials = [" ", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];
  const p = partials[Math.floor(rem * 8)];
  return "█".repeat(full) + p + " ".repeat(Math.max(0, width - full - 1));
}

function arrayStats(arr: Float32Array | number[]) {
  let mn = Infinity,
    mx = -Infinity,
    s = 0;
  for (const v of arr) {
    if (v < mn) mn = v;
    if (v > mx) mx = v;
    s += v;
  }
  return { mn, mx, avg: s / arr.length };
}

// ---------------------------------------------------------------------------
// Chart — dotted-grid SVG line plot (no external deps)
// ---------------------------------------------------------------------------
interface ChartProps {
  data: Float32Array | number[];
  color: string;
  height?: number;
  label?: string;
  min?: number;
  max?: number;
  zeroLine?: boolean;
  th: typeof DARK;
}

function Chart({
  data,
  color,
  height = 140,
  label,
  min,
  max,
  zeroLine,
  th,
}: ChartProps) {
  let lo = min ?? Infinity;
  let hi = max ?? -Infinity;
  if (min == null)
    for (const v of data) {
      if (v < lo) lo = v;
    }
  if (max == null)
    for (const v of data) {
      if (v > hi) hi = v;
    }
  if (min == null) lo -= 0.03 * Math.abs(lo || 1);
  if (max == null) hi += 0.03 * Math.abs(hi || 1);
  if (zeroLine) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  const range = hi - lo || 1;
  const W = 700;
  const step = Math.max(1, Math.floor(data.length / W));
  const pts: number[] = [];
  for (let i = 0; i < data.length; i += step) pts.push(data[i]);
  let d = "";
  for (let i = 0; i < pts.length; i++) {
    const x = (i / (pts.length - 1)) * W;
    const y = (1 - (pts[i] - lo) / range) * height;
    d += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
  }
  const zeroY =
    zeroLine && lo < 0 && hi > 0
      ? (1 - (0 - lo) / range) * height
      : null;

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      style={{ display: "block" }}
    >
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1="0"
          x2={W}
          y1={f * height}
          y2={f * height}
          stroke={th.border}
          strokeDasharray="2 6"
        />
      ))}
      {zeroY != null && (
        <line
          x1="0"
          x2={W}
          y1={zeroY}
          y2={zeroY}
          stroke={th.mute}
          strokeDasharray="4 3"
        />
      )}
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" />
      <text x="6" y="14" fontFamily={MONO} fontSize="10" fill={th.mute}>
        {hi.toFixed(2)}
      </text>
      <text x="6" y={height - 4} fontFamily={MONO} fontSize="10" fill={th.mute}>
        {lo.toFixed(2)}
      </text>
      {label && (
        <text
          x={W - 6}
          y="14"
          fontFamily={MONO}
          fontSize="10"
          fill={color}
          textAnchor="end"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Box — titled panel
// ---------------------------------------------------------------------------
interface BoxProps {
  title: string;
  right?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  th: typeof DARK;
}

function Box({ title, right, style, children, th }: BoxProps) {
  return (
    <div
      style={{
        border: `1px solid ${th.border}`,
        background: th.panel,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        ...style,
      }}
    >
      <div
        style={{
          borderBottom: `1px solid ${th.border}`,
          padding: "4px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: MONO,
          fontSize: 11,
          color: th.text,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        <span>[ {title} ]</span>
        {right && (
          <span
            style={{
              color: th.mute,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            {right}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Terminal page
// ---------------------------------------------------------------------------
interface TerminalProps {
  dark?: boolean;
  onToggleDark?: () => void;
}

export function Terminal({ dark = true, onToggleDark }: TerminalProps) {
  const bms = useBMS();
  const th = dark ? DARK : LIGHT;

  const { now, V, I, SoC, T, canLog } = bms;
  const log = canLog.slice(-12).reverse();

  const vS = arrayStats(V);
  const iS = arrayStats(I);
  const sS = arrayStats(SoC);
  const tS = arrayStats(T);

  const readouts: Array<{
    k: string;
    v: string;
    u: string;
    c: string;
    range: [number, number];
    raw?: number;
  }> = [
    { k: "V", v: now.V.toFixed(3), u: "V", c: th.blue, range: [2.5, 4.3] },
    {
      k: "I",
      v: (now.I >= 0 ? "+" : "") + now.I.toFixed(2),
      u: "A",
      c: th.amber,
      range: [-10, 5],
      raw: now.I,
    },
    { k: "SoC", v: now.SoC.toFixed(1), u: "%", c: th.phos, range: [0, 100] },
    { k: "T", v: now.T.toFixed(1), u: "°C", c: th.pink, range: [-10, 60] },
  ];

  const faults = [
    { k: "OV", on: false, note: "V < 4.20" },
    { k: "UV", on: false, note: "V > 2.80" },
    { k: "OT", on: now.T > 45, note: "T < 45°C" },
    { k: "OC", on: Math.abs(now.I) > 10, note: "|I| < 10A" },
    { k: "CRC", on: false, note: "crc8 ok" },
    { k: "TIMEOUT", on: false, note: "rx < 250ms" },
    { k: "BAL", on: true, note: "balancing" },
    { k: "REC", on: true, note: "recording" },
  ];

  const rxCount = canLog.filter((f: CANFrame) => f.dir === "RX").length;
  const txCount = canLog.filter((f: CANFrame) => f.dir === "TX").length;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: th.bg,
        color: th.text,
        fontFamily: MONO,
        fontSize: 12,
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
      }}
    >
      {/* ASCII header */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${th.border}`,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <pre
          style={{
            margin: 0,
            color: th.phos,
            fontSize: 10,
            lineHeight: 1.1,
            fontFamily: MONO,
          }}
        >{` ████████╗██╗  ██╗ ██████╗ ██████╗
 ╚══██╔══╝██║  ██║██╔═══██╗██╔══██╗      BMS · SINGLE-CELL TELEMETRY
    ██║   ███████║██║   ██║██████╔╝      rev 2.3.1 · build 20260421
    ██║   ██╔══██║██║   ██║██╔══██╗      ┌─ LIVE · /dev/ttyUSB0 · 115200 8N1 · 10 Hz ─┐
    ██║   ██║  ██║╚██████╔╝██║  ██║      └────────────────────────────────────────────┘
    ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝`}</pre>

        {/* theme toggle */}
        {onToggleDark && (
          <div
            style={{
              display: "flex",
              gap: 1,
              padding: 2,
              borderRadius: 999,
              background: "rgba(128,128,128,.15)",
              fontFamily: MONO,
              fontSize: 10,
              flexShrink: 0,
              marginLeft: 12,
            }}
          >
            {(["dark", "light"] as const).map((m) => {
              const on = (m === "dark") === dark;
              return (
                <button
                  key={m}
                  onClick={onToggleDark}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: on
                      ? dark
                        ? "#fff"
                        : "#111"
                      : "transparent",
                    color: on ? (dark ? "#111" : "#fff") : "inherit",
                    fontFamily: "inherit",
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    transition: "background .15s, color .15s",
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 1fr",
          gridTemplateRows: "auto 1fr auto",
          gap: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* V/I chart */}
        <Box
          title="voltage + current · 60s"
          right="Δt = 100 ms"
          style={{
            gridColumn: "span 2",
            borderRight: "none",
            borderBottom: "none",
          }}
          th={th}
        >
          <div style={{ padding: 8 }}>
            <Chart data={V} color={th.blue} height={100} label="V [V]" th={th} />
            <div style={{ height: 4 }} />
            <Chart
              data={I}
              color={th.amber}
              height={100}
              label="I [A]"
              zeroLine
              th={th}
            />
          </div>
        </Box>

        {/* Instantaneous readouts */}
        <Box
          title="instantaneous"
          style={{ borderBottom: "none" }}
          th={th}
        >
          <div
            style={{
              padding: "10px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {readouts.map((r) => {
              const raw = r.raw != null ? r.raw : parseFloat(r.v);
              const f = (raw - r.range[0]) / (r.range[1] - r.range[0]);
              return (
                <div key={r.k}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                    }}
                  >
                    <span style={{ color: th.mute }}>{r.k.padEnd(4, " ")}</span>
                    <span
                      style={{
                        color: r.c,
                        fontSize: 18,
                        fontWeight: 500,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.v}{" "}
                      <span style={{ fontSize: 11, color: th.mute }}>{r.u}</span>
                    </span>
                  </div>
                  <div
                    style={{
                      color: r.c,
                      fontSize: 11,
                      letterSpacing: 1,
                      marginTop: 2,
                      whiteSpace: "pre",
                      fontFamily: MONO,
                    }}
                  >
                    │{barChars(Math.max(0, Math.min(1, f)), 22)}│{" "}
                    {(f * 100).toFixed(0).padStart(3, " ")}%
                  </div>
                </div>
              );
            })}
          </div>
        </Box>

        {/* SoC trace */}
        <Box
          title="soc · 60s trace"
          right={`now ${now.SoC.toFixed(1)}%`}
          style={{ borderRight: "none", borderBottom: "none" }}
          th={th}
        >
          <div style={{ padding: 8 }}>
            <Chart
              data={SoC}
              color={th.phos}
              height={140}
              label="SoC [%]"
              min={sS.mn - 0.5}
              max={sS.mx + 0.5}
              th={th}
            />
          </div>
        </Box>

        {/* Min/avg/max stats */}
        <Box
          title="min / avg / max · 60s"
          style={{ borderRight: "none", borderBottom: "none" }}
          th={th}
        >
          <div
            style={{ padding: "8px 12px", fontSize: 11, lineHeight: 1.7 }}
          >
            <div
              style={{
                color: th.mute,
                display: "grid",
                gridTemplateColumns: "60px 1fr 1fr 1fr",
                borderBottom: `1px solid ${th.border}`,
                paddingBottom: 3,
              }}
            >
              <span></span>
              <span>min</span>
              <span>avg</span>
              <span>max</span>
            </div>
            {[
              { k: "V [V]", s: vS, c: th.blue, d: 3 },
              { k: "I [A]", s: iS, c: th.amber, d: 2 },
              { k: "SoC[%]", s: sS, c: th.phos, d: 1 },
              { k: "T [°C]", s: tS, c: th.pink, d: 1 },
            ].map((r) => (
              <div
                key={r.k}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 1fr 1fr",
                  fontVariantNumeric: "tabular-nums",
                  color: th.text,
                  paddingTop: 2,
                }}
              >
                <span style={{ color: r.c }}>{r.k}</span>
                <span>{r.s.mn.toFixed(r.d)}</span>
                <span>{r.s.avg.toFixed(r.d)}</span>
                <span>{r.s.mx.toFixed(r.d)}</span>
              </div>
            ))}
            <div
              style={{
                marginTop: 8,
                paddingTop: 6,
                borderTop: `1px solid ${th.border}`,
                color: th.mute,
              }}
            >
              samples..600&nbsp; hz........10.0
              <br />
              link..OPEN&nbsp;&nbsp; uart_err..0
              <br />
              dbc....v2.3.1 frames....{canLog.length}
            </div>
          </div>
        </Box>

        {/* Faults */}
        <Box title="faults / flags" th={th}>
          <div
            style={{
              padding: "8px 12px",
              fontSize: 11,
              lineHeight: 1.8,
            }}
          >
            {faults.map((a) => (
              <div
                key={a.k}
                style={{
                  display: "grid",
                  gridTemplateColumns: "18px 70px 1fr auto",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span
                  style={{
                    color: a.on
                      ? a.k === "BAL" || a.k === "REC"
                        ? th.phos
                        : th.red
                      : th.soft,
                  }}
                >
                  {a.on ? (a.k === "BAL" || a.k === "REC" ? "●" : "▲") : "○"}
                </span>
                <span style={{ color: th.text }}>{a.k}</span>
                <span style={{ color: th.mute }}>{a.note}</span>
                <span
                  style={{
                    color: a.on
                      ? a.k === "BAL" || a.k === "REC"
                        ? th.phos
                        : th.red
                      : th.mute,
                  }}
                >
                  [{a.on ? (a.k === "BAL" || a.k === "REC" ? " ON " : "TRIP") : " OK "}]
                </span>
              </div>
            ))}
          </div>
        </Box>

        {/* CAN log — full width */}
        <Box
          title="can bus · decoded stream"
          right={`500k · rx ${rxCount} · tx ${txCount}`}
          style={{
            gridColumn: "span 3",
            borderTop: `1px solid ${th.border}`,
          }}
          th={th}
        >
          <div style={{ overflowY: "auto", maxHeight: 230, fontSize: 11 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "70px 34px 56px 150px 1fr",
                gap: 8,
                padding: "4px 12px",
                color: th.mute,
                borderBottom: `1px solid ${th.border}`,
                position: "sticky",
                top: 0,
                background: th.panel,
              }}
            >
              <span>t.rel</span>
              <span>dir</span>
              <span>id</span>
              <span>name</span>
              <span>decoded fields</span>
            </div>
            {log.map((f: CANFrame, i: number) => {
              const isTx = f.dir === "TX";
              const col = isTx ? th.amber : th.blue;
              return (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "70px 34px 56px 150px 1fr",
                    gap: 8,
                    padding: "3px 12px",
                    color: th.text,
                    borderBottom: `1px dotted ${th.border}`,
                    background:
                      i === 0
                        ? dark
                          ? "rgba(166,226,46,.05)"
                          : "rgba(42,106,14,.05)"
                        : "transparent",
                  }}
                >
                  <span
                    style={{
                      color: th.mute,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {i === 0
                      ? "   0.0ms"
                      : `-${(i * 300).toFixed(0)}ms`.padStart(9, " ")}
                  </span>
                  <span style={{ color: col, fontWeight: 600 }}>
                    {isTx ? "»TX" : "«RX"}
                  </span>
                  <span>
                    0x
                    {f.id.toString(16).toUpperCase().padStart(3, "0")}
                  </span>
                  <span style={{ color: th.mute }}>{f.name}</span>
                  <span>
                    {f.fields.map((fd, j) => (
                      <span key={j} style={{ marginRight: 14 }}>
                        <span style={{ color: th.soft }}>{fd.k}=</span>
                        <span style={{ color: th.text }}>{fd.v}</span>
                        {fd.u && (
                          <span style={{ color: th.soft }}>{fd.u}</span>
                        )}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </Box>
      </div>

      {/* Footer status bar */}
      <div
        style={{
          borderTop: `1px solid ${th.border}`,
          padding: "4px 14px",
          display: "flex",
          gap: 18,
          fontSize: 11,
          color: th.mute,
        }}
      >
        <span>
          <span style={{ color: th.phos }}>●</span> LIVE
        </span>
        <span>F1 help</span>
        <span>F2 record</span>
        <span>F3 export</span>
        <span>F5 reset stats</span>
        <span style={{ flex: 1 }} />
        <span>THOR-01 · t+00:24:17.3 · load 0.12 · mem 18M</span>
      </div>
    </div>
  );
}
