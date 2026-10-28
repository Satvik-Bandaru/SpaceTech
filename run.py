"""Run a conceptual satellite reliability scenario; Python standard library only."""
import argparse
import json
from pathlib import Path

from spacecraft_lab.simulator import config_from_dict, run


def main():
    parser = argparse.ArgumentParser(description="Spacecraft Reliability & Autonomy Lab")
    parser.add_argument("scenario", type=Path, help="Input JSON scenario")
    parser.add_argument("--out", type=Path, default=None, help="Optional JSON report output path")
    args = parser.parse_args()
    scenario = json.loads(args.scenario.read_text(encoding="utf-8"))
    cfg = config_from_dict(scenario)
    result = run(cfg, name=scenario.get("name", args.scenario.stem))
    print(json.dumps({"name": result["name"], "metrics": result["metrics"], "events": result["events"]}, indent=2))
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
