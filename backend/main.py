"""
THOR BMS Dashboard — FastAPI backend.

Reads real BMS telemetry from a UART serial port (default COM4 @ 115200) and
streams it to the frontend at 10 Hz via a WebSocket (/ws).

Wire protocol — one ASCII line per sample:
    CSV,<time_ms>,<V>,<I>,<SoC_ekf>,<SoC_real>
    CSV,84183,4.1294,-0.5000,0.8930,0.9926

Where:
    time_ms     BMS uptime in milliseconds (integer)
    V           cell voltage, volts
    I           cell current, amperes (negative = discharging)
    SoC_ekf     state of charge estimate from EKF, fraction 0.0-1.0
    SoC_real    "true" state of charge (e.g. coulomb-counted), fraction 0.0-1.0

The SoC fractions are converted to percent (×100) to match the dashboard.
Temperature is not sent by the BMS; it's held at a fixed placeholder (25°C).

Configuration via environment variables:
    BMS_SERIAL_PORT     default 'COM4' on Windows, '/dev/ttyUSB0' on Linux
    BMS_SERIAL_BAUD     default 115200
    BMS_MODE            'auto' (try serial, fall back to sim) | 'sim' | 'real'

Run:
    # Windows cmd
    set BMS_SERIAL_PORT=COM4 && uvicorn main:app --reload --port 8000
    # Windows PowerShell
    $env:BMS_SERIAL_PORT='COM4'; uvicorn main:app --reload --port 8000
    # Linux / WSL (after usbipd)
    BMS_SERIAL_PORT=/dev/ttyUSB0 uvicorn main:app --reload --port 8000
"""

import asyncio
import json
import logging
import math
import os
import random
import sys
import threading
import time
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

try:
    import serial  # pyserial
except ImportError:  # pragma: no cover
    serial = None  # type: ignore

