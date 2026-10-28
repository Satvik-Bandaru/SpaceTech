"""Offline mission-contract exchange for Lunar Ops; intentionally no network calls."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from spacecraft_lab.integration import run_mission


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Lunar Ops spacecraft reliability request offline")
    parser.add_argument("request", type=Path, help="Lunar Ops mission JSON conforming to integration v1.0")
    parser.add_argument("--out", type=Path, required=True, help="Output result JSON path for Lunar Ops import")
    args = parser.parse_args()
    try:
        payload = json.loads(args.request.read_text(encoding="utf-8"))
        response = run_mission(payload)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        parser.error(f"Mission refused: {exc}")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(response, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(f"{response['result_status']} {response['run_id']} -> {args.out}")


if __name__ == "__main__":
    main()
