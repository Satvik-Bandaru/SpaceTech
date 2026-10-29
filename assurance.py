"""Explicitly approved, local mission-assurance experiments and durable records."""
import argparse
import json
from pathlib import Path

from spacecraft_lab.assurance.workflow import WorkflowStore
from spacecraft_lab.io import load_json,write_json


def main():
    p=argparse.ArgumentParser(description='Simulation-only mission assurance; no external tools')
    p.add_argument('--store',type=Path,default=Path(__file__).resolve().parent/'artifacts'/'assurance.sqlite')
    commands=p.add_subparsers(dest='command',required=True)
    run=commands.add_parser('prepare');run.add_argument('scenario',type=Path);run.add_argument('--probe-unsafe',action='store_true')
    approve=commands.add_parser('approve');approve.add_argument('job_id');approve.add_argument('--digest',required=True)
    status=commands.add_parser('status');status.add_argument('job_id')
    cancel=commands.add_parser('cancel');cancel.add_argument('job_id')
    export=commands.add_parser('export');export.add_argument('job_id');export.add_argument('--out',type=Path,required=True)
    a=p.parse_args();store=None
    try:
        store=WorkflowStore(a.store)
        if a.command=='prepare':r=store.prepare(load_json(a.scenario),{'probe_unsafe':a.probe_unsafe})
        elif a.command=='approve':r=store.approve(a.job_id,a.digest,background=False)
        elif a.command=='cancel':r=store.cancel(a.job_id)
        else:r=store.get(a.job_id,include_result=a.command=='export')
        if a.command=='export':
            if r['status']!='COMPLETE':raise ValueError('No complete result to export')
            write_json(a.out,r['result']);r={k:v for k,v in r.items() if k!='result'}
        print(json.dumps(r,indent=2,allow_nan=False))
    except (OSError,ValueError,TypeError,KeyError,OverflowError,RecursionError) as exc:p.error(str(exc))
    finally:
        if store:store.close()


if __name__=='__main__':main()
