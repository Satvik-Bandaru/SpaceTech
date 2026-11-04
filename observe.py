"""Reproducible offline synthetic observation report. No instruments are connected."""
import argparse
import json
from pathlib import Path

from spacecraft_lab.io import load_json, write_json
from spacecraft_lab.observatory import run_observatory


def main():
    parser = argparse.ArgumentParser(description='Five-agent Discovery Observatory — SYNTHETIC')
    parser.add_argument('config', type=Path)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        report = run_observatory(load_json(args.config))
        write_json(args.out, report)
    except (OSError, ValueError, TypeError, KeyError, RecursionError) as exc:
        parser.error(f'Observation mission refused: {exc}')
    print(json.dumps({'run_id': report['run_id'], 'metrics': report['metrics']}, indent=2, allow_nan=False))
    print(f'SYNTHETIC evidence report written to {args.out}')


if __name__ == '__main__':
    main()
