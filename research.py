"""Local research CLI; no networking or cross-project mutation."""
import argparse
from pathlib import Path

from spacecraft_lab.io import load_json,write_json
from spacecraft_lab.reliability import run_strategy,run_study,STRATEGIES
from spacecraft_lab.health_exchange import export_health


def main():
    p=argparse.ArgumentParser(description='Synthetic spacecraft reliability research')
    p.add_argument('scenario',type=Path)
    p.add_argument('--strategy',choices=tuple(STRATEGIES),default='basic')
    p.add_argument('--seeds',nargs='+',type=int,help='Paired study instead of single run')
    p.add_argument('--mission-id',help='Export offline v2 health packet (single run only)')
    p.add_argument('--asset-id',default='reference-satellite')
    p.add_argument('--out',required=True,type=Path)
    a=p.parse_args()
    try:
        if a.seeds and a.mission_id:raise ValueError('Health exchange exports a single run, not a study')
        scenario=load_json(a.scenario)
        r=run_study(scenario,a.seeds) if a.seeds else run_strategy(scenario,a.strategy)
        if a.mission_id:r=export_health(r,a.mission_id,a.asset_id)
        write_json(a.out,r)
    except (OSError,ValueError,TypeError,KeyError,OverflowError,RecursionError) as exc:p.error(str(exc))
    print(f'SYNTHETIC {r["schema_version"]} report saved: {a.out}')


if __name__=='__main__':main()
