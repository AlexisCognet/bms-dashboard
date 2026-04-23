import { useState } from "react";
import { useBMS } from "../hooks/useBMS";
import { AxisChart } from "../components/AxisChart";
import type { CANFrame } from "../types/bms";

const SANS =
  '"Inter", -apple-system, "SF Pro Text", system-ui, sans-serif';
const DISP = '"Inter Display", "Inter", -apple-system, sans-serif';
const MONO = '"JetBrains Mono", monospace';

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------
const DARK_TH = {
  bg: "#0f1419",
  card: "#181e26",
  cardAlt: "#1f2631",
  border: "rgba(255,255,255,.06)",
  text: "#e8edf3",
  mute: "#8c97a7",
  soft: "#5e6a7c",
  brand: "#7c5cff",
  brandSoft: "rgba(124,92,255,.15)",
  v: "#5aa5ff",
  vSoft: "rgba(90,165,255,.12)",
  i: "#ff7e5a",
  iSoft: "rgba(255,126,90,.12)",
  soc: "#34c98a",
  socSoft: "rgba(52,201,138,.12)",
  t: "#f4b740",
};

const LIGHT_TH = {
  bg: "#f6f7f9",
  card: "#ffffff",
  cardAlt: "#fafbfc",
  border: "rgba(15,20,30,.06)",
  text: "#0f1624",
  mute: "#64708a",
  soft: "#94a0b4",
  brand: "#5b3fe8",
  brandSoft: "rgba(91,63,232,.08)",
  v: "#2b6dd6",
  vSoft: "rgba(43,109,214,.08)",
  i: "#e45d2f",
  iSoft: "rgba(228,93,47,.08)",
  soc: "#18a866",
  socSoft: "rgba(24,168,102,.08)",
  t: "#b8821a",
};

type Theme = typeof LIGHT_TH;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function Card({
  children,
  style,
  th,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  th: Theme;
}) {
  return (
    <div
      style={{
        background: th.card,
        borderRadius: 16,
        border: `1px solid ${th.border}`,
        boxShadow:
          th === LIGHT_TH
            ? "0 1px 2px rgba(15,20,30,.04), 0 1px 1px rgba(15,20,30,.02)"
            : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  delta,
  color,
  softBg,
  icon,
  th,
}: {
  label: string;
  value: string;
  unit: string;
  delta: string;
  color: string;
  softBg: string;
  icon: string;
  th: Theme;
}) {
  return (
    <Card style={{ padding: "18px 20px" }} th={th}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ fontSize: 13, color: th.mute, fontWeight: 500 }}>
          {label}
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: softBg,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontSize: 28,
            fontWeight: 600,
            fontFamily: DISP,
            letterSpacing: -0.8,
            color: th.text,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 14, color: th.mute, fontWeight: 500 }}>
          {unit}
        </span>
      </div>
      <div style={{ fontSize: 12, color: th.soft, marginTop: 4 }}>{delta}</div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CAN messages list — reused on the CAN bus view
// ---------------------------------------------------------------------------
function CANList({
  log,
  rxCount,
  txCount,
  th,
  title = "CAN messages",
  subtitle,
}: {
  log: CANFrame[];
  rxCount: number;
  txCount: number;
  th: Theme;
  title?: string;
  subtitle?: string;
}) {
  return (
    <Card style={{ padding: "18px 20px" }} th={th}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
          {subtitle && (
            <div style={{ fontSize: 12, color: th.mute, marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 99,
              background: th.vSoft,
              color: th.v,
              fontWeight: 500,
            }}
          >
            RX {rxCount}
          </span>
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 99,
              background: th.iSoft,
              color: th.i,
              fontWeight: 500,
            }}
          >
            TX {txCount}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {log.map((f: CANFrame, i: number) => {
          const isTx = f.dir === "TX";
          const col = isTx ? th.i : th.v;
          const softCol = isTx ? th.iSoft : th.vSoft;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: th.cardAlt,
                borderRadius: 10,
                border: `1px solid ${th.border}`,
              }}
            >
              <div
                style={{
                  width: 36,
                  textAlign: "center",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 1,
                  padding: "3px 0",
                  borderRadius: 5,
                  background: softCol,
                  color: col,
                  flexShrink: 0,
                }}
              >
                {f.dir}
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: 500,
                  color: th.text,
                  minWidth: 58,
                }}
              >
                0x{f.id.toString(16).toUpperCase().padStart(3, "0")}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: th.text,
                  minWidth: 160,
                }}
              >
                {f.name}
              </div>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "2px 14px",
                  fontSize: 12,
                }}
              >
                {f.fields.map((fd, j) => (
                  <span key={j} style={{ color: th.mute }}>
                    {fd.k}{" "}
                    <span style={{ color: th.text, fontWeight: 500 }}>
                      {fd.v}
                    </span>
                    {fd.u && <span style={{ color: th.soft }}> {fd.u}</span>}
                  </span>
                ))}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: th.soft,
                  fontFamily: MONO,
                  flexShrink: 0,
                }}
              >
                {i === 0 ? "now" : `${(i * 0.3).toFixed(1)}s`}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SaaS page
