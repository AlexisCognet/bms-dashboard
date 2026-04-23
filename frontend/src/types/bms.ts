export interface BMSSnapshot {
  V: number;
  I: number;
  SoC: number;
  T: number;
  P: number;
}

export interface CANField {
  k: string;
  v: string;
  u?: string;
}

export interface CANFrame {
  t: number;
  id: number;
  name: string;
  dir: "RX" | "TX";
  fields: CANField[];
  bytes: number[];
}

export interface BMSStatus {
  source: "sim" | "serial";
  connected: boolean;
  port: string;
  baud: number;
  error: string | null;
  bms_uptime_ms?: number;
  soc_real?: number;
}

export interface BMSState {
  now: BMSSnapshot;
  V: Float32Array;
  I: Float32Array;
  SoC: Float32Array;
  T: Float32Array;
  P: Float32Array;
  canLog: CANFrame[];
  status?: BMSStatus;
}
