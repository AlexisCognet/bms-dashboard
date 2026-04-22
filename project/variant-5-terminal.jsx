// V5 — Brutalist terminal. Monospace everywhere, ASCII ornaments.

function V5Terminal({ dark = true }) {
  const bms = useBMS();
  const now = bms.now();
  const V = bms.getV(), I = bms.getI(), S = bms.getSoC(), T = bms.getT();
  const log = bms.can().slice(-12).reverse();

  const th = dark ? {
    bg: '#0b0b0a', panel: '#0b0b0a', border: '#2b2b28', borderHi: '#4a4a45',
    text: '#e8e8e1', mute: '#8a8a82', soft: '#55554f',
    phos: '#a6e22e', red: '#f92672', amber: '#fd971f', blue: '#66d9ef', pink: '#ae81ff',
  } : {
    bg: '#f4f3ee', panel: '#f4f3ee', border: '#b5b2a5', borderHi: '#6d6a5e',
    text: '#1a1a18', mute: '#555', soft: '#8a8679',
    phos: '#2a6a0e', red: '#b30838', amber: '#a35a0e', blue: '#0a608a', pink: '#6b3fa0',
  };

  const mono = '"JetBrains Mono", "IBM Plex Mono", ui-monospace, "Courier New", monospace';

  const Box = ({ title, children, style, right }) => (
    <div style={{ border: `1px solid ${th.border}`, background: th.panel, display: 'flex', flexDirection: 'column', minHeight: 0, ...style }}>
      <div style={{ borderBottom: `1px solid ${th.border}`, padding: '4px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: mono, fontSize: 11, color: th.text, textTransform: 'uppercase', letterSpacing: 1 }}>
        <span>[ {title} ]</span>
        {right && <span style={{ color: th.mute, textTransform: 'none', letterSpacing: 0 }}>{right}</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  );

  // ASCII bar from 0..1
  const barChars = (frac, width) => {
    const full = Math.floor(frac * width);
    const rem = frac * width - full;
    const partials = [' ','▏','▎','▍','▌','▋','▊','▉'];
    const p = partials[Math.floor(rem * 8)];
    return '█'.repeat(full) + p + ' '.repeat(Math.max(0, width - full - 1));
  };

  const Chart = ({ data, color, min, max, height = 140, label, zeroLine }) => {
    let lo = min, hi = max;
    if (lo == null) { lo = Infinity; for (const v of data) if (v < lo) lo = v; lo -= 0.03 * Math.abs(lo||1); }
    if (hi == null) { hi = -Infinity; for (const v of data) if (v > hi) hi = v; hi += 0.03 * Math.abs(hi||1); }
    if (zeroLine) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const range = hi - lo || 1;
    const W = 700;
    const step = Math.max(1, Math.floor(data.length / W));
    const pts = [];
    for (let i = 0; i < data.length; i += step) pts.push(data[i]);
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const x = (i / (pts.length - 1)) * W;
      const y = (1 - (pts[i] - lo) / range) * height;
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    const zeroY = zeroLine && lo < 0 && hi > 0 ? (1 - (0 - lo) / range) * height : null;
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {/* ASCII-style dotted grid */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1="0" x2={W} y1={f * height} y2={f * height} stroke={th.border} strokeDasharray="2 6" />
        ))}
        {zeroY != null && <line x1="0" x2={W} y1={zeroY} y2={zeroY} stroke={th.mute} strokeDasharray="4 3" />}
        <path d={d} stroke={color} strokeWidth="1.5" fill="none" />
        <text x="6" y="14" fontFamily={mono} fontSize="10" fill={th.mute}>{hi.toFixed(2)}</text>
        <text x="6" y={height - 4} fontFamily={mono} fontSize="10" fill={th.mute}>{lo.toFixed(2)}</text>
        <text x={W - 6} y="14" fontFamily={mono} fontSize="10" fill={color} textAnchor="end">{label}</text>
      </svg>
    );
  };

  const stat = (arr) => {
    let mn = Infinity, mx = -Infinity, s = 0;
    for (const v of arr) { if (v < mn) mn = v; if (v > mx) mx = v; s += v; }
    return { mn, mx, avg: s / arr.length };
  };
  const vS = stat(V), iS = stat(I), sS = stat(S), tS = stat(T);

  return (
    <div style={{ width: '100%', height: '100%', background: th.bg, color: th.text, fontFamily: mono,
      fontSize: 12, overflow: 'hidden', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
      {/* ASCII header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${th.border}` }}>
        <pre style={{ margin: 0, color: th.phos, fontSize: 10, lineHeight: 1.1, fontFamily: mono }}>
{` ████████╗██╗  ██╗ ██████╗ ██████╗
 ╚══██╔══╝██║  ██║██╔═══██╗██╔══██╗      BMS · SINGLE-CELL TELEMETRY
    ██║   ███████║██║   ██║██████╔╝      rev 2.3.1 · build 20260421
    ██║   ██╔══██║██║   ██║██╔══██╗      ┌─ LIVE · /dev/ttyUSB0 · 115200 8N1 · 10 Hz ─┐
    ██║   ██║  ██║╚██████╔╝██║  ██║      └────────────────────────────────────────────┘
    ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝`}
        </pre>
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gridTemplateRows: 'auto 1fr auto',
        gap: 0, minHeight: 0 }}>
        {/* V/I chart big */}
        <Box title="voltage + current · 60s" right="Δt = 100 ms" style={{ gridColumn: 'span 2', borderRight: 'none', borderBottom: 'none' }}>
          <div style={{ padding: 8 }}>
            <Chart data={V} color={th.blue} height={100} label="V [V]" />
            <div style={{ height: 4 }} />
            <Chart data={I} color={th.amber} height={100} label="I [A]" zeroLine />
          </div>
        </Box>

        {/* Big readouts right */}
        <Box title="instantaneous" style={{ borderBottom: 'none' }}>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { k: 'V', v: now.V.toFixed(3), u: 'V', c: th.blue, range: [2.5, 4.3] },
              { k: 'I', v: (now.I>=0?'+':'') + now.I.toFixed(2), u: 'A', c: th.amber, range: [-10, 5], raw: now.I },
              { k: 'SoC', v: now.SoC.toFixed(1), u: '%', c: th.phos, range: [0, 100] },
              { k: 'T', v: now.T.toFixed(1), u: '°C', c: th.pink, range: [-10, 60] },
            ].map(r => {
              const raw = r.raw != null ? r.raw : parseFloat(r.v);
              const f = (raw - r.range[0]) / (r.range[1] - r.range[0]);
              return (
                <div key={r.k}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: th.mute }}>{r.k.padEnd(4, ' ')}</span>
                    <span style={{ color: r.c, fontSize: 18, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                      {r.v} <span style={{ fontSize: 11, color: th.mute }}>{r.u}</span>
                    </span>
                  </div>
                  <div style={{ color: r.c, fontSize: 11, letterSpacing: 1, marginTop: 2,
                    whiteSpace: 'pre', fontFamily: mono }}>
                    │{barChars(Math.max(0, Math.min(1, f)), 22)}│ {(f*100).toFixed(0).padStart(3,' ')}%
                  </div>
                </div>
              );
            })}
          </div>
        </Box>

        {/* SoC chart */}
        <Box title="soc · 60s trace" right={`now ${now.SoC.toFixed(1)}%`} style={{ borderRight: 'none', borderBottom: 'none' }}>
          <div style={{ padding: 8 }}>
            <Chart data={S} color={th.phos} height={140} label="SoC [%]" min={sS.mn - 0.5} max={sS.mx + 0.5} />
          </div>
        </Box>

        {/* stats */}
        <Box title="min / avg / max · 60s" style={{ borderRight: 'none', borderBottom: 'none' }}>
          <div style={{ padding: '8px 12px', fontSize: 11, lineHeight: 1.7 }}>
            <div style={{ color: th.mute, display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr', borderBottom: `1px solid ${th.border}`, paddingBottom: 3 }}>
              <span></span><span>min</span><span>avg</span><span>max</span>
            </div>
            {[
              { k: 'V [V]', s: vS, c: th.blue, d: 3 },
              { k: 'I [A]', s: iS, c: th.amber, d: 2 },
              { k: 'SoC[%]', s: sS, c: th.phos, d: 1 },
              { k: 'T [°C]', s: tS, c: th.pink, d: 1 },
            ].map(r => (
              <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr',
                fontVariantNumeric: 'tabular-nums', color: th.text, paddingTop: 2 }}>
                <span style={{ color: r.c }}>{r.k}</span>
                <span>{r.s.mn.toFixed(r.d)}</span>
                <span>{r.s.avg.toFixed(r.d)}</span>
                <span>{r.s.mx.toFixed(r.d)}</span>
              </div>
            ))}
            <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px solid ${th.border}`, color: th.mute }}>
              samples..600  hz........10.0<br/>
              link..OPEN   uart_err..0<br/>
              dbc....v2.3.1 frames....{bms.can().length}
            </div>
          </div>
        </Box>

        {/* faults */}
        <Box title="faults / flags">
          <div style={{ padding: '8px 12px', fontSize: 11, lineHeight: 1.8 }}>
            {[
              { k: 'OV', on: false, note: 'V < 4.20' },
              { k: 'UV', on: false, note: 'V > 2.80' },
              { k: 'OT', on: now.T > 45, note: 'T < 45°C' },
              { k: 'OC', on: Math.abs(now.I) > 10, note: '|I| < 10A' },
              { k: 'CRC', on: false, note: 'crc8 ok' },
              { k: 'TIMEOUT', on: false, note: 'rx < 250ms' },
              { k: 'BAL', on: true, note: 'balancing' },
              { k: 'REC', on: true, note: 'recording' },
            ].map(a => (
              <div key={a.k} style={{ display: 'grid', gridTemplateColumns: '18px 70px 1fr auto', fontVariantNumeric: 'tabular-nums' }}>
                <span style={{ color: a.on ? (a.k === 'BAL' || a.k === 'REC' ? th.phos : th.red) : th.soft }}>
                  {a.on ? (a.k === 'BAL' || a.k === 'REC' ? '●' : '▲') : '○'}
                </span>
                <span style={{ color: th.text }}>{a.k}</span>
                <span style={{ color: th.mute }}>{a.note}</span>
                <span style={{ color: a.on ? (a.k === 'BAL' || a.k === 'REC' ? th.phos : th.red) : th.mute }}>
                  [{a.on ? (a.k === 'BAL' || a.k === 'REC' ? ' ON ' : 'TRIP') : ' OK '}]
                </span>
              </div>
            ))}
          </div>
        </Box>

        {/* CAN log full width */}
        <Box title="can bus · decoded stream" right={`500k · rx ${bms.can().filter(f=>f.dir==='RX').length} · tx ${bms.can().filter(f=>f.dir==='TX').length}`}
          style={{ gridColumn: 'span 3', borderTop: `1px solid ${th.border}` }}>
          <div style={{ overflowY: 'auto', maxHeight: 230, fontSize: 11 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '70px 34px 56px 150px 1fr', gap: 8,
              padding: '4px 12px', color: th.mute, borderBottom: `1px solid ${th.border}`, position: 'sticky', top: 0, background: th.panel }}>
              <span>t.rel</span><span>dir</span><span>id</span><span>name</span><span>decoded fields</span>
            </div>
            {log.map((f, i) => {
              const isTx = f.dir === 'TX';
              const col = isTx ? th.amber : th.blue;
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 34px 56px 150px 1fr', gap: 8,
                  padding: '3px 12px', color: th.text,
                  borderBottom: `1px dotted ${th.border}`,
                  background: i === 0 ? (dark ? 'rgba(166,226,46,.05)' : 'rgba(42,106,14,.05)') : 'transparent' }}>
                  <span style={{ color: th.mute, fontVariantNumeric: 'tabular-nums' }}>{i === 0 ? '   0.0ms' : `-${(i * 300).toFixed(0)}ms`.padStart(9,' ')}</span>
                  <span style={{ color: col, fontWeight: 600 }}>{isTx ? '»TX' : '«RX'}</span>
                  <span>0x{f.id.toString(16).toUpperCase().padStart(3,'0')}</span>
                  <span style={{ color: th.mute }}>{f.name}</span>
                  <span>
                    {f.fields.map((fd, j) => (
                      <span key={j} style={{ marginRight: 14 }}>
                        <span style={{ color: th.soft }}>{fd.k}=</span>
                        <span style={{ color: th.text }}>{fd.v}</span>
                        {fd.u && <span style={{ color: th.soft }}>{fd.u}</span>}
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
      <div style={{ borderTop: `1px solid ${th.border}`, padding: '4px 14px',
        display: 'flex', gap: 18, fontSize: 11, color: th.mute }}>
        <span><span style={{ color: th.phos }}>●</span> LIVE</span>
        <span>F1 help</span><span>F2 record</span><span>F3 export</span><span>F5 reset stats</span>
        <span style={{ flex: 1 }} />
        <span>THOR-01 · t+00:24:17.3 · load 0.12 · mem 18M</span>
      </div>
    </div>
  );
}

window.V5Terminal = V5Terminal;
