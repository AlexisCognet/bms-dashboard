// Shared simulated BMS data generator.
// Produces a smooth stream of V/I/T/SoC + CAN frames that all 5 variants use.

const BMSData = (() => {
  const HISTORY_SEC = 60;
  const HZ = 10;
  const N = HISTORY_SEC * HZ;

  // State
  let t = 0;
  const V = new Float32Array(N);
  const I = new Float32Array(N);
  const SoC = new Float32Array(N);
  const T = new Float32Array(N);
  const P = new Float32Array(N);

  let soc = 67.4;
  let vNom = 3.74;
  let iNom = -1.8;
  let temp = 28.4;

  // Pre-fill history with a plausible shape
  for (let i = 0; i < N; i++) {
    const ph = (i / N) * Math.PI * 2;
    const iV = -1.8 + Math.sin(ph * 3) * 1.2 + Math.sin(ph * 7) * 0.3;
    const vV = 3.74 + Math.sin(ph * 2) * 0.08 - iV * 0.02;
    V[i] = vV;
    I[i] = iV;
    SoC[i] = 68 - (i / N) * 1.2;
    T[i] = 28 + Math.sin(ph * 2) * 1.5;
    P[i] = vV * iV;
  }

  // CAN frames
  const canLog = [];
  const CAN_MAX = 200;
  const DBC = [
    { id: 0x100, name: 'BMS_CELL_VITALS', dir: 'RX', fields: () => [
      { k: 'Vcell', v: vNom.toFixed(3), u: 'V' },
      { k: 'Icell', v: iNom.toFixed(2), u: 'A' },
      { k: 'Tcell', v: temp.toFixed(1), u: '°C' },
    ]},
    { id: 0x101, name: 'BMS_SOC_STATE', dir: 'RX', fields: () => [
      { k: 'SoC', v: soc.toFixed(1), u: '%' },
      { k: 'SoH', v: '98.2', u: '%' },
      { k: 'Cycles', v: '142', u: '' },
    ]},
    { id: 0x102, name: 'BMS_FAULT_FLAGS', dir: 'RX', fields: () => [
      { k: 'OV', v: '0', u: '' },
      { k: 'UV', v: '0', u: '' },
      { k: 'OT', v: temp > 45 ? '1' : '0', u: '' },
      { k: 'OC', v: Math.abs(iNom) > 10 ? '1' : '0', u: '' },
    ]},
    { id: 0x200, name: 'HOST_BALANCE_CMD', dir: 'TX', fields: () => [
      { k: 'Enable', v: '1', u: '' },
      { k: 'Target', v: '3.700', u: 'V' },
    ]},
    { id: 0x201, name: 'HOST_LOG_REQ', dir: 'TX', fields: () => [
      { k: 'Rate', v: '10', u: 'Hz' },
    ]},
  ];

  const subs = new Set();

  function step() {
    t++;
    // Drive-cycle-ish current profile
    const ph = t / HZ;
    iNom = -1.8 + Math.sin(ph * 0.6) * 1.4 + Math.sin(ph * 2.1) * 0.5
           + (Math.random() - 0.5) * 0.15;
    // SoC decays with current (discharge = neg I)
    soc = Math.max(0, Math.min(100, soc + iNom * 0.0008));
    // OCV curve-ish
    const ocv = 3.40 + soc * 0.008 + Math.max(0, soc - 60) * 0.002;
    vNom = ocv + iNom * 0.022 + (Math.random() - 0.5) * 0.004;
    temp += (28.5 + Math.abs(iNom) * 0.3 - temp) * 0.02 + (Math.random() - 0.5) * 0.05;

    // Shift buffers
    for (let i = 0; i < N - 1; i++) {
      V[i] = V[i + 1]; I[i] = I[i + 1]; SoC[i] = SoC[i + 1];
      T[i] = T[i + 1]; P[i] = P[i + 1];
    }
    V[N - 1] = vNom;
    I[N - 1] = iNom;
    SoC[N - 1] = soc;
    T[N - 1] = temp;
    P[N - 1] = vNom * iNom;

    // Emit 1-2 CAN frames per tick
    const frame = DBC[t % DBC.length];
    canLog.push({
      t: Date.now(),
      id: frame.id,
      name: frame.name,
      dir: frame.dir,
      fields: frame.fields(),
      bytes: Array.from({ length: 8 }, () => Math.floor(Math.random() * 256)),
    });
    if (t % 3 === 0) {
      const f2 = DBC[(t + 2) % DBC.length];
      canLog.push({
        t: Date.now(),
        id: f2.id,
        name: f2.name,
        dir: f2.dir,
        fields: f2.fields(),
        bytes: Array.from({ length: 8 }, () => Math.floor(Math.random() * 256)),
      });
    }
    while (canLog.length > CAN_MAX) canLog.shift();

    subs.forEach((fn) => fn());
  }

  setInterval(step, 100);

  return {
    HZ, N, HISTORY_SEC,
    getV: () => V, getI: () => I, getSoC: () => SoC, getT: () => T, getP: () => P,
    now: () => ({ V: vNom, I: iNom, SoC: soc, T: temp, P: vNom * iNom }),
    can: () => canLog,
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
  };
})();

