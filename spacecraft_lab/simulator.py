"""Deterministic, simplified small-satellite systems and FDIR simulation.

This is an educational engineering prototype, not a physically validated model.
It is NOT suitable for real spacecraft operations or safety-critical decisions.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any
import math
import random

VALID_FAULTS = {"eclipse", "load_spike", "comms_loss", "attitude_fault", "thermal_spike"}


@dataclass(frozen=True)
class Fault:
    kind: str
    start_minute: int
    duration_minutes: int
    severity: float = 1.0

    def active(self, minute: int) -> bool:
        return self.start_minute <= minute < self.start_minute + self.duration_minutes


@dataclass(frozen=True)
class Config:
    duration_minutes: int = 120
    seed: int = 42
    battery_capacity_wh: float = 500.0
    initial_battery_wh: float = 350.0
    normal_load_w: float = 120.0
    safe_load_w: float = 60.0
    solar_generation_w: float = 150.0
    initial_temp_c: float = 23.0
    ambient_temp_c: float = 15.0
    heat_gain_c_per_min_at_100w: float = 0.018
    cooling_factor_per_min: float = 0.012
    temp_limit_c: float = 45.0
    sensor_noise_c: float = 0.0
    faults: tuple[Fault, ...] = ()


def config_from_dict(data: dict[str, Any]) -> Config:
    if not isinstance(data, dict):
        raise ValueError("Scenario must be a JSON object")
    keys = Config.__dataclass_fields__.keys()
    unknown = set(data) - set(keys) - {"name", "description"}
    if unknown:
        raise ValueError(f"Unknown scenario keys: {sorted(unknown)}")
    raw_faults = data.get("faults", [])
    if not isinstance(raw_faults, list):
        raise ValueError("faults must be an array")
    faults = []
    for f in raw_faults:
        if not isinstance(f, dict) or set(f) - {"kind", "start_minute", "duration_minutes", "severity"}:
            raise ValueError("Fault has invalid structure or unknown fields")
        fault = Fault(**f)
        if fault.kind not in VALID_FAULTS:
            raise ValueError(f"Unsupported fault: {fault.kind}")
        if not isinstance(fault.start_minute, int) or fault.start_minute < 0:
            raise ValueError("Fault start_minute must be a nonnegative integer")
        if not isinstance(fault.duration_minutes, int) or fault.duration_minutes < 1:
            raise ValueError("Fault duration_minutes must be a positive integer")
        if not isinstance(fault.severity, (int, float)) or not math.isfinite(fault.severity) or fault.severity < 0:
            raise ValueError("Fault severity must be finite and nonnegative")
        faults.append(fault)
    cfg = Config(**{k: v for k, v in data.items() if k in keys and k != "faults"}, faults=tuple(faults))
    if type(cfg.duration_minutes) is not int or not 1 <= cfg.duration_minutes <= 1440:
        raise ValueError("duration_minutes must be between 1 and 1440")
    if type(cfg.seed) is not int:
        raise ValueError("seed must be an integer")
    numeric = {k: getattr(cfg, k) for k in keys if k not in ("duration_minutes", "seed", "faults")}
    if any(type(v) not in (float, int) or not math.isfinite(v) for v in numeric.values()):
        raise ValueError("All numeric spacecraft parameters must be finite")
    if cfg.battery_capacity_wh <= 0 or not 0 <= cfg.initial_battery_wh <= cfg.battery_capacity_wh:
        raise ValueError("Battery initial state must be within its positive capacity")
    if cfg.normal_load_w < 0 or cfg.safe_load_w < 0 or cfg.safe_load_w > cfg.normal_load_w:
        raise ValueError("Safe load must be nonnegative and at most the normal load")
    if cfg.solar_generation_w < 0 or cfg.cooling_factor_per_min < 0 or cfg.heat_gain_c_per_min_at_100w < 0 or cfg.sensor_noise_c < 0:
        raise ValueError("Generation, cooling, heating and noise cannot be negative")
    for fault in cfg.faults:
        if fault.start_minute >= cfg.duration_minutes:
            raise ValueError("Fault starts beyond the scenario horizon")
    return cfg


def run(config: Config, name: str = "spacecraft test") -> dict[str, Any]:
    """Run a minute-step conceptual model using a seeded sensor noise generator.

    FDIR uses thermal, attitude, and battery thresholds. Comms-loss is reported
    as a warning after 3 consecutive disconnected minutes, but doesn't directly
    trigger safe mode. This model has no orbital or environmental physics.
    """
    rng = random.Random(config.seed)
    battery = config.initial_battery_wh
    temp_c = config.initial_temp_c
    mode = "normal"
    stable_minutes = 0
    lost_comms_minutes = 0
    events: list[dict[str, Any]] = []
    telemetry: list[dict[str, Any]] = []
    for minute in range(config.duration_minutes):
        active = [f for f in config.faults if f.active(minute)]
        solar_w = config.solar_generation_w
        load_spike_w = 0.0
        comms_up = True
        attitude_ok = True
        thermal_spike_c = 0.0
        for fault in active:
            if fault.kind == "eclipse":
                solar_w = 0.0
            elif fault.kind == "load_spike":
                load_spike_w += 90.0 * fault.severity
            elif fault.kind == "comms_loss":
                comms_up = False
            elif fault.kind == "attitude_fault":
                attitude_ok = False
            elif fault.kind == "thermal_spike":
                thermal_spike_c += 0.15 * fault.severity
        sensed_temp = temp_c + (rng.gauss(0, config.sensor_noise_c) if config.sensor_noise_c else 0.0)
        battery_pct = battery / config.battery_capacity_wh * 100.0
        reasons = []
        if battery_pct < 25.0:
            reasons.append("LOW_BATTERY")
        if sensed_temp > config.temp_limit_c:
            reasons.append("HIGH_TEMP")
        if not attitude_ok:
            reasons.append("ATTITUDE_FAULT")
        if reasons:
            stable_minutes = 0
            if mode != "safe":
                mode = "safe"
                events.append({"minute": minute, "event": "ENTER_SAFE_MODE", "reasons": reasons})
        elif mode == "safe":
            if battery_pct >= 40.0 and sensed_temp <= config.temp_limit_c - 5 and attitude_ok:
                stable_minutes += 1
                if stable_minutes >= 5:
                    mode = "normal"
                    stable_minutes = 0
                    events.append({"minute": minute, "event": "RETURN_TO_NORMAL"})
            else:
                stable_minutes = 0
        lost_comms_minutes = lost_comms_minutes + 1 if not comms_up else 0
        if lost_comms_minutes == 3:
            events.append({"minute": minute, "event": "COMMS_LOSS_DETECTED"})
        load_w = (config.safe_load_w if mode == "safe" else config.normal_load_w) + load_spike_w
        battery = max(0.0, min(config.battery_capacity_wh, battery + (solar_w - load_w) / 60.0))
        temp_c += config.heat_gain_c_per_min_at_100w * load_w / 100.0 - config.cooling_factor_per_min * (temp_c - config.ambient_temp_c) + thermal_spike_c
        telemetry.append({
            "minute": minute,
            "mode": mode,
            "battery_wh": round(battery, 3),
            "battery_pct": round(100 * battery / config.battery_capacity_wh, 2),
            "temperature_c": round(temp_c, 3),
            "solar_w": round(solar_w, 2),
            "load_w": round(load_w, 2),
            "comms_up": comms_up,
            "attitude_ok": attitude_ok,
            "active_faults": [f.kind for f in active],
        })
    safe_steps = sum(row["mode"] == "safe" for row in telemetry)
    comms_up_steps = sum(row["comms_up"] for row in telemetry)
    operational_steps = sum(row["mode"] == "normal" and row["comms_up"] and row["battery_pct"] > 0 for row in telemetry)
    result = {
        "name": name,
        "disclaimer": "Simplified deterministic educational model; not validated spacecraft flight software.",
        "config": asdict(config),
        "metrics": {
            "safe_mode_minutes": safe_steps,
            "comms_availability_pct": round(100 * comms_up_steps / config.duration_minutes, 2),
            "normal_operational_pct": round(100 * operational_steps / config.duration_minutes, 2),
            "min_battery_pct": min(row["battery_pct"] for row in telemetry),
            "max_temperature_c": max(row["temperature_c"] for row in telemetry),
            "event_count": len(events),
        },
        "events": events,
        "telemetry": telemetry,
    }
    return result
