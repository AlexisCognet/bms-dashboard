import { useEffect, useRef, useState } from "react";
import type { BMSState, CANFrame } from "../types/bms";

// ---------------------------------------------------------------------------
// Simulated BMS — runs in-browser when the backend is unavailable.
// Mirrors the Python backend's step() logic.
// ---------------------------------------------------------------------------
const HISTORY_SEC = 60;
const HZ = 10;
const N = HISTORY_SEC * HZ;

function createSimulator() {
  const V = new Float32Array(N);
  const I = new Float32Array(N);
  const SoC = new Float32Array(N);       // EKF
  const SoC_real = new Float32Array(N);  // ground-truth
  const T = new Float32Array(N);
  const P = new Float32Array(N);

  let soc = 67.4;
  let socReal = 68.0;
  let vNom = 3.74;
  let iNom = -1.8;
  let temp = 28.4;
  let tick = 0;
  const canLog: CANFrame[] = [];

  const DBC = [
    { id: 0x100, name: "BMS_CELL_VITALS", dir: "RX" as const },
    { id: 0x101, name: "BMS_SOC_STATE", dir: "RX" as const },
    { id: 0x102, name: "BMS_FAULT_FLAGS", dir: "RX" as const },
    { id: 0x200, name: "HOST_BALANCE_CMD", dir: "TX" as const },
    { id: 0x201, name: "HOST_LOG_REQ", dir: "TX" as const },
  ];

  function dbcFields(idx: number) {
    if (idx === 0)
      return [
        { k: "Vcell", v: vNom.toFixed(3), u: "V" },
        { k: "Icell", v: iNom.toFixed(2), u: "A" },
        { k: "Tcell", v: temp.toFixed(1), u: "°C" },
      ];
    if (idx === 1)
      return [
        { k: "SoC", v: soc.toFixed(1), u: "%" },
        { k: "SoH", v: "98.2", u: "%" },
        { k: "Cycles", v: "142", u: "" },
      ];
    if (idx === 2)
      return [
        { k: "OV", v: "0", u: "" },
        { k: "UV", v: "0", u: "" },
        { k: "OT", v: temp > 45 ? "1" : "0", u: "" },
        { k: "OC", v: Math.abs(iNom) > 10 ? "1" : "0", u: "" },
      ];
    if (idx === 3)
      return [
        { k: "Enable", v: "1", u: "" },
        { k: "Target", v: "3.700", u: "V" },
      ];
    return [{ k: "Rate", v: "10", u: "Hz" }];
  }

  // Pre-fill history
  for (let i = 0; i < N; i++) {
    const ph = (i / N) * Math.PI * 2;
    const iV = -1.8 + Math.sin(ph * 3) * 1.2 + Math.sin(ph * 7) * 0.3;
    const vV = 3.74 + Math.sin(ph * 2) * 0.08 - iV * 0.02;
    V[i] = vV;
    I[i] = iV;
    SoC[i] = 68 - (i / N) * 1.2;
    SoC_real[i] = 68 - (i / N) * 1.1 + 0.4;
    T[i] = 28 + Math.sin(ph * 2) * 1.5;
    P[i] = vV * iV;
  }

  function step() {
    tick++;
    const ph = tick / HZ;
    iNom =
      -1.8 +
      Math.sin(ph * 0.6) * 1.4 +
      Math.sin(ph * 2.1) * 0.5 +
      (Math.random() - 0.5) * 0.15;
    soc = Math.max(0, Math.min(100, soc + iNom * 0.0008));
    socReal = Math.max(
      0,
      Math.min(100, soc + 0.6 + Math.sin(ph * 0.3) * 0.3)
    );
    const ocv = 3.4 + soc * 0.008 + Math.max(0, soc - 60) * 0.002;
    vNom = ocv + iNom * 0.022 + (Math.random() - 0.5) * 0.004;
    temp +=
      (28.5 + Math.abs(iNom) * 0.3 - temp) * 0.02 +
      (Math.random() - 0.5) * 0.05;

    for (let k = 0; k < N - 1; k++) {
      V[k] = V[k + 1];
      I[k] = I[k + 1];
      SoC[k] = SoC[k + 1];
      SoC_real[k] = SoC_real[k + 1];
      T[k] = T[k + 1];
      P[k] = P[k + 1];
    }
    V[N - 1] = vNom;
    I[N - 1] = iNom;
    SoC[N - 1] = soc;
    SoC_real[N - 1] = socReal;
    T[N - 1] = temp;
    P[N - 1] = vNom * iNom;

    const fi = tick % DBC.length;
    const frame = DBC[fi];
    canLog.push({
      t: Date.now(),
      id: frame.id,
      name: frame.name,
      dir: frame.dir,
      fields: dbcFields(fi),
      bytes: Array.from({ length: 8 }, () => Math.floor(Math.random() * 256)),
    });
    if (tick % 3 === 0) {
      const fi2 = (tick + 2) % DBC.length;
      const f2 = DBC[fi2];
      canLog.push({
        t: Date.now(),
        id: f2.id,
        name: f2.name,
        dir: f2.dir,
        fields: dbcFields(fi2),
        bytes: Array.from({ length: 8 }, () => Math.floor(Math.random() * 256)),
      });
    }
    while (canLog.length > 200) canLog.shift();
  }

  function getState(): BMSState {
    return {
      now: { V: vNom, I: iNom, SoC: soc, T: temp, P: vNom * iNom },
      V: V.slice() as unknown as Float32Array,
      I: I.slice() as unknown as Float32Array,
      SoC: SoC.slice() as unknown as Float32Array,
      SoC_real: SoC_real.slice() as unknown as Float32Array,
      T: T.slice() as unknown as Float32Array,
      P: P.slice() as unknown as Float32Array,
      canLog: canLog.slice(-50),
    };
  }

  return { step, getState };
}

