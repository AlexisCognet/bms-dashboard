// V2 — Dark HUD / command-center. High contrast, neon accents, technical callouts.

function V2HUD({ dark = true }) {
  const bms = useBMS();
  const now = bms.now();
  const V = bms.getV(), I = bms.getI(), S = bms.getSoC(), T = bms.getT();
  const log = bms.can().slice(-12).reverse();

  const th = dark ? {
    bg: '#050810',
    bg2: 'radial-gradient(ellipse at top, #0b1528 0%, #050810 60%)',
    panel: 'rgba(15,22,38,.72)',
    border: 'rgba(100,160,255,.18)',
    borderHot: 'rgba(100,220,255,.45)',
    text: '#dfeaff', mute: '#6a7b96', deep: '#3e4d6b',
    cyan: '#4cf0ff', amber: '#ffbc3d', green: '#5affb5', pink: '#ff5fa8', red: '#ff4d6d',
  } : {
    bg: '#eaeef5',
    bg2: 'radial-gradient(ellipse at top, #f4f7fc 0%, #dfe5ee 60%)',
    panel: 'rgba(255,255,255,.75)',
    border: 'rgba(30,60,120,.15)',
    borderHot: 'rgba(30,120,160,.45)',
    text: '#0a1428', mute: '#5a6a85', deep: '#8898b2',
    cyan: '#0077a8', amber: '#a35800', green: '#10804a', pink: '#c03078', red: '#c02030',
  };

  const mono = '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace';
  const head = '"Space Grotesk", "Inter", system-ui, sans-serif';

  const Bracket = ({ children, title, accent = th.cyan, style }) => (
    <div style={{ position: 'relative', background: th.panel, border: `1px solid ${th.border}`,
      backdropFilter: 'blur(10px)', ...style }}>
      {/* corner brackets */}
      {[['0','0','t l'],[null,'0','0','t r'],['0',null,'0','b l'],[null,'0',null,'0','b r']].map((c, i) => {
        const pos = { position: 'absolute', width: 10, height: 10, borderColor: accent, borderStyle: 'solid', borderWidth: 0 };
        const styles = [
          { top: -1, left: -1, borderTopWidth: 2, borderLeftWidth: 2 },
          { top: -1, right: -1, borderTopWidth: 2, borderRightWidth: 2 },
          { bottom: -1, left: -1, borderBottomWidth: 2, borderLeftWidth: 2 },
          { bottom: -1, right: -1, borderBottomWidth: 2, borderRightWidth: 2 },
        ];
        return <span key={i} style={{ ...pos, ...styles[i] }} />;
      })}
      {title && (
        <div style={{ padding: '6px 12px', fontFamily: mono, fontSize: 9, letterSpacing: 2,
          color: accent, textTransform: 'uppercase', borderBottom: `1px solid ${th.border}` }}>
          ◆ {title}
        </div>
      )}
      {children}
    </div>
  );

  const Readout = ({ label, val, unit, color, sub }) => (
    <div style={{ textAlign: 'center', padding: '6px 4px' }}>
      <div style={{ fontFamily: mono, fontSize: 9, letterSpacing: 2, color: th.mute, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: head, fontSize: 34, fontWeight: 300, color, letterSpacing: -0.5,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginTop: 4,
        textShadow: `0 0 18px ${color}80` }}>
        {val}<span style={{ fontSize: 14, color: th.mute, marginLeft: 3, fontWeight: 400 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontFamily: mono, fontSize: 9, color: th.deep, marginTop: 4, letterSpacing: 1 }}>{sub}</div>}
    </div>
  );

  // Radial SoC gauge
  const SoCDial = ({ value }) => {
    const R = 58, SW = 6;
    const C = 2 * Math.PI * R;
    const frac = value / 100;
    return (
      <svg width="160" height="160" viewBox="-80 -80 160 160" style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <linearGradient id="socGradV2" x1="0" x2="1">
            <stop offset="0%" stopColor={th.cyan} />
            <stop offset="100%" stopColor={th.green} />
          </linearGradient>
        </defs>
        {/* tick marks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = -Math.PI / 2 + (i / 60) * Math.PI * 2;
          const r1 = R + 10, r2 = R + (i % 5 === 0 ? 16 : 13);
          const on = i / 60 <= frac;
          return <line key={i} x1={Math.cos(a) * r1} y1={Math.sin(a) * r1}
            x2={Math.cos(a) * r2} y2={Math.sin(a) * r2}
            stroke={on ? th.cyan : th.deep} strokeWidth={i % 5 === 0 ? 1.2 : 0.6} strokeOpacity={on ? 0.9 : 0.4} />;
        })}
        <circle r={R} fill="none" stroke={th.deep} strokeOpacity=".25" strokeWidth={SW} />
        <circle r={R} fill="none" stroke="url(#socGradV2)" strokeWidth={SW} strokeLinecap="round"
          strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90)" />
        <text x="0" y="-4" fontFamily={head} fontSize="32" fontWeight="300" textAnchor="middle" fill={th.text} style={{ textShadow: `0 0 12px ${th.cyan}` }}>{value.toFixed(1)}</text>
        <text x="0" y="12" fontFamily={mono} fontSize="9" textAnchor="middle" fill={th.mute} letterSpacing="2">PERCENT</text>
        <text x="0" y="28" fontFamily={mono} fontSize="8" textAnchor="middle" fill={th.deep} letterSpacing="1">STATE-OF-CHARGE</text>
      </svg>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%', background: th.bg, backgroundImage: th.bg2,
      color: th.text, fontFamily: head, overflow: 'hidden', position: 'relative',
      display: 'grid', gridTemplateRows: '56px 1fr' }}>
      {/* Scanning lines aesthetic */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: `repeating-linear-gradient(0deg, ${dark ? 'rgba(255,255,255,.014)' : 'rgba(0,0,0,.02)'} 0 1px, transparent 1px 3px)`, pointerEvents: 'none' }} />

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', gap: 20, borderBottom: `1px solid ${th.border}`, background: 'rgba(5,10,20,.35)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="22" height="22" viewBox="-12 -12 24 24">
            <path d="M-8,2 L0,-8 L8,2 L3,2 L3,8 L-3,8 L-3,2 Z" fill="none" stroke={th.cyan} strokeWidth="1.5" />
          </svg>
          <div>
            <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, letterSpacing: 4 }}>THOR</div>
            <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: 3, color: th.mute }}>BMS CONTROL · LIVE</div>
          </div>
        </div>
        <div style={{ width: 1, height: 28, background: th.border }} />
        <div style={{ display: 'flex', gap: 16, fontFamily: mono, fontSize: 10, letterSpacing: 1, color: th.mute }}>
          <span><span style={{ color: th.green }}>●</span> UART LINK</span>
          <span>115.2K BAUD</span>
          <span>10 Hz</span>
          <span>DBC v2.3.1</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontFamily: mono, fontSize: 10, color: th.mute, letterSpacing: 1 }}>
          MISSION T+00:24:17 · CELL_ID THOR_01
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12, padding: 12, minHeight: 0 }}>
        {/* Left column */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 12, minHeight: 0 }}>
          {/* Big readouts row */}
          <Bracket>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', padding: '10px 4px', borderTop: 'none' }}>
              <Readout label="V_CELL" val={now.V.toFixed(3)} unit="V" color={th.cyan} sub="nom 3.700 V" />
              <Readout label="I_CELL" val={(now.I >= 0 ? '+' : '') + now.I.toFixed(2)} unit="A" color={th.amber}
                sub={now.I < -0.1 ? 'DISCHARGING' : now.I > 0.1 ? 'CHARGING' : 'IDLE'} />
              <Readout label="P_CELL" val={now.P.toFixed(2)} unit="W" color={th.pink} sub="instantaneous" />
              <Readout label="T_CELL" val={now.T.toFixed(1)} unit="°C" color={th.green} sub="ntc · 28±5 nom" />
            </div>
          </Bracket>

          {/* Dual chart panel */}
          <Bracket title="VOLTAGE / CURRENT · 60s trace" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, position: 'relative', padding: 12 }}>
              <svg width="100%" height="100%" viewBox="0 0 700 300" preserveAspectRatio="none" style={{ display: 'block' }}>
                <defs>
                  <linearGradient id="vAreaHud" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={th.cyan} stopOpacity="0.35"/>
                    <stop offset="100%" stopColor={th.cyan} stopOpacity="0"/>
                  </linearGradient>
                  <linearGradient id="iAreaHud" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={th.amber} stopOpacity="0.35"/>
                    <stop offset="100%" stopColor={th.amber} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                {/* Grid */}
                {[0,1,2,3,4,5].map(i => <line key={'h'+i} x1="0" x2="700" y1={i*60} y2={i*60} stroke={th.border} />)}
                {[0,1,2,3,4,5,6].map(i => <line key={'v'+i} x1={i*100} x2={i*100} y1="0" y2="300" stroke={th.border} />)}
                {/* Voltage path */}
                {(() => {
                  let vmin = Infinity, vmax = -Infinity;
                  for (const v of V) { if (v < vmin) vmin = v; if (v > vmax) vmax = v; }
                  vmin -= 0.05; vmax += 0.05;
                  const vrng = vmax - vmin;
                  let imin = Infinity, imax = -Infinity;
                  for (const v of I) { if (v < imin) imin = v; if (v > imax) imax = v; }
                  imin = Math.min(imin - 0.5, 0); imax = Math.max(imax + 0.5, 0);
                  const irng = imax - imin;
                  const step = Math.max(1, Math.floor(V.length / 700));
                  let dv = '', di = '';
                  for (let i = 0; i < V.length; i += step) {
                    const x = (i / (V.length - 1)) * 700;
                    const vy = (1 - (V[i] - vmin) / vrng) * 300;
                    const iy = (1 - (I[i] - imin) / irng) * 300;
                    dv += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + vy.toFixed(1);
                    di += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + iy.toFixed(1);
                  }
                  const iZeroY = (1 - (0 - imin) / irng) * 300;
                  return <g>
                    <line x1="0" x2="700" y1={iZeroY} y2={iZeroY} stroke={th.amber} strokeOpacity=".3" strokeDasharray="4 4" />
                    <path d={dv + ' L700,300 L0,300 Z'} fill="url(#vAreaHud)" />
                    <path d={dv} stroke={th.cyan} strokeWidth="1.8" fill="none" style={{ filter: `drop-shadow(0 0 4px ${th.cyan})` }} />
                    <path d={di} stroke={th.amber} strokeWidth="1.8" fill="none" style={{ filter: `drop-shadow(0 0 4px ${th.amber})` }} />
                  </g>;
                })()}
              </svg>
              {/* Legend floating */}
              <div style={{ position: 'absolute', top: 16, left: 24, display: 'flex', gap: 16, fontFamily: mono, fontSize: 10, letterSpacing: 1 }}>
                <span style={{ color: th.cyan }}>━ V [3.2 – 4.1 V]</span>
                <span style={{ color: th.amber }}>━ I [-8 – +2 A]</span>
              </div>
              <div style={{ position: 'absolute', bottom: 16, right: 24, display: 'flex', gap: 12, fontFamily: mono, fontSize: 9, color: th.deep, letterSpacing: 1 }}>
                <span>-60s</span><span>-45s</span><span>-30s</span><span>-15s</span><span style={{ color: th.cyan }}>NOW</span>
              </div>
            </div>
          </Bracket>

          {/* Bottom row — SoC gauge + SoC trend + status */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 240px', gap: 12 }}>
            <Bracket title="SoC" accent={th.green}>
              <SoCDial value={now.SoC} />
            </Bracket>
            <Bracket title="SoC TREND · 60s" accent={th.green}>
              <div style={{ padding: 8 }}>
                <Sparkline data={S} width={400} height={120} stroke={th.green} fill={th.green}
                  gradientId="socHud" strokeWidth={1.8} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 9, color: th.deep, letterSpacing: 1, marginTop: 4 }}>
                  <span>min {Math.min(...S).toFixed(1)}%</span>
                  <span>avg {(S.reduce((a,b)=>a+b,0)/S.length).toFixed(1)}%</span>
                  <span>max {Math.max(...S).toFixed(1)}%</span>
                </div>
              </div>
            </Bracket>
            <Bracket title="ALERTS" accent={th.pink}>
              <div style={{ padding: '8px 12px', fontFamily: mono, fontSize: 10 }}>
                {[
                  { k: 'OV', on: false, note: '4.20 V' },
                  { k: 'UV', on: false, note: '2.80 V' },
                  { k: 'OT', on: now.T > 45, note: '45 °C' },
                  { k: 'OC', on: Math.abs(now.I) > 10, note: '10 A' },
                  { k: 'LINK', on: false, note: 'UART' },
                ].map(a => (
                  <div key={a.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', borderBottom: `1px dashed ${th.border}` }}>
                    <span style={{ color: a.on ? th.red : th.mute }}>{a.on ? '▲' : '·'} {a.k}</span>
                    <span style={{ color: a.on ? th.red : th.deep }}>{a.on ? 'TRIP' : 'NOMINAL'}</span>
                  </div>
                ))}
              </div>
            </Bracket>
          </div>
        </div>

        {/* Right column — CAN */}
        <Bracket title="CAN · decoded stream" accent={th.cyan} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${th.border}`, display: 'flex', gap: 12, fontFamily: mono, fontSize: 9, letterSpacing: 1, color: th.mute }}>
            <span><span style={{ color: th.green }}>●</span> RX {bms.can().filter(f=>f.dir==='RX').length}</span>
            <span><span style={{ color: th.amber }}>●</span> TX {bms.can().filter(f=>f.dir==='TX').length}</span>
            <span>BUS 500k</span>
            <span>ERR 0</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', fontFamily: mono, fontSize: 10 }}>
            {log.map((f, i) => {
              const isTx = f.dir === 'TX';
              const col = isTx ? th.amber : th.cyan;
              return (
                <div key={i} style={{ padding: '8px 12px', borderBottom: `1px solid ${th.border}`,
                  background: i === 0 ? (isTx ? 'rgba(255,188,61,.06)' : 'rgba(76,240,255,.06)') : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 8, padding: '1px 5px', border: `1px solid ${col}`, color: col, letterSpacing: 1, fontWeight: 600 }}>{f.dir}</span>
                    <span style={{ color: th.text, fontWeight: 500, letterSpacing: 1 }}>0x{f.id.toString(16).toUpperCase().padStart(3,'0')}</span>
                    <span style={{ color: th.mute, fontSize: 9, letterSpacing: 1 }}>{f.name}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ color: th.deep, fontSize: 9 }}>{i === 0 ? '► LIVE' : `T-${(i*0.3).toFixed(1)}s`}</span>
                  </div>
                  <div style={{ paddingLeft: 8, display: 'flex', flexWrap: 'wrap', gap: '3px 14px' }}>
                    {f.fields.map((fd, j) => (
                      <span key={j} style={{ color: th.deep }}>
                        {fd.k}<span style={{ color: th.mute }}>:</span> <span style={{ color: th.text }}>{fd.v}</span>
                        {fd.u && <span style={{ color: th.deep }}> {fd.u}</span>}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Bracket>
      </div>
    </div>
  );
}

window.V2HUD = V2HUD;