// React hook — re-renders on each tick
function useBMS() {
  const [, setTick] = React.useState(0);
  React.useEffect(() => BMSData.subscribe(() => setTick((x) => x + 1)), []);
  return BMSData;
}

// Tiny SVG line-chart helper (no lib; decimates to fit pixel count)
function Sparkline({ data, width, height, stroke = '#fff', strokeWidth = 1.5,
                    min, max, fill, gradientId, baselineZero, showDots = false,
                    padY = 4, smooth = true }) {
  if (!data || data.length === 0) return null;
  // Decimate: at most ~2 samples per pixel
  const step = Math.max(1, Math.floor(data.length / (width * 2)));
  const pts = [];
  for (let i = 0; i < data.length; i += step) pts.push(data[i]);
  if (pts[pts.length - 1] !== data[data.length - 1]) pts.push(data[data.length - 1]);

  let lo = min, hi = max;
  if (lo == null || hi == null) {
    lo = Infinity; hi = -Infinity;
    for (const v of pts) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (baselineZero) lo = Math.min(lo, 0);
    const pad = (hi - lo) * 0.08 || 0.1;
    lo -= pad; hi += pad;
  }
  const range = hi - lo || 1;
  const xs = (i) => (i / (pts.length - 1)) * width;
  const ys = (v) => padY + (1 - (v - lo) / range) * (height - padY * 2);

  let d = '';
  if (smooth) {
    // Cardinal-ish smoothing
    for (let i = 0; i < pts.length; i++) {
      const x = xs(i), y = ys(pts[i]);
      if (i === 0) d += `M${x.toFixed(1)},${y.toFixed(1)}`;
      else {
        const px = xs(i - 1), py = ys(pts[i - 1]);
        const mx = (px + x) / 2;
        d += ` Q${px.toFixed(1)},${py.toFixed(1)} ${mx.toFixed(1)},${((py + y) / 2).toFixed(1)} T${x.toFixed(1)},${y.toFixed(1)}`;
      }
    }
  } else {
    for (let i = 0; i < pts.length; i++) {
      const x = xs(i), y = ys(pts[i]);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
    }
  }

  const areaD = d + ` L${width},${height} L0,${height} Z`;
  const baselineY = ys(0);
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {gradientId && fill && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity="0.35" />
            <stop offset="100%" stopColor={fill} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {baselineZero && baselineY > 0 && baselineY < height && (
        <line x1="0" x2={width} y1={baselineY} y2={baselineY} stroke={stroke} strokeOpacity="0.25" strokeDasharray="2 3" />
      )}
      {fill && <path d={areaD} fill={gradientId ? `url(#${gradientId})` : fill} />}
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {showDots && (
        <circle cx={xs(pts.length - 1)} cy={ys(pts[pts.length - 1])} r={3} fill={stroke} />
      )}
    </svg>
  );
}

Object.assign(window, { BMSData, useBMS, Sparkline });