// ---------------------------------------------------------------------------
// Hook — tries the WebSocket backend, falls back to local simulation.
// ---------------------------------------------------------------------------
const WS_URL = "ws://localhost:8000/ws";

export function useBMS(): BMSState {
  const simRef = useRef<ReturnType<typeof createSimulator> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [state, setState] = useState<BMSState>(() => {
    simRef.current = createSimulator();
    return simRef.current.getState();
  });

  useEffect(() => {
    // `active` is set to false in the cleanup so that any async WS callbacks
    // (onerror / onclose) that fire after React StrictMode's simulated
    // unmount cannot start a second simulator interval.
    let active = true;
    let usingSim = false;

    function startSim() {
      if (!active || usingSim) return;
      usingSim = true;
      const sim = simRef.current!;
      timerRef.current = setInterval(() => {
        sim.step();
        setState(sim.getState());
      }, 1000 / HZ);
    }

    function tryWS() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      const failTimer = setTimeout(() => {
        ws.close();
        startSim();
      }, 2000);

      ws.onopen = () => clearTimeout(failTimer);

      ws.onmessage = (ev) => {
        if (!active) return;
        try {
          const data = JSON.parse(ev.data);
          setState({
            now: data.now,
            V: new Float32Array(data.V),
            I: new Float32Array(data.I),
            SoC: new Float32Array(data.SoC),
            SoC_real: new Float32Array(data.SoC_real ?? data.SoC),
            T: new Float32Array(data.T ?? []),
            P: new Float32Array(data.P ?? []),
            canLog: data.canLog ?? [],
            status: data.status,
          });
        } catch {
          // malformed message — ignore
        }
      };

      ws.onerror = () => {
        clearTimeout(failTimer);
        startSim();
      };

      ws.onclose = () => {
        clearTimeout(failTimer);
        if (!usingSim) startSim();
      };
    }

    tryWS();

    return () => {
      active = false;
      wsRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return state;
}
