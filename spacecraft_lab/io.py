"""Bounded offline JSON I/O. No network activity or automatic cross-project access."""
import json

MAX_INPUT_BYTES=256000


def _unique(pairs):
    out={}
    for key,value in pairs:
        if key in out:raise ValueError(f'Duplicate JSON field: {key}')
        out[key]=value
    return out


def _constant(value):
    raise ValueError(f'Nonfinite JSON constant is not allowed: {value}')


def load_json(path):
    with open(path,'rb') as stream:
        data=stream.read(MAX_INPUT_BYTES+1)
    if len(data)>MAX_INPUT_BYTES:
        raise ValueError(f'Input exceeds {MAX_INPUT_BYTES} bytes')
    return json.loads(data.decode('utf-8'),object_pairs_hook=_unique,parse_constant=_constant)


def write_json(path,value):
    text=json.dumps(value,indent=2,allow_nan=False)+'\n'
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(text,encoding='utf-8')
