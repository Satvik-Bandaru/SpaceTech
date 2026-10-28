"""Versioned, offline Lunar Ops <-> Spacecraft Reliability Lab handoff.

This adapter implements exchange of synthetic simulation JSON, NOT a live link
or validated lunar mission dynamics. No network or hardware actions occur.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from typing import Any

from .simulator import config_from_dict, run

CONTRACT_VERSION = "1.0"
SOURCE = "lunar-ops"
TARGET = "spacecraft-reliability-lab"
MODEL_VERSION = "spacecraft-conceptual-v0.1"
ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")


@dataclass(frozen=True)
class MissionRequest:
    mission_id: str
    scenario: dict[str, Any]
    asset_id: str
    asset_type: str
    simulation_id: str


def _require_id(value: Any, field: str) -> str:
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise ValueError(f"{field} must be a nonempty safe identifier (max 128 chars)")
    return value


def read_mission(payload: dict[str, Any]) -> MissionRequest:
    """Reject unknown input fields and identity/authority overrides."""
    if not isinstance(payload, dict):
        raise ValueError("Mission payload must be a JSON object")
    allowed = {"schema_version", "mission_id", "source", "target", "scenario", "context"}
    if set(payload) - allowed:
        raise ValueError(f"Unexpected mission fields: {sorted(set(payload) - allowed)}")
    if payload.get("schema_version") != CONTRACT_VERSION:
        raise ValueError("Unsupported schema_version; expected 1.0")
    if payload.get("source") != SOURCE or payload.get("target") != TARGET:
        raise ValueError("Invalid source/target for this adapter")
    mission_id = _require_id(payload.get("mission_id"), "mission_id")
    context = payload.get("context")
    if not isinstance(context, dict) or set(context) - {"asset_id", "asset_type", "simulation_id"}:
        raise ValueError("context must contain only asset_id, asset_type and simulation_id")
    asset_id = _require_id(context.get("asset_id"), "context.asset_id")
    asset_type = context.get("asset_type")
    if asset_type not in ("orbital_relay", "small_satellite", "lunar_orbital_asset"):
        raise ValueError("This conceptual model supports orbital relays and small satellites, not rover or colony physics")
    simulation_id = _require_id(context.get("simulation_id"), "context.simulation_id")
    scenario = payload.get("scenario")
    if not isinstance(scenario, dict):
        raise ValueError("scenario must be an object")
    faults = scenario.get("faults", [])
    if isinstance(faults, list) and len(faults) > 100:
        raise ValueError("No more than 100 faults per scenario")
    config_from_dict(scenario)  # fail closed on unknown inputs/invalid numbers and units
    return MissionRequest(mission_id, scenario, asset_id, asset_type, simulation_id)


def run_mission(payload: dict[str, Any]) -> dict[str, Any]:
    """Run one request deterministically and return a Lunar Ops-readable result."""
    request = read_mission(payload)
    scenario = request.scenario
    config = config_from_dict(scenario)
    report = run(config, name=scenario.get("name", request.simulation_id))
    canonical_request = json.dumps(payload, sort_keys=True, separators=(",", ":"), allow_nan=False)
    fingerprint = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    run_id = f"sim-{fingerprint[:20]}"
    # These are advisory warnings only. No command or live mission change is made.
    warnings = []
    if report["metrics"]["safe_mode_minutes"]:
        warnings.append("SYNTHETIC_SAFE_MODE_OCCURRED")
    if report["metrics"]["comms_availability_pct"] < 100:
        warnings.append("SYNTHETIC_COMMS_INTERRUPTION")
    return {
        "schema_version": CONTRACT_VERSION,
        "mission_id": request.mission_id,
        "simulation_id": request.simulation_id,
        "run_id": run_id,
        "request_sha256": fingerprint,
        "source": TARGET,
        "target": SOURCE,
        "asset_id": request.asset_id,
        "asset_type": request.asset_type,
        "result_status": "COMPLETED",
        "data_provenance": "SYNTHETIC",
        "model_version": MODEL_VERSION,
        "model_validated_for_flight": False,
        "metrics": report["metrics"],
        "advisory_flags": warnings,
        "events": report["events"],
        "telemetry": report["telemetry"],
        "disclaimer": report["disclaimer"],
    }
