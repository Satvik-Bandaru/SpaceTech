"""Optional local health contract 2.0. Independent of the preserved v1.0 adapter."""
import copy

from .integration import _require_id
from .reliability import fingerprint, STRATEGIES, run_strategy
from .engineering.config import engineering_config


def export_health(report,mission_id,asset_id):
    _require_id(mission_id,'mission_id');_require_id(asset_id,'asset_id')
    if (not isinstance(report,dict) or report.get('schema_version')!='research-2.0'
        or report.get('strategy') not in STRATEGIES or report.get('data_provenance')!='SYNTHETIC'
        or report.get('model_validated_for_flight') is not False):
        raise ValueError('Expected synthetic research-2.0 report')
    cfg=engineering_config(report['config'])
    if len(report['telemetry'])!=cfg.duration_seconds//cfg.dt_seconds:
        raise ValueError('Telemetry length mismatch')
    # Current-model interoperability requires reproducible semantics, not just a rehashable envelope.
    reference=run_strategy(report['config'],report['strategy'])
    if fingerprint(report)!=fingerprint(reference):
        raise ValueError('Report does not match deterministic current-model replay')
    health=[{k:r[k] for k in ('time_seconds','battery_wh','battery_pct','temperature_k','solar_w','served_w','unserved_w','comms_up','operating_mode')} for r in report['telemetry']]
    events=[dict(event_id='evt-'+fingerprint(dict(run_id=report['run_id'],index=i,event=e))[:24],**e) for i,e in enumerate(report['events'])]
    packet=dict(schema_version='2.0',source='spacecraft-reliability-lab',target='lunar-ops',mission_id=mission_id,asset_id=asset_id,
        run_id=report['run_id'],data_provenance='SYNTHETIC',model_validated_for_flight=False,advisory_only=True,
        health=health,events=events,mode_transitions=report['operational_transitions'],recovery_outcomes=report['actions'],
        mission_status=report['research_metrics']['mission_success'],report=copy.deepcopy(report))
    packet['packet_sha256']=fingerprint(packet)
    return packet


def validate_health(packet):
    if not isinstance(packet,dict):raise ValueError('Health packet must be an object')
    try:
        expected=export_health(packet['report'],packet['mission_id'],packet['asset_id'])
        if packet!=expected:raise ValueError('Health schema/content/fingerprint mismatch')
    except (KeyError,TypeError,OverflowError) as exc:
        raise ValueError('Invalid health contract') from exc
    return packet
