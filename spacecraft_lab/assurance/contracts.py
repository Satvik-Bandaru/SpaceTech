"""Finite proposal vocabulary and bounded, JSON-safe contracts."""
import hashlib
import json
import re
from pathlib import Path

ACTIONS={'ISOLATE_HEATER':'thermal','RETRY_HEATER':'thermal','SWITCH_REDUNDANT_ADCS':'attitude',
         'RESET_RADIO_ATTEMPT':'communications','REQUEST_NORMAL_MODE':'mode','REQUEST_SAFE_MODE':'mode'}
PERMISSIONS={'recovery':set(ACTIONS),'power':{'REQUEST_SAFE_MODE'},'thermal':{'ISOLATE_HEATER'},
             'diagnostic':set(),'commander':{'REQUEST_SAFE_MODE'}}
ACTUATORS={'heater_relay','adcs_backup','radio'}


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()


def validate_options(raw):
    if not isinstance(raw,dict) or set(raw)-{'max_decisions','probe_unsafe','unavailable_actuators'}:
        raise ValueError('Unknown assurance options')
    result={'max_decisions':128,'probe_unsafe':False,'unavailable_actuators':[],**raw}
    if type(result['max_decisions']) is not int or not 1<=result['max_decisions']<=256:
        raise ValueError('max_decisions must be 1–256')
    if type(result['probe_unsafe']) is not bool:raise ValueError('probe_unsafe must be Boolean')
    unavailable=result['unavailable_actuators']
    if (not isinstance(unavailable,list) or len(unavailable)>3 or any(not isinstance(a,str) or a not in ACTUATORS for a in unavailable)
        or len(set(unavailable))!=len(unavailable)):
        raise ValueError('Invalid unavailable_actuators')
    result['unavailable_actuators']=list(unavailable)
    return result


def proposal(source,action,t,reason,evidence,*,state):
    if action not in ACTIONS:raise ValueError('Unsupported simulated action')
    p=dict(schema_version='proposal-2.0',source_agent=source,action=action,target_subsystem=ACTIONS[action],
           run_id=state['run_id'],mission_state_sha256=digest(state),
           time_seconds=t,reason=reason,evidence=evidence,preconditions=['Independent kernel approval required'],
           expected_effect={'ISOLATE_HEATER':'Remove unwanted heater load','RETRY_HEATER':'Reconnect heater for a bounded trial',
             'SWITCH_REDUNDANT_ADCS':'Reduce modeled pointing error to 5 degrees','RESET_RADIO_ATTEMPT':'Reset radio; cannot repair an external blackout',
             'REQUEST_NORMAL_MODE':'Resume normal loads only after healthy dwell','REQUEST_SAFE_MODE':'Use configured safe base load'}[action],
           uncertainty='Synthetic state and approximate plant; no hardware confidence claim',risk='moderate')
    p['proposal_id']='proposal-'+digest(p)[:24]
    validate_proposal(p)
    return p


def validate_proposal(p):
    keys={'schema_version','source_agent','action','target_subsystem','time_seconds','reason','evidence','preconditions','expected_effect','uncertainty','risk','proposal_id','run_id','mission_state_sha256'}
    if not isinstance(p,dict) or set(p)!=keys or p['schema_version']!='proposal-2.0':raise ValueError('Invalid proposal fields/version')
    if p['source_agent'] not in PERMISSIONS or p['action'] not in ACTIONS or p['target_subsystem']!=ACTIONS[p['action']]:raise ValueError('Unknown agent/action/target')
    if type(p['time_seconds']) is not int or p['time_seconds']<0:raise ValueError('Invalid evidence time')
    if not isinstance(p['run_id'],str) or not re.fullmatch(r'eng-[0-9a-f]{24}',p['run_id']):raise ValueError('Invalid run identity')
    if not isinstance(p['mission_state_sha256'],str) or not re.fullmatch(r'[0-9a-f]{64}',p['mission_state_sha256']):raise ValueError('Invalid mission state fingerprint')
    for name in ('reason','expected_effect','uncertainty'):
        if not isinstance(p[name],str) or not 1<=len(p[name])<=500:raise ValueError('Invalid proposal text')
    for name in ('evidence','preconditions'):
        if not isinstance(p[name],list) or not 1<=len(p[name])<=16 or any(not isinstance(v,str) or not 1<=len(v)<=128 for v in p[name]):raise ValueError('Invalid proposal evidence/preconditions')
    if p['risk'] not in ('low','moderate','high'):raise ValueError('Invalid risk declaration')
    expected='proposal-'+digest({k:v for k,v in p.items() if k!='proposal_id'})[:24]
    if p['proposal_id']!=expected:raise ValueError('Proposal content fingerprint mismatch')
    return p


def _disk_manifest():
    root=Path(__file__).resolve().parents[1]
    paths=[*sorted((root/'engineering').glob('*.py')),*sorted((root/'assurance').glob('*.py')),root/'reliability.py']
    return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}


_LOADED_MANIFEST=_disk_manifest()


def implementation_manifest():
    if _disk_manifest()!=_LOADED_MANIFEST:
        raise ValueError('Implementation files changed since import; restart the local process before preparing or running assurance')
    return dict(_LOADED_MANIFEST)
