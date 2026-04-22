// V4 — Automotive instrument cluster. Radial gauges, deep dashboard feel.

function V4Cluster({ dark = true }) {
  const bms = useBMS();
  const now = bms.now();
  const V = bms.getV(), I = bms.getI(), S = bms.getSoC(), T = bms.getT();
  const log = bms.can().slice(-6).reverse();

  const th = dark ? {
    bg: '#0a0c10',
    bgGrad: 'radial-gradient(ellipse at 50% 120%, #1a1e2a 0%, #0a0c10 60%)',
    panel: '#111419',
    panelHi: '#161a22',
    border: 'rgba(255,255,255,.06)',
    text: '#f2f5fb', mute: '#8a94a7', soft: '#4e5869',
    red: '#ff3d57', amber: '#ffb23d', green: '#3de080', cyan: '#46c8ff', white: '#ffffff',
  } : {
    bg: '#e9ecf1',
    bgGrad: 'radial-gradient(ellipse at 50% 120%, #f6f7fa 0%, #d8dce4 100%)',
    panel: '#ffffff',
    panelHi: '#f3f5f9',
    border: 'rgba(0,0,0,.08)',
    text: '#0d1117', mute: '#4a5568', soft: '#94a0b4',
    red: '#c1303e', amber: '#a3690b', green: '#148048', cyan: '#1673a0', white: '#0d1117',
  };

  const head = '"Space Grotesk", "Inter Display", "Inter", system-ui, sans-serif';
  const mono = '"JetBrains Mono", ui-monospace, Menlo, monospace';

  // Big arc gauge — 240° sweep
  const ArcGauge = ({ value, min, max, unit, label, color, size = 220, ticks = 9, zones = [], danger }) => {
    const R = size / 2 - 16;
    const span = 240; // degrees
    const start = -210; // bottom-left
    const deg2rad = (d) => d * Math.PI / 180;
    const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
    const arcPath = (from, to, r) => {
      const a0 = deg2rad(from), a1 = deg2rad(to);
      const x0 = Math.cos(a0) * r, y0 = Math.sin(a0) * r;
      const x1 = Math.cos(a1) * r, y1 = Math.sin(a1) * r;
      const large = Math.abs(to - from) > 180 ? 1 : 0;
      const sweep = to > from ? 1 : 0;
      return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} ${sweep} ${x1.toFixed(2)},${y1.toFixed(2)}`;
    };
    const needleAngle = start + frac * span;
    return (
      <svg width={size} height={size * 0.9} viewBox={`${-size/2} ${-size/2} ${size} ${size * 0.9}`} style={{ display: 'block' }}>
        {/* Outer ring */}
        <path d={arcPath(start, start + span, R)} stroke={th.soft} strokeOpacity=".35" strokeWidth="2" fill="none" />
        {/* Zones (red/amber) */}
        {zones.map((z, i) => {
          const a = start + ((z.from - min) / (max - min)) * span;
          const b = start + ((z.to - min) / (max - min)) * span;
          return <path key={i} d={arcPath(a, b, R)} stroke={z.color} strokeWidth="3" fill="none" strokeOpacity=".5" />;
        })}
        {/* Value arc */}
        <path d={arcPath(start, needleAngle, R)} stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }} />
        {/* Tick marks */}
        {Array.from({ length: ticks }).map((_, i) => {
          const a = deg2rad(start + (i / (ticks - 1)) * span);
          const r1 = R - 6, r2 = R - 16;
          const tv = min + ((max - min) * i) / (ticks - 1);
          return <g key={i}>
            <line x1={Math.cos(a) * r1} y1={Math.sin(a) * r1}
              x2={Math.cos(a) * r2} y2={Math.sin(a) * r2}
              stroke={th.mute} strokeWidth="1" />
            <text x={Math.cos(a) * (r2 - 10)} y={Math.sin(a) * (r2 - 10) + 3}
              fontSize="8" fill={th.soft} textAnchor="middle" fontFamily={mono}>
              {Math.abs(tv) >= 10 ? tv.toFixed(0) : tv.toFixed(1)}
            </text>
          </g>;
        })}
        {/* Needle */}
        <g transform={`rotate(${needleAngle})`}>
          <line x1="0" y1="0" x2={R - 6} y2="0" stroke={color} strokeWidth="2" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
          <circle r="3" fill={color} />
        </g>
        <circle r="6" fill={th.panel} stroke={color} strokeWidth="1.5" />
        {/* Center readout */}
        <text x="0" y={R - 22} fontSize="9" fill={th.mute} textAnchor="middle"
          fontFamily={mono} letterSpacing="2">{label}</text>
        <text x="0" y={R - 4} fontSize="24" fill={danger ? th.red : th.text} textAnchor="middle"
          fontFamily={head} fontWeight="500" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: -1 }}>
          {typeof value === 'number' ? (Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2)) : value}
          <tspan fontSize="11" fill={th.mute} dx="2" dy="-1">{unit}</tspan>
        </text>
      </svg>
    );
  };

  // Big SoC "battery" gauge — vertical bar, slick
  const SoCBattery = ({ value }) => {
    const h = 260, w = 90;
    const fillH = (h - 8) * value / 100;
    const color = value < 20 ? th.red : value < 40 ? th.amber : th.green;
    return (
      <svg width={w + 30} height={h + 40} viewBox={`0 0 ${w + 30} ${h + 40}`}>
        <defs>
          <linearGradient id="batGrad" x1="0" x2="0" y1="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {/* Terminal */}
        <rect x={(w + 30 - 30)/2} y="4" width="30" height="8" rx="2" fill={th.mute} />
        {/* Body */}
        <rect x="4" y="14" width={w + 22} height={h} rx="8" fill={th.panelHi} stroke={th.border} />
        {/* Fill */}
        <rect x="8" y={14 + (h - 8) - fillH} width={w + 14} height={fillH}
          fill="url(#batGrad)" rx="4" style={{ filter: `drop-shadow(0 0 12px ${color}80)` }} />
        {/* Tick marks at 25/50/75 */}
        {[25, 50, 75].map(p => (
          <g key={p}>
            <line x1="4" x2="16" y1={14 + (h - 8) * (1 - p/100)} y2={14 + (h - 8) * (1 - p/100)} stroke={th.mute} strokeOpacity=".5" />
            <text x="22" y={14 + (h - 8) * (1 - p/100) + 3} fontSize="9" fill={th.mute} fontFamily={mono}>{p}</text>
          </g>
        ))}
        {/* Readout */}
        <text x={(w + 30)/2} y={h + 32} fontSize="20" fill={th.text} textAnchor="middle"
          fontFamily={head} fontWeight="600" style={{ fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(1)}%</text>
      </svg>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', background: th.bg, backgroundImage: th.bgGrad,
      color: th.text, fontFamily: head, overflow: 'hidden',
      display: 'grid', gridTemplateRows: '52px 1fr' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: `1px solid ${th.border}`,
        background: th.panel, gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="-10 -10 20 20"><polygon points="-8,4 0,-8 8,4 4,4 4,8 -4,8 -4,4" fill={th.cyan}/></svg>
          <div style={{ fontFamily: head, fontSize: 15, fontWeight: 700, letterSpacing: 3 }}>THOR</div>
        </div>
        <div style={{ width: 1, height: 22, background: th.border }} />
        <div style={{ fontSize: 11, fontFamily: mono, color: th.mute, letterSpacing: 1 }}>CELL THOR-01 · UART 115.2K · 10Hz</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {['ODO','TRIP','SoH','Cycles'].map((k, i) => (
            <div key={k} style={{ padding: '3px 10px', borderRadius: 4, background: th.panelHi, fontFamily: mono, fontSize: 10, color: th.mute }}>
              <span style={{ color: th.soft }}>{k} </span>
              <span style={{ color: th.text }}>{['24:17','12.4A·h','98.2%','142'][i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12, padding: 12, minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12, minHeight: 0 }}>
          {/* Gauge row */}
          <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 12,
            padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 140px 1fr 1fr', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ArcGauge value={now.V} min={2.5} max={4.3} unit="V" label="VOLTAGE" color={th.cyan}
                zones={[{from:2.5,to:2.9,color:th.red},{from:4.1,to:4.3,color:th.red}]} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ArcGauge value={now.I} min={-10} max={5} unit="A" label="CURRENT" color={th.amber}
                zones={[{from:-10,to:-8,color:th.red},{from:4,to:5,color:th.red}]} />
            </div>
            {/* Center: battery */}
            <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
              <SoCBattery value={now.SoC} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ArcGauge value={now.P} min={-40} max={20} unit="W" label="POWER" color={th.cyan} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ArcGauge value={now.T} min={-10} max={60} unit="°C" label="TEMP" color={th.green}
                zones={[{from:45,to:60,color:th.red},{from:-10,to:0,color:th.cyan}]}
                danger={now.T > 45} />
            </div>
          </div>

          {/* Traces */}
          <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 12,
            padding: '14px 18px', display: 'grid', gridTemplateRows: 'auto 1fr 1fr 1fr', gap: 6, minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontFamily: mono, letterSpacing: 2, color: th.mute }}>LAST 60 SECONDS</div>
              <div style={{ fontSize: 10, fontFamily: mono, color: th.soft }}>600 samples · 10 Hz</div>
            </div>
            {[
              { k: 'V', data: V, color: th.cyan, unit: 'V', cur: now.V.toFixed(3) },
              { k: 'I', data: I, color: th.amber, unit: 'A', cur: (now.I>=0?'+':'')+now.I.toFixed(2), zero: true },
              { k: 'SoC', data: S, color: th.green, unit: '%', cur: now.SoC.toFixed(1) },
            ].map(row => (
              <div key={row.k} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', alignItems: 'center', gap: 12,
                borderTop: `1px dashed ${th.border}`, paddingTop: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: th.mute, fontFamily: mono, letterSpacing: 1 }}>{row.k}</div>
                  <div style={{ fontSize: 22, fontWeight: 500, fontFamily: head, color: row.color, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>
                    {row.cur}<span style={{ fontSize: 11, color: th.mute, marginLeft: 3 }}>{row.unit}</span>
                  </div>
                </div>
                <div style={{ height: '100%', minHeight: 60 }}>
                  <Sparkline data={row.data} width={680} height={68} stroke={row.color}
                    fill={row.color} gradientId={'v4'+row.k} strokeWidth={1.8} baselineZero={row.zero} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — CAN + faults */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12, minHeight: 0 }}>
          <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontFamily: mono, letterSpacing: 2, color: th.mute, marginBottom: 10 }}>WARNING LAMPS</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { k: '⚡', name: 'OV', on: false, c: th.red },
                { k: '▼', name: 'UV', on: false, c: th.amber },
                { k: '🌡', name: 'OT', on: now.T > 45, c: th.red },
                { k: 'A', name: 'OC', on: Math.abs(now.I) > 10, c: th.red },
                { k: '⚠', name: 'CRC', on: false, c: th.amber },
                { k: '⇄', name: 'LINK', on: false, c: th.amber },
                { k: '◉', name: 'BAL', on: true, c: th.cyan },
                { k: '⚙', name: 'REC', on: true, c: th.green },
              ].map(l => (
                <div key={l.name} style={{ padding: '10px 0', borderRadius: 8,
                  background: l.on ? l.c + '22' : th.panelHi,
                  border: `1px solid ${l.on ? l.c : th.border}`,
                  textAlign: 'center', opacity: l.on ? 1 : 0.4 }}>
                  <div style={{ fontSize: 16, color: l.on ? l.c : th.soft }}>{l.k}</div>
                  <div style={{ fontSize: 9, fontFamily: mono, color: l.on ? l.c : th.soft, letterSpacing: 1, marginTop: 2 }}>{l.name}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: th.panel, border: `1px solid ${th.border}`, borderRadius: 12, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${th.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 10, fontFamily: mono, letterSpacing: 2, color: th.mute }}>CAN · DECODED</div>
              <div style={{ fontSize: 10, fontFamily: mono, color: th.soft }}>500 kbit/s</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
              {log.map((f, i) => {
                const isTx = f.dir === 'TX';
                const col = isTx ? th.amber : th.cyan;
                return (
                  <div key={i} style={{ margin: 6, padding: '8px 10px', background: th.panelHi, borderRadius: 6,
                    borderLeft: `3px solid ${col}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: mono, fontSize: 10 }}>
                      <span style={{ color: col, fontWeight: 600 }}>{f.dir}</span>
                      <span style={{ color: th.text }}>0x{f.id.toString(16).toUpperCase().padStart(3,'0')}</span>
                      <span style={{ color: th.mute, fontSize: 9 }}>{f.name}</span>
                    </div>
                    <div style={{ marginTop: 3, fontSize: 11, color: th.text, fontFamily: head, lineHeight: 1.4 }}>
                      {f.fields.slice(0,3).map((fd, j) => (
                        <span key={j} style={{ marginRight: 10 }}>
                          <span style={{ color: th.mute }}>{fd.k}</span> <b>{fd.v}</b>
                          {fd.u && <span style={{ color: th.soft }}> {fd.u}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.V4Cluster = V4Cluster;
