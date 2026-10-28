"""Local engineering reference scenario runner; no deployment, service or spacecraft commands."""
import argparse
import json
from pathlib import Path

from spacecraft_lab.engineering.model import run_engineering
from spacecraft_lab.io import load_json,write_json


def main():
    parser=argparse.ArgumentParser(description='Spacecraft reference model v0.2 — SYNTHETIC, not flight-qualified')
    parser.add_argument('scenario',type=Path)
    parser.add_argument('--policy',choices=('baseline','assisted'),default='baseline')
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    try:
        result=run_engineering(load_json(args.scenario),args.policy)
        if result['checks']['violations']:raise ValueError('Engineering invariant checks failed')
        write_json(args.out,result)
    except (OSError,ValueError,TypeError,KeyError,RecursionError) as exc:
        parser.error(f'Simulation refused: {exc}')
    print(json.dumps(dict(run_id=result['run_id'],metrics=result['metrics'],checks=result['checks']),indent=2,allow_nan=False))
    print(f'SYNTHETIC report written to {args.out}')


if __name__=='__main__':main()