# ---------------------------------------------------------------------------
# Logging — one-line format with time, level, subsystem, message.
# Subsystems: bms.serial (UART I/O), bms.parse (CSV parsing), bms.ws
# (WebSocket clients), bms.sim (simulator fallback).
#
# Default level is INFO. Set BMS_LOG_LEVEL=DEBUG to also see every raw UART
# line and every parsed sample (otherwise we log a 1 Hz summary instead).
# ---------------------------------------------------------------------------
LOG_LEVEL = os.environ.get("BMS_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s.%(msecs)03d [%(levelname)-5s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log_serial = logging.getLogger("bms.serial")
log_parse = logging.getLogger("bms.parse")
log_ws = logging.getLogger("bms.ws")
log_sim = logging.getLogger("bms.sim")

app = FastAPI(title="THOR BMS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEFAULT_PORT = "COM4" if sys.platform.startswith("win") else "/dev/ttyUSB0"
SERIAL_PORT = os.environ.get("BMS_SERIAL_PORT", DEFAULT_PORT)
SERIAL_BAUD = int(os.environ.get("BMS_SERIAL_BAUD", "115200"))
MODE = os.environ.get("BMS_MODE", "auto").lower()  # auto | sim | real

HISTORY_SEC = 60
HZ = 10
N = HISTORY_SEC * HZ  # 600 samples

# ---------------------------------------------------------------------------
# Shared state (updated by either the serial reader thread or the simulator)
# ---------------------------------------------------------------------------
_V = [0.0] * N
_I = [0.0] * N
_SoC = [0.0] * N       # EKF estimate, percent
_SoC_real = [0.0] * N  # ground-truth from BMS, percent
_T = [0.0] * N
_P = [0.0] * N

_soc = 67.4          # percent (EKF estimate)
_v_nom = 3.74        # volts
_i_nom = -1.8        # amperes
_temp = 25.0         # °C (placeholder — BMS does not send this)
_soc_real = 67.4     # percent, ground-truth from BMS
_bms_uptime_ms = 0   # latest uptime reported by BMS
_tick = 0

# Count raw UART lines received since boot — used for periodic log summary
_rx_count = 0
_rx_bad = 0

_source = "sim"          # "sim" | "serial"
_serial_connected = False
_serial_err: str | None = None

# ---------------------------------------------------------------------------
# CAN frame log — synthetic, mirrors whatever current measurements are held.
# (The real BMS doesn't send CAN frames over UART, but the dashboard shows
# decoded frames; we synthesize them from the live values so the CAN view
# reflects the real data instead of being empty.)
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Pre-fill 60 s of history with a plausible shape so the charts aren't empty
# on first paint.
# ---------------------------------------------------------------------------
for _i in range(N):
    _ph = (_i / N) * math.pi * 2
    _iV = -1.8 + math.sin(_ph * 3) * 1.2 + math.sin(_ph * 7) * 0.3
    _vV = 3.74 + math.sin(_ph * 2) * 0.08 - _iV * 0.02
    _V[_i] = _vV
    _I[_i] = _iV
    _SoC[_i] = 68.0 - (_i / N) * 1.2
    _SoC_real[_i] = 68.0 - (_i / N) * 1.1  # slight offset to make the two curves visible
    _T[_i] = _temp
    _P[_i] = _vV * _iV


# ---------------------------------------------------------------------------
# Simulator — used when the serial port isn't available
# ---------------------------------------------------------------------------
def _sim_step() -> None:
    """Advance the simulated BMS state by one tick."""
    global _v_nom, _i_nom, _soc, _soc_real, _temp
    ph = _tick / HZ
    _i_nom = (
        -1.8
        + math.sin(ph * 0.6) * 1.4
        + math.sin(ph * 2.1) * 0.5
        + (random.random() - 0.5) * 0.15
    )
    _soc = max(0.0, min(100.0, _soc + _i_nom * 0.0008))
    # Simulated "real" SoC drifts slightly from EKF so the two curves are
    # visibly distinct on the dashboard.
    _soc_real = max(
        0.0, min(100.0, _soc + 0.6 + math.sin(ph * 0.3) * 0.3)
    )
    ocv = 3.40 + _soc * 0.008 + max(0, _soc - 60) * 0.002
    _v_nom = ocv + _i_nom * 0.022 + (random.random() - 0.5) * 0.004
    _temp += (28.5 + abs(_i_nom) * 0.3 - _temp) * 0.02 + (random.random() - 0.5) * 0.05


# ---------------------------------------------------------------------------
# Serial reader — runs in a background thread.
#
# Opens the port, reads lines, updates shared current values (_v_nom, _i_nom,
# _soc). The 10 Hz ticker will sample these into the buffer. If the port
# drops or can't be opened, sets _serial_connected = False and retries every
# 2 seconds so a hot-plug works without restarting the backend.
# ---------------------------------------------------------------------------
def _parse_csv_line(line: str) -> bool:
    """Parse one `CSV,...` line and update globals. Returns True on success."""
    global _v_nom, _i_nom, _soc, _soc_real, _bms_uptime_ms, _rx_bad
    if not line:
        return False
    if not line.startswith("CSV"):
        log_parse.warning("skipped non-CSV line: %r", line[:80])
        _rx_bad += 1
        return False
    parts = line.split(",")
    if len(parts) < 6 or parts[0] != "CSV":
        log_parse.warning("malformed (got %d fields): %r", len(parts), line[:80])
        _rx_bad += 1
        return False
    try:
        _bms_uptime_ms = int(parts[1])
        _v_nom = float(parts[2])
        _i_nom = float(parts[3])
        _soc = max(0.0, min(100.0, float(parts[4]) * 100.0))
        _soc_real = max(0.0, min(100.0, float(parts[5]) * 100.0))
        log_parse.debug(
            "t=%dms V=%.4f I=%.4f SoC_ekf=%.2f%% SoC_real=%.2f%%",
            _bms_uptime_ms, _v_nom, _i_nom, _soc, _soc_real,
        )
        return True
    except (ValueError, IndexError) as e:
        log_parse.warning("parse error %s in %r", e, line[:80])
        _rx_bad += 1
        return False


def _serial_loop() -> None:
    """Blocking read loop. Runs in its own daemon thread."""
    global _serial_connected, _serial_err, _source, _rx_count
    if serial is None:
        _serial_err = "pyserial is not installed"
        log_serial.error("%s — running simulator instead", _serial_err)
        return

    while True:
        try:
            log_serial.info("opening %s @ %d …", SERIAL_PORT, SERIAL_BAUD)
            with serial.Serial(
                SERIAL_PORT, SERIAL_BAUD, timeout=1.0
            ) as ser:
                _serial_connected = True
                _serial_err = None
                _source = "serial"
                log_serial.info("connected on %s — reading lines", SERIAL_PORT)
                last_summary = time.monotonic()
                samples_since_summary = 0
                while True:
                    raw = ser.readline()
                    if not raw:
                        # timeout — no data in 1 s, warn if it persists
                        if time.monotonic() - last_summary > 3:
                            log_serial.warning(
                                "no data received in the last %.1fs",
                                time.monotonic() - last_summary,
                            )
                            last_summary = time.monotonic()
                        continue
                    try:
                        line = raw.decode("utf-8", errors="ignore").strip()
                    except Exception as e:
                        log_serial.debug("decode error: %s (%d bytes)", e, len(raw))
                        continue
                    log_serial.debug("rx: %r", line)
                    if _parse_csv_line(line):
                        _rx_count += 1
                        samples_since_summary += 1
                    # Periodic INFO summary — keeps the console informative
                    # without flooding it at 10 Hz
                    now = time.monotonic()
                    if now - last_summary >= 1.0:
                        log_serial.info(
                            "%d samples/s | V=%.3fV I=%+.3fA SoC_ekf=%.1f%% "
                            "SoC_real=%.1f%% t_bms=%dms | total=%d bad=%d",
                            samples_since_summary, _v_nom, _i_nom, _soc,
                            _soc_real, _bms_uptime_ms, _rx_count, _rx_bad,
                        )
                        samples_since_summary = 0
                        last_summary = now
        except (OSError, serial.SerialException) as e:
            was_connected = _serial_connected
            _serial_connected = False
            _serial_err = str(e)
            _source = "sim"
            if was_connected:
                log_serial.error("disconnected: %s", e)
            else:
                log_serial.warning("cannot open: %s — retrying in 2 s", e)
            time.sleep(2)
        except Exception as e:
            _serial_connected = False
            _serial_err = f"unexpected: {e}"
            _source = "sim"
            log_serial.exception("unexpected error — retrying in 2 s")
            time.sleep(2)


def _start_serial_thread() -> None:
    t = threading.Thread(target=_serial_loop, name="bms-serial", daemon=True)
    t.start()


# ---------------------------------------------------------------------------
# 10 Hz tick — advance buffers, emit synthetic CAN frames, broadcast.
# ---------------------------------------------------------------------------
def _advance() -> None:
    """Shift 60 s buffers left by one and append the current sample."""
    for k in range(N - 1):
        _V[k] = _V[k + 1]
        _I[k] = _I[k + 1]
        _SoC[k] = _SoC[k + 1]
        _SoC_real[k] = _SoC_real[k + 1]
        _T[k] = _T[k + 1]
        _P[k] = _P[k + 1]
    _V[N - 1] = _v_nom
    _I[N - 1] = _i_nom
    _SoC[N - 1] = _soc
    _SoC_real[N - 1] = _soc_real
    _T[N - 1] = _temp
    _P[N - 1] = _v_nom * _i_nom


def step() -> None:
    """One 10 Hz tick: update values, shift buffers, emit CAN frames."""
    global _tick
    _tick += 1

    if _source == "sim":
        _sim_step()
    # else: _v_nom / _i_nom / _soc already updated by the serial thread

    _advance()

    # Synthesize CAN frames from current values so the CAN bus view has data
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
        "V": [round(x, 4) for x in _V],
        "I": [round(x, 4) for x in _I],
        "SoC": [round(x, 3) for x in _SoC],
        "SoC_real": [round(x, 3) for x in _SoC_real],
        "T": [round(x, 3) for x in _T],
        "canLog": _can_log[-50:],
        # Status telemetry (shown in the sidebar / status line)
        "status": {
            "source": _source,
            "connected": _serial_connected,
            "port": SERIAL_PORT,
            "baud": SERIAL_BAUD,
            "error": _serial_err,
            "bms_uptime_ms": _bms_uptime_ms,
            "soc_real": round(_soc_real, 2),
        },
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------
_clients: set[WebSocket] = set()


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    _clients.add(websocket)
    peer = f"{websocket.client.host}:{websocket.client.port}" if websocket.client else "?"
    log_ws.info("client connected (%s) — %d total", peer, len(_clients))
    try:
        await websocket.send_text(json.dumps(snapshot()))
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=0.5)
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        _clients.discard(websocket)
        log_ws.info("client disconnected (%s) — %d remaining", peer, len(_clients))


async def _ticker():
    global _clients
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
    logging.getLogger("bms").info(
        "starting up — mode=%s port=%s baud=%d hz=%d log_level=%s",
        MODE, SERIAL_PORT, SERIAL_BAUD, HZ, LOG_LEVEL,
    )
    if MODE != "sim":
        _start_serial_thread()
    else:
        log_sim.info("BMS_MODE=sim — not opening serial, running simulator")
    asyncio.create_task(_ticker())


@app.get("/")
def root():
    return {
        "title": "THOR BMS API",
        "ws": "ws://localhost:8000/ws",
        "hz": HZ,
        "history_sec": HISTORY_SEC,
        "source": _source,
        "serial": {
            "port": SERIAL_PORT,
            "baud": SERIAL_BAUD,
            "connected": _serial_connected,
            "error": _serial_err,
        },
    }
