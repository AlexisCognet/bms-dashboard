"""
THOR BMS Dashboard — FastAPI backend.

Streams simulated BMS telemetry at 10 Hz over a WebSocket at /ws.
Designed to be swapped for real UART data: replace the `step()` function
with reads from pyserial and parse your DBC there.

Run:
    uvicorn main:app --reload --port 8000
"""

import asyncio
import json
import math
import random
import time
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="THOR BMS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# BMS simulator — matches the JS shared-data.jsx behaviour
# ---------------------------------------------------------------------------
HISTORY_SEC = 60
HZ = 10
N = HISTORY_SEC * HZ  # 600 samples

_V = [0.0] * N
_I = [0.0] * N
_SoC = [0.0] * N
_T = [0.0] * N
_P = [0.0] * N

_soc = 67.4
_v_nom = 3.74
_i_nom = -1.8
_temp = 28.4
_tick = 0

_can_log: list[dict[str, Any]] = []
_CAN_MAX = 200

DBC = [
    {"id": 0x100, "name": "BMS_CELL_VITALS", "dir": "RX"},
    {"id": 0x101, "name": "BMS_SOC_STATE", "dir": "RX"},
    {"id": 0x102, "name": "BMS_FAULT_FLAGS", "dir": "RX"},
    {"id": 0x200, "name": "HOST_BALANCE_CMD", "dir": "TX"},
    {"id": 0x201, "name": "HOST_LOG_REQ", "dir": "TX"},
]


def _dbc_fields(idx: int) -> list[dict]:
    if idx == 0:
        return [
            {"k": "Vcell", "v": f"{_v_nom:.3f}", "u": "V"},
            {"k": "Icell", "v": f"{_i_nom:.2f}", "u": "A"},
            {"k": "Tcell", "v": f"{_temp:.1f}", "u": "°C"},
        ]
    if idx == 1:
        return [
            {"k": "SoC", "v": f"{_soc:.1f}", "u": "%"},
            {"k": "SoH", "v": "98.2", "u": "%"},
            {"k": "Cycles", "v": "142", "u": ""},
        ]
    if idx == 2:
        return [
            {"k": "OV", "v": "0", "u": ""},
            {"k": "UV", "v": "0", "u": ""},
            {"k": "OT", "v": "1" if _temp > 45 else "0", "u": ""},
            {"k": "OC", "v": "1" if abs(_i_nom) > 10 else "0", "u": ""},
        ]
    if idx == 3:
        return [
            {"k": "Enable", "v": "1", "u": ""},
            {"k": "Target", "v": "3.700", "u": "V"},
        ]
    return [{"k": "Rate", "v": "10", "u": "Hz"}]


# Pre-fill history
for _i in range(N):
    _ph = (_i / N) * math.pi * 2
    _iV = -1.8 + math.sin(_ph * 3) * 1.2 + math.sin(_ph * 7) * 0.3
    _vV = 3.74 + math.sin(_ph * 2) * 0.08 - _iV * 0.02
    _V[_i] = _vV
    _I[_i] = _iV
    _SoC[_i] = 68.0 - (_i / N) * 1.2
    _T[_i] = 28 + math.sin(_ph * 2) * 1.5
    _P[_i] = _vV * _iV


def step() -> None:
    global _soc, _v_nom, _i_nom, _temp, _tick
    _tick += 1
    ph = _tick / HZ
    _i_nom = (
        -1.8
        + math.sin(ph * 0.6) * 1.4
        + math.sin(ph * 2.1) * 0.5
        + (random.random() - 0.5) * 0.15
    )
    _soc = max(0.0, min(100.0, _soc + _i_nom * 0.0008))
    ocv = 3.40 + _soc * 0.008 + max(0, _soc - 60) * 0.002
    _v_nom = ocv + _i_nom * 0.022 + (random.random() - 0.5) * 0.004
    _temp += (28.5 + abs(_i_nom) * 0.3 - _temp) * 0.02 + (random.random() - 0.5) * 0.05

    # Shift buffers
    for k in range(N - 1):
        _V[k] = _V[k + 1]
        _I[k] = _I[k + 1]
        _SoC[k] = _SoC[k + 1]
        _T[k] = _T[k + 1]
        _P[k] = _P[k + 1]
    _V[N - 1] = _v_nom
    _I[N - 1] = _i_nom
    _SoC[N - 1] = _soc
    _T[N - 1] = _temp
    _P[N - 1] = _v_nom * _i_nom

    frame_idx = _tick % len(DBC)
    frame = DBC[frame_idx]
    _can_log.append(
        {
            "t": int(time.time() * 1000),
            "id": frame["id"],
            "name": frame["name"],
            "dir": frame["dir"],
            "fields": _dbc_fields(frame_idx),
            "bytes": [random.randint(0, 255) for _ in range(8)],
        }
    )
    if _tick % 3 == 0:
        idx2 = (_tick + 2) % len(DBC)
        frame2 = DBC[idx2]
        _can_log.append(
            {
                "t": int(time.time() * 1000),
                "id": frame2["id"],
                "name": frame2["name"],
                "dir": frame2["dir"],
                "fields": _dbc_fields(idx2),
                "bytes": [random.randint(0, 255) for _ in range(8)],
            }
        )
    while len(_can_log) > _CAN_MAX:
        _can_log.pop(0)


def snapshot() -> dict:
    return {
        "now": {
            "V": round(_v_nom, 4),
            "I": round(_i_nom, 4),
            "SoC": round(_soc, 2),
            "T": round(_temp, 2),
            "P": round(_v_nom * _i_nom, 4),
        },
        # Send last 600 samples as flat arrays (compact)
        "V": [round(x, 4) for x in _V],
        "I": [round(x, 4) for x in _I],
        "SoC": [round(x, 3) for x in _SoC],
        "T": [round(x, 3) for x in _T],
        "canLog": _can_log[-50:],  # last 50 frames
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------
_clients: set[WebSocket] = set()


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    _clients.add(websocket)
    try:
        # Send current state immediately on connect
        await websocket.send_text(json.dumps(snapshot()))
        while True:
            # Wait for the client to send anything (keep-alive ping) or just hold
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=0.5)
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        _clients.discard(websocket)


async def _ticker():
    while True:
        await asyncio.sleep(1 / HZ)
        step()
        if _clients:
            msg = json.dumps(snapshot())
            dead = set()
            for ws in list(_clients):
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.add(ws)
            _clients -= dead


@app.on_event("startup")
async def startup():
    asyncio.create_task(_ticker())


@app.get("/")
def root():
    return {
        "title": "THOR BMS API",
        "ws": "ws://localhost:8000/ws",
        "hz": HZ,
        "history_sec": HISTORY_SEC,
    }
