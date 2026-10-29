"""Optional offline reader for current-model advisory health packets. No mission mutations."""
import argparse
import json
from pathlib import Path

from spacecraft_lab.health_exchange import validate_health
from spacecraft_lab.io import _unique, _constant


def read_health(path):
    with Path(path).open('rb') as stream:
        raw=stream.read(32000001)
    if len(raw)>32000000:raise ValueError('Health packet exceeds 32 MB')
    return validate_health(json.loads(raw,object_pairs_hook=_unique,parse_constant=_constant))


def main():
    p=argparse.ArgumentParser(description='Validate/read a local synthetic health v2 packet')
    p.add_argument('packet',type=Path);a=p.parse_args()
    try:r=read_health(a.packet)
    except (OSError,ValueError,TypeError,KeyError,OverflowError,RecursionError) as exc:p.error(str(exc))
    print(json.dumps({k:r[k] for k in ('schema_version','mission_id','asset_id','run_id','advisory_only','mission_status')},indent=2))


if __name__=='__main__':main()
