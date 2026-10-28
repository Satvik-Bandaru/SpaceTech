"""Offline mission-contract exchange for Lunar Ops; intentionally no network calls."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from spacecraft_lab.integration import run_mission
from spacecraft_lab.io import load_json


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Lunar Ops spacecraft reliability request offline")
    parser.add_argument("request", type=Path, help="Lunar Ops mission JSON conforming to integration v1.0")
    parser.add_argument("--out", type=Path, required=True, help="Output result JSON path for Lunar Ops import")
    args = parser.parse_args()
    try:
        payload = load_json(args.request)
        response = run_mission(payload)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        parser.error(f"Mission refused: {exc}")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(response, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"{response['result_status']} {response['run_id']} -> {args.out}")


if __name__ == "__main__":
    main()
