"""Paired model/controller study plus identical-telemetry diagnostic replay."""
import argparse
import json
from pathlib import Path

from spacecraft_lab.engineering.benchmarks import paired_benchmark
from spacecraft_lab.io import load_json,write_json


def main():
    parser=argparse.ArgumentParser(description='Reproducible synthetic engineering benchmark')
    parser.add_argument('scenario',type=Path)
    parser.add_argument('--seeds',type=int,nargs='+',default=[0,1,2,3,4])
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    try:
        result=paired_benchmark(load_json(args.scenario),args.seeds)
        if any(run[p]['violations'] for run in result['runs'] for p in ('baseline','assisted')):
            raise ValueError('Engineering invariant checks failed')
        write_json(args.out,result)
    except (OSError,ValueError,TypeError,KeyError,RecursionError) as exc:
        parser.error(f'Benchmark refused: {exc}')
    print(json.dumps(result['diagnostic_replay_summary'],indent=2,allow_nan=False))
    print(f'SYNTHETIC paired report written to {args.out}')


if __name__=='__main__':main()