// ---------------------------------------------------------------------------
type View = "overview" | "canbus";

interface SaaSProps {
  dark?: boolean;
  onToggleDark?: () => void;
}

export function SaaS({ dark = false, onToggleDark }: SaaSProps) {
  const bms = useBMS();
  const th = dark ? DARK_TH : LIGHT_TH;
  const [view, setView] = useState<View>("overview");

  const { now, V, I, SoC, SoC_real, T, canLog } = bms;
  const fullLog = canLog.slice().reverse();
  const chartTheme = { mute: th.mute, soft: th.soft, border: th.border, text: th.text };

  const vMin = Math.min(...(V as unknown as number[]));
  const vMax = Math.max(...(V as unknown as number[]));
  const tAvg = (T as unknown as number[]).reduce((a, b) => a + b, 0) / T.length;

  const rxCount = canLog.filter((f: CANFrame) => f.dir === "RX").length;
  const txCount = canLog.filter((f: CANFrame) => f.dir === "TX").length;

  function sessionStat(arr: Float32Array) {
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

  const navItems: { id: View; name: string; ic: string }[] = [
    { id: "overview", name: "Overview", ic: "◉" },
    { id: "canbus", name: "CAN bus", ic: "↕" },
  ];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: th.bg,
        color: th.text,
        fontFamily: SANS,
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        overflow: "hidden",
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          borderRight: `1px solid ${th.border}`,
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 8px 18px",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: th.brand,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: DISP,
            }}
          >
            T
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>
              THOR
            </div>
            <div style={{ fontSize: 11, color: th.soft }}>Battery ops</div>
          </div>
        </div>

        {navItems.map((n) => {
          const on = n.id === view;
          return (
            <div
              key={n.id}
              onClick={() => setView(n.id)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: on ? th.brandSoft : "transparent",
                color: on ? th.brand : th.mute,
                fontSize: 13,
                fontWeight: on ? 500 : 400,
                cursor: "pointer",
              }}
            >
              <span style={{ width: 16 }}>{n.ic}</span>
              {n.name}
            </div>
          );
        })}

        <div style={{ flex: 1 }} />

        {onToggleDark && (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: th.cardAlt,
              border: `1px solid ${th.border}`,
              cursor: "pointer",
              fontSize: 12,
              color: th.mute,
            }}
            onClick={onToggleDark}
          >
            <span>{dark ? "☀" : "☾"}</span>
            {dark ? "Light mode" : "Dark mode"}
          </div>
        )}

        {(() => {
          const s = bms.status;
          const live = s?.source === "serial" && s?.connected;
          const dot = live ? th.soc : s?.source === "sim" ? th.t : "#ef4444";
          const label = live
            ? "UART live"
            : s?.source === "sim"
            ? "Simulated"
            : "UART offline";
          const port = s?.port ?? "—";
          const baud = s?.baud ?? 115200;
          return (
            <div
              style={{
                padding: 12,
                background: th.cardAlt,
                borderRadius: 12,
                border: `1px solid ${th.border}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    background: dot,
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
              </div>
              <div style={{ fontSize: 11, color: th.soft, lineHeight: 1.5 }}>
                {port}
                <br />
                {baud} · 10 Hz
              </div>
            </div>
          );
        })()}
      </div>

      {/* Main content */}
      <div style={{ overflow: "auto", padding: "20px 24px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                fontFamily: DISP,
                letterSpacing: -0.5,
              }}
            >
              {view === "overview" ? "Cell THOR-01" : "CAN bus"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                padding: "7px 12px",
                borderRadius: 8,
                background: th.socSoft,
                color: th.soc,
                fontSize: 12,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: th.soc,
                  display: "inline-block",
                }}
              />
              Nominal
            </div>
            <div
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                background: th.text,
                color: th.bg,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Export
            </div>
          </div>
        </div>

        {view === "overview" && (
          <>
            {/* Stat cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <StatCard
                label="Voltage"
                value={now.V.toFixed(3)}
                unit="V"
                color={th.v}
                softBg={th.vSoft}
                delta={`min ${vMin.toFixed(2)} · max ${vMax.toFixed(2)}`}
                icon="V"
                th={th}
              />
              <StatCard
                label="Current"
                value={(now.I >= 0 ? "+" : "") + now.I.toFixed(2)}
                unit="A"
                color={th.i}
                softBg={th.iSoft}
                delta={
                  now.I < -0.1
                    ? "Discharging"
                    : now.I > 0.1
                    ? "Charging"
                    : "Idle"
                }
                icon="I"
                th={th}
              />
              <StatCard
                label="State of charge"
                value={now.SoC.toFixed(1)}
                unit="%"
                color={th.soc}
                softBg={th.socSoft}
                delta="EKF · SoH 98.2%"
                icon="%"
                th={th}
              />
              <StatCard
                label="Temperature"
                value={now.T.toFixed(1)}
                unit="°C"
                color={th.t}
                softBg="rgba(244,183,64,.12)"
                delta={`avg ${tAvg.toFixed(1)} °C`}
                icon="°"
                th={th}
              />
            </div>

            {/* Charts — bigger now that lower row is compressed */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
              }}
            >
              {/* V & I */}
              <Card style={{ padding: "18px 20px" }} th={th}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      Voltage &amp; current
                    </div>
                    <div style={{ fontSize: 12, color: th.mute, marginTop: 2 }}>
                      Rolling 60-second window
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: th.mute,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: th.v,
                          display: "inline-block",
                        }}
                      />
                      Voltage
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: th.mute,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: th.i,
                          display: "inline-block",
                        }}
                      />
                      Current
                    </span>
                  </div>
                </div>
                <AxisChart
                  width={600}
                  height={400}
                  theme={chartTheme}
                  yLeft={{ unit: "V", color: th.v, tickCount: 5 }}
                  yRight={{ unit: "A", color: th.i, tickCount: 5 }}
                  xLabels={["-60s", "-40s", "-20s", "now"]}
                  series={[
                    {
                      data: V,
                      stroke: th.v,
                      fill: th.v,
                      gradientId: "saasV",
                      axis: "left",
                    },
                    {
                      data: I,
                      stroke: th.i,
                      axis: "right",
                    },
                  ]}
                />
              </Card>

              {/* SoC — EKF + real ground truth, two curves */}
              <Card style={{ padding: "18px 20px" }} th={th}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      State of charge
                    </div>
                    <div style={{ fontSize: 12, color: th.mute, marginTop: 2 }}>
                      EKF estimate vs. ground truth
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: th.mute,
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 2,
                          background: th.soc,
                          display: "inline-block",
                        }}
                      />
                      EKF {now.SoC.toFixed(1)}%
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: th.mute,
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 0,
                          borderTop: `2px dashed ${th.v}`,
                          display: "inline-block",
                        }}
                      />
                      Real {(bms.status?.soc_real ?? now.SoC).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <AxisChart
                  width={600}
                  height={400}
                  theme={chartTheme}
                  yLeft={{ unit: "%", color: th.soc, tickCount: 5 }}
                  xLabels={["-60s", "-40s", "-20s", "now"]}
                  series={[
                    {
                      data: SoC,
                      stroke: th.soc,
                      fill: th.soc,
                      gradientId: "saasS",
                      axis: "left",
                    },
                    {
                      data: SoC_real,
                      stroke: th.v,
                      dashed: true,
                      axis: "left",
                    },
                  ]}
                />
              </Card>
            </div>

            {/* Stats + Faults side-by-side */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <Card style={{ padding: "18px 20px" }} th={th}>
                <div
                  style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}
                >
                  Session statistics
                </div>
                {[
                  { k: "Voltage", unit: "V", arr: V, col: th.v },
                  { k: "Current", unit: "A", arr: I, col: th.i },
                  { k: "Temperature", unit: "°C", arr: T, col: th.t },
                ].map((r, idx) => {
                  const st = sessionStat(r.arr);
                  return (
                    <div
                      key={r.k}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "100px repeat(3, 1fr)",
                        gap: 8,
                        fontSize: 12,
                        padding: "8px 0",
                        borderTop:
                          idx > 0 ? `1px solid ${th.border}` : "none",
                      }}
                    >
                      <div
                        style={{
                          color: th.mute,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 99,
                            background: r.col,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        {r.k}
                      </div>
                      <div>
                        <div style={{ color: th.soft, fontSize: 10 }}>min</div>
                        <div
                          style={{
                            fontWeight: 500,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {st.mn.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: th.soft, fontSize: 10 }}>avg</div>
                        <div
                          style={{
                            fontWeight: 500,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {st.avg.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: th.soft, fontSize: 10 }}>max</div>
                        <div
                          style={{
                            fontWeight: 500,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {st.mx.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>

              <Card style={{ padding: "18px 20px" }} th={th}>
                <div
                  style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}
                >
                  Faults
                </div>
                {[
                  { k: "Over-voltage", on: false, lim: "4.20 V" },
                  { k: "Under-voltage", on: false, lim: "2.80 V" },
                  { k: "Over-temp", on: now.T > 45, lim: "45 °C" },
                  { k: "Over-current", on: Math.abs(now.I) > 10, lim: "10 A" },
                ].map((a, idx) => (
                  <div
                    key={a.k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderTop:
                        idx > 0 ? `1px solid ${th.border}` : "none",
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 99,
                          background: a.on ? "#ef4444" : th.soc,
                          display: "inline-block",
                        }}
                      />
                      <span>{a.k}</span>
                    </div>
                    <div style={{ color: th.mute, fontSize: 11 }}>
                      ≤ {a.lim}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </>
        )}

        {view === "canbus" && (
          <CANList
            log={fullLog}
            rxCount={rxCount}
            txCount={txCount}
            th={th}
            title="CAN messages"
            subtitle={`Decoded per DBC · ${fullLog.length} frames buffered`}
          />
        )}
      </div>
    </div>
  );
}

