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

export interface BMSState {
  now: BMSSnapshot;
  V: Float32Array;
  I: Float32Array;
  SoC: Float32Array;
  T: Float32Array;
  P: Float32Array;
  canLog: CANFrame[];
}
