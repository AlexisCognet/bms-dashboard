// V1 — Clean engineering tool. Grafana / oscilloscope DNA.
// Monospace headers, crisp grid, no-nonsense.

function V1Engineering({ dark = true }) {
  const bms = useBMS();
  const now = bms.now();
  const V = bms.getV(), I = bms.getI(), S = bms.getSoC(), T = bms.getT();
  const log = bms.can().slice(-10).reverse();

  const th = dark ? {
    bg: '#0e1116', panel: '#151a21', border: '#232a33', grid: 'rgba(255,255,255,.05)',
    text: '#e6ebf0', mute: '#7b8896', accent: '#3dd68c', warn: '#e5a23a', err: '#ef5a5a',
    v: '#5aa5ff', i: '#ff9a3d', soc: '#3dd68c', temp: '#c78bff',
  } : {
    bg: '#fafbfc', panel: '#ffffff', border: '#e4e7eb', grid: 'rgba(0,0,0,.05)',
    text: '#111418', mute: '#6b7280', accent: '#0a7a4a', warn: '#a35d00', err: '#b43838',
    v: '#1a5fb4', i: '#c45a10', soc: '#0a7a4a', temp: '#6b3fa0',
  };

  const mono = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
  const sans = '-apple-system, "Inter", system-ui, sans-serif';

  const minmax = (arr) => {
    let mn = Infinity, mx = -Infinity, sum = 0;
    for (const v of arr) { if (v < mn) mn = v; if (v > mx) mx = v; sum += v; }
    return { min: mn, max: mx, avg: sum / arr.length };
  };
  const vS = minmax(V), iS = minmax(I), tS = minmax(T);

  const Panel = ({ title, right, children, span = 1, row = 1 }) => (
    <div style={{ gridColumn: `span ${span}`, gridRow: `span ${row}`, background: th.panel,
      border: `1px solid ${th.border}`, borderRadius: 4, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: th.mute }}>
        <span>{title}</span>
        <span>{right}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  );

  const BigNum = ({ val, unit, label, color, sub }) => (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: th.mute, fontFamily: mono, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
        <span style={{ fontFamily: mono, fontSize: 32, fontWeight: 500, color: color || th.text, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
        <span style={{ fontFamily: mono, fontSize: 13, color: th.mute }}>{unit}</span>
      </div>
      {sub && <div style={{ fontFamily: mono, fontSize: 11, color: th.mute, marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const Chart = ({ data, color, min, max, unit, label, showZero, width = 680, height = 200, lastVal }) => {
    // Build axis grid/ticks ourselves for a scope look
    const pad = { l: 46, r: 12, t: 10, b: 22 };
    const w = width - pad.l - pad.r;
    const h = height - pad.t - pad.b;
    let lo = min, hi = max;
    if (lo == null) { lo = Infinity; for (const v of data) if (v < lo) lo = v; if (showZero) lo = Math.min(lo, 0); lo -= 0.05 * Math.abs(lo || 1); }
    if (hi == null) { hi = -Infinity; for (const v of data) if (v > hi) hi = v; if (showZero) hi = Math.max(hi, 0); hi += 0.05 * Math.abs(hi || 1); }
    const range = hi - lo || 1;
    const xs = (i) => pad.l + (i / (data.length - 1)) * w;
    const ys = (v) => pad.t + (1 - (v - lo) / range) * h;
    const step = Math.max(1, Math.floor(data.length / w));
    let d = '';
    for (let i = 0; i < data.length; i += step) {
      d += (i === 0 ? 'M' : 'L') + xs(i).toFixed(1) + ',' + ys(data[i]).toFixed(1);
    }
    const ticks = 4;
    const ytks = Array.from({ length: ticks + 1 }, (_, k) => lo + (range * k) / ticks);
    const xtks = [0, 15, 30, 45, 60];
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block', fontFamily: mono }}>
        {/* grid */}
        {ytks.map((v, k) => {
          const y = ys(v);
          return <g key={k}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke={th.grid} />
            <text x={pad.l - 6} y={y + 3} fontSize="9" fill={th.mute} textAnchor="end">{v.toFixed(Math.abs(v) < 10 ? 2 : 0)}</text>
          </g>;
        })}
        {xtks.map((s, k) => {
          const x = pad.l + ((60 - s) / 60) * w;
          return <g key={k}>
            <line x1={x} x2={x} y1={pad.t} y2={pad.t + h} stroke={th.grid} />
            <text x={x} y={height - 6} fontSize="9" fill={th.mute} textAnchor="middle">-{s}s</text>
          </g>;
        })}
        {showZero && lo < 0 && hi > 0 && (
          <line x1={pad.l} x2={width - pad.r} y1={ys(0)} y2={ys(0)} stroke={th.mute} strokeOpacity=".35" strokeDasharray="3 3" />
        )}
        <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
        {/* Latest value dot */}
        <circle cx={xs(data.length - 1)} cy={ys(data[data.length - 1])} r="3" fill={color} />
        {/* Axis label */}
        <text x={pad.l} y={14} fontSize="9" fill={th.mute} letterSpacing="1">{label} [{unit}]</text>
        <text x={width - pad.r} y={14} fontSize="10" fill={color} textAnchor="end" fontWeight="500">{lastVal}</text>
      </svg>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', background: th.bg, color: th.text, fontFamily: sans,
      display: 'grid', gridTemplateRows: '42px 1fr', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', padding: '0 14px', gap: 16, background: th.panel }}>
        <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: 2 }}>THOR<span style={{ color: th.mute, fontWeight: 400 }}>·BMS</span></div>
        <div style={{ width: 1, height: 18, background: th.border }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: mono, fontSize: 11, color: th.mute }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: th.accent, boxShadow: `0 0 6px ${th.accent}` }} />
          UART /dev/ttyUSB0 · 115200 · 10Hz
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: mono, fontSize: 11, color: th.mute }}>t = 00:24:17.3</div>
        <div style={{ fontFamily: mono, fontSize: 11, padding: '2px 8px', border: `1px solid ${th.border}`, borderRadius: 2, color: th.accent }}>REC</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 320px', gridTemplateRows: '1fr 1fr 1fr', gap: 8, padding: 8, minHeight: 0 }}>
        {/* LEFT — stacked metrics */}
        <div style={{ gridRow: 'span 3', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 4 }}>
            <BigNum val={now.V.toFixed(3)} unit="V" label="V_cell" color={th.v}
              sub={`min ${vS.min.toFixed(2)} · avg ${vS.avg.toFixed(2)} · max ${vS.max.toFixed(2)}`} />
          </div>
          <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 4 }}>
            <BigNum val={(now.I >= 0 ? '+' : '') + now.I.toFixed(2)} unit="A" label="I_cell" color={th.i}
              sub={`min ${iS.min.toFixed(2)} · avg ${iS.avg.toFixed(2)} · max ${iS.max.toFixed(2)}`} />
          </div>
          <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 4 }}>
            <BigNum val={now.SoC.toFixed(1)} unit="%" label="SoC" color={th.soc}
              sub="EKF · SoH 98.2% · 142 cycles" />
          </div>
          <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 4 }}>
            <BigNum val={now.T.toFixed(1)} unit="°C" label="T_cell" color={th.temp}
              sub={`min ${tS.min.toFixed(1)} · avg ${tS.avg.toFixed(1)} · max ${tS.max.toFixed(1)}`} />
          </div>
          <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 4, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: th.mute, fontFamily: mono, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Fault flags</div>
            {[['OV', false], ['UV', false], ['OT', now.T > 45], ['OC', Math.abs(now.I) > 10], ['CRC', false], ['TIMEOUT', false]].map(([k, on]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 11, padding: '2px 0' }}>
                <span style={{ color: th.mute }}>{k}</span>
                <span style={{ color: on ? th.err : th.accent }}>{on ? '● ACTIVE' : '○ OK'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER — 3 scope charts */}
        <Panel title="V_cell · 60s" right={<span style={{ color: th.v }}>{now.V.toFixed(3)} V</span>}>
          <Chart data={V} color={th.v} unit="V" label="V" lastVal={now.V.toFixed(3) + ' V'} />
        </Panel>
        <Panel title="I_cell · 60s" right={<span style={{ color: th.i }}>{(now.I >= 0 ? '+' : '') + now.I.toFixed(2)} A</span>}>
          <Chart data={I} color={th.i} unit="A" label="I" showZero lastVal={((now.I >= 0 ? '+' : '') + now.I.toFixed(2)) + ' A'} />
        </Panel>
        <Panel title="SoC · 60s" right={<span style={{ color: th.soc }}>{now.SoC.toFixed(1)} %</span>}>
          <Chart data={S} color={th.soc} unit="%" label="SoC" min={Math.min(...S) - 0.5} max={Math.max(...S) + 0.5} lastVal={now.SoC.toFixed(1) + ' %'} />
        </Panel>

        {/* RIGHT — CAN */}
        <Panel title="CAN · decoded" right="500 kbit/s" row={3}>
          <div style={{ overflowY: 'auto', height: '100%', fontFamily: mono, fontSize: 11 }}>
            {log.map((f, i) => (
              <div key={i} style={{ padding: '6px 10px', borderBottom: `1px solid ${th.border}`,
                background: i === 0 ? (dark ? 'rgba(61,214,140,.04)' : 'rgba(10,122,74,.04)') : 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ width: 18, fontSize: 9, color: f.dir === 'TX' ? th.warn : th.accent, fontWeight: 600 }}>{f.dir}</span>
                  <span style={{ color: th.text, fontWeight: 500 }}>0x{f.id.toString(16).toUpperCase().padStart(3, '0')}</span>
                  <span style={{ color: th.mute, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ color: th.mute, fontSize: 9 }}>{i === 0 ? 'now' : `-${(i * 0.3).toFixed(1)}s`}</span>
                </div>
                <div style={{ paddingLeft: 24, display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
                  {f.fields.map((fd, j) => (
                    <span key={j} style={{ color: th.mute }}>
                      {fd.k}=<span style={{ color: th.text }}>{fd.v}</span>{fd.u && <span style={{ color: th.mute }}> {fd.u}</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

window.V1Engineering = V1Engineering;
