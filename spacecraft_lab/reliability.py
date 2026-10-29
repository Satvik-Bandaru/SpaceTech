"""Paired research on the existing plant; no hardware or external AI access."""
import hashlib
import json
import math
from pathlib import Path
from statistics import mean, stdev

from .engineering.model import run_engineering
from .engineering.config import engineering_config, FAULTS

STRATEGIES = {'none': ('baseline', False), 'basic': ('baseline', True), 'enhanced': ('assisted', True)}
ACTUATORS = {
    'ISOLATE_HEATER': ('Open heater relay to remove unwanted heater load', 'heater_isolated', True),
    'RETRY_HEATER': ('Reconnect heater after dwell and temperature-margin check', 'heater_isolated', False),
    'SWITCH_REDUNDANT_ADCS': ('Use redundant attitude actuator; target 5-degree pointing error', 'redundant_adcs', True),
    'RESET_RADIO_ATTEMPT': ('Attempt link recovery; external blackout can persist', 'comms_up', True),
}
PROTECTION = {
    'ENTER_SAFE_MODE': ('Reduce base load to the configured safe power budget', 'mode', 'safe'),
    'RETURN_TO_NORMAL': ('Restore normal base load after consecutive healthy dwell', 'mode', 'normal')}
T_CRITICAL = (0,12.706205,4.302653,3.182446,2.776445,2.570582,2.446912,2.364624,2.306004,
              2.262157,2.228139,2.200985,2.178813,2.160369,2.144787,2.13145,2.119905,
              2.109816,2.100922,2.093024,2.085963,2.079614,2.073873,2.068658,2.063899,
              2.059539,2.055529,2.051831,2.048407,2.04523)


def fingerprint(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()


def mean_interval(values):
    finite = [v for v in values if v is not None]
    if not finite:
        return dict(n=0,mean=None,sample_sd=None,ci95=None)
    n=len(finite); center=mean(finite); sd=stdev(finite) if n>1 else None
    margin=T_CRITICAL[min(n-1,29)]*sd/math.sqrt(n) if n>1 else None
    return dict(n=n,mean=center,sample_sd=sd,ci95=[center-margin,center+margin] if margin is not None else None)


def wilson_interval(successes,n):
    if type(n) is not int or n<1 or type(successes) is not int or not 0<=successes<=n:
        raise ValueError('Wilson interval needs integer successes in [0,n]')
    z=1.959963984540054; p=successes/n; denominator=1+z*z/n
    center=(p+z*z/(2*n))/denominator
    radius=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/denominator
    return [max(0,center-radius),min(1,center+radius)]


def assess_modes(rows,cfg):
    """Operational assessment of the hard supervisor, not a second plant controller."""
    failed=False;starved=0;recovery_until=0;previous='NORMAL';transitions=[]
    for row in rows:
        t=row['time_seconds'];dt=cfg['dt_seconds']
        starved=starved+dt if row['unserved_w']>1e-9 else 0
        failed=failed or starved>=300
        if failed: mode='FAILED'
        elif row['mode']=='safe': mode='SAFE_MODE'
        else:
            if previous=='SAFE_MODE': recovery_until=t+300
            if t<recovery_until:mode='RECOVERY'
            elif row['diagnosed_faults'] or not row['comms_up'] or row['battery_pct']<40:mode='DEGRADED'
            else:mode='NORMAL'
        if mode!=previous:
            transitions.append(dict(time_seconds=t,previous=previous,resulting=mode,
                evidence=dict(unserved_seconds=starved,battery_pct=row['battery_pct'],plant_mode=row['mode'],comms_up=row['comms_up']),
                explanation='Operational assessment; existing hard safety supervisor governs plant loads. FAILED latches after 300 s of any unmet demand.'))
        row['operating_mode']=mode
        row['sunlit']=(row['interval_start_seconds']%cfg['orbit_period_seconds']) < cfg['orbit_period_seconds']-cfg['eclipse_seconds']
        row['illustrative_orbit_phase_rad']=2*math.pi*(row['interval_start_seconds']%cfg['orbit_period_seconds'])/cfg['orbit_period_seconds']
        previous=mode
    return transitions


def run_strategy(scenario,strategy='basic',assurance_options=None,cancelled=None):
    if not isinstance(strategy,str) or strategy not in STRATEGIES:
        raise ValueError('Strategy must be none, basic or enhanced')
    policy,recovery=STRATEGIES[strategy]
    report=run_engineering(scenario,policy,recovery_enabled=recovery,assurance_options=assurance_options,cancelled=cancelled)
    if assurance_options is not None:report['engine_run_id']=report['run_id']
    report['engine_schema_version']=report['schema_version']; report['schema_version']='research-2.0'
    report['strategy']=strategy
    report['run_id']='research-'+fingerprint(dict(engine_run=report['run_id'],strategy=strategy,revision='2.0'))[:24]
    cfg=report['config'];rows=report['telemetry'];dt=cfg['dt_seconds']
    report['operational_transitions']=assess_modes(rows,cfg)
    actions=[];decisions=[];recovery_energy=0
    for event in report['events']:
        if event['event'] not in {**ACTUATORS,**PROTECTION}:continue
        effect,key,target={**ACTUATORS,**PROTECTION}[event['event']]
        i=event['time_seconds']//dt
        outcome_index=i+1 if event['event']=='RESET_RADIO_ATTEMPT' else i
        resulting=rows[outcome_index] if outcome_index<len(rows) else None
        previous=rows[i-1] if i>0 else None
        evidence={k:previous[k] for k in ('time_seconds','battery_pct','temperature_k','observed_residuals','diagnosed_faults')} if previous else {'initial_state':True}
        evidence['trigger_reasons']=event.get('reasons',[])
        evidence['interpretation']='Recorded predecessor state and residuals; noisy controller measurements may differ from plant values.'
        outcome='not_observed' if resulting is None else 'achieved' if resulting[key]==target else 'not_achieved'
        action=dict(time_seconds=event['time_seconds'],action=event['event'],evidence=evidence,
                    constraints=['Hard safety supervisor remains authoritative',
                                 f"Protection: SOC <25%, T outside [{cfg['low_temperature_k']},{cfg['high_temperature_k']}] K, pointing >25 degrees, link loss >=180 s, unmet power or confirmed alarms",
                                 'Recovery to normal: SOC >=40%, temperature margin 3 K, pointing <10 degrees, good link, no unmet demand or alarms continuously for 300 s',
                                 'Heater retries <=2; dwell >=300 s; sensed-temperature margin 3 K. Radio attempts <=2, >=120 s apart; injected blackout is not repairable'],
                    expected_effect=effect,resulting_state={k:resulting[k] for k in ('time_seconds','operating_mode',key)} if resulting else None,
                    outcome=outcome,outcome_definition='Immediate commanded-state effect, not a lasting repair or causal mission benefit')
        action['action_id']='action-'+fingerprint(dict(run_id=report['run_id'],index=len(decisions),action=action))[:24]
        decisions.append(action)
        if event['event'] in ACTUATORS:actions.append(action)
        if event['event']=='RESET_RADIO_ATTEMPT' and i<len(rows):
            reset_row=rows[i]
            base=cfg['safe_load_w'] if reset_row['mode']=='safe' else cfg['normal_load_w']
            recovery_energy+=min(5,max(0,reset_row['served_w']-base-cfg['radio_load_w']))*dt/3600
    report['actions']=actions
    report['autonomy_decisions']=decisions
    diagnostics=report['diagnostics'];tp=diagnostics['true_positive_samples'];fp=diagnostics['false_positive_samples'];fn=diagnostics['false_negative_samples']
    positives=sum(len(row['manifesting_faults']) for row in rows);negatives=len(rows)*len(FAULTS)-positives
    detected=[e['latency_seconds'] for e in diagnostics['episode_latencies'] if e['latency_seconds'] is not None]
    success=(report['checks']['violations']==[] and rows[-1]['battery_pct']>=20
             and report['metrics']['unserved_energy_wh']<1e-8 and report['metrics']['comms_availability_pct']>=80
             and all(cfg['low_temperature_k']<=r['temperature_k']<=cfg['high_temperature_k'] for r in rows))
    report['mission_criteria']=dict(final_battery_pct_at_least=20,comms_availability_pct_at_least=80,
        unserved_energy_wh_at_most=1e-8,temperature_limits_k=[cfg['low_temperature_k'],cfg['high_temperature_k']],
        interpretation='Research success proxy; no payload or operational mission completion model')
    report['research_metrics']={**report['metrics'], 'mission_success':int(success),
        'detection_latency_seconds':mean(detected) if detected else None,
        'false_positive_rate':fp/negatives if negatives else None,'false_negative_rate':fn/positives if positives else None,
        'immediate_action_success_rate':sum(a['outcome']=='achieved' for a in actions)/len(actions) if actions else None,
        'modeled_recovery_energy_wh':recovery_energy,'load_energy_served_wh':sum(r['served_w'] for r in rows)*dt/3600}
    report['strategy_limitations']='none disables actuator recovery only; the same hard safety supervisor and threshold diagnostics remain. basic uses thresholds; enhanced uses the existing synthetic-trained classifier. Modeled recovery energy counts served 5 W radio reset loads only; relay and ADCS switching energy are unmodeled.'
    report['briefing']=dict(generator='deterministic_telemetry_summary',is_llm=False,configuration_changes_allowed=False,
        statements=[f"Strategy {strategy}: safe mode for {report['metrics']['safe_mode_seconds']} s.",
                    f"Minimum battery {report['metrics']['min_battery_pct']:.2f}%; peak node temperature {report['metrics']['max_temperature_k']:.2f} K.",
                    f"{len(actions)} actuator actions; {sum(a['outcome']=='achieved' for a in actions)} immediate commanded effects observed.",
                    f"Research success proxy {'met' if success else 'not met'}; no flight-performance inference."],
        evidence_run_id=report['run_id'])
    return report


def run_study(scenario,seeds):
    cfg=engineering_config(scenario)
    if (not isinstance(seeds,list) or not 1<=len(seeds)<=30
        or any(type(seed) is not int or not 0<=seed<2**32 or seed==9001 for seed in seeds)
        or len(set(seeds))!=len(seeds)):
        raise ValueError('Use 1–30 distinct uint32 seeds, excluding calibration seed 9001')
    if cfg.duration_seconds//cfg.dt_seconds*len(seeds)*3>60000:
        raise ValueError('Study exceeds 60000 aggregate engine intervals')
    runs=[]
    for seed in seeds:
        strategies={}
        for strategy in STRATEGIES:
            r=run_strategy({**scenario,'seed':seed},strategy)
            if r['checks']['violations']:raise ValueError('Engineering invariant violation')
            strategies[strategy]={k:r[k] for k in ('run_id','scenario_sha256','research_metrics','checks')}
        runs.append(dict(seed=seed,strategies=strategies))
    keys=tuple(runs[0]['strategies']['basic']['research_metrics'])
    summary={s:{key:mean_interval([r['strategies'][s]['research_metrics'][key] for r in runs]) for key in keys} for s in STRATEGIES}
    for s in STRATEGIES:
        count=sum(r['strategies'][s]['research_metrics']['mission_success'] for r in runs)
        summary[s]['mission_success']['ci95']=wilson_interval(count,len(seeds))
        summary[s]['mission_success']['interval_method']='Wilson binomial 95%'
    paired={key:mean_interval([r['strategies']['enhanced']['research_metrics'][key]-r['strategies']['basic']['research_metrics'][key]
                 for r in runs if r['strategies']['enhanced']['research_metrics'][key] is not None and r['strategies']['basic']['research_metrics'][key] is not None]) for key in keys}
    paths=[Path(__file__),Path(__file__).parent/'engineering'/'model.py',Path(__file__).parent/'engineering'/'config.py',
           Path(__file__).parent/'engineering'/'controller.py',Path(__file__).parent/'engineering'/'diagnostics.py',Path(__file__).parent/'engineering'/'physics.py']
    return dict(schema_version='reliability-study-2.0',data_provenance='SYNTHETIC',model_validated_for_flight=False,
        scenario=scenario,seeds=seeds,runs=runs,summary=summary,paired_enhanced_minus_basic=paired,
        source_sha256={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},
        limitations='Paired noise-seed experiment conditional on one fixed plant and fault schedule; not independent missions or a calibrated hardware reliability distribution. Student-t 95% mean intervals assume iid seed outcomes and approximate normality; n=1 has no mean interval. Zero-width intervals mean no observed seed variation, not certainty; no multiple-comparison correction. Wilson interval for binary mission-success proxy. Recovery success is immediate command effect, not permanent repair. Detection latency conditions on detected episodes. Closed-loop confusion rates use different manifested plant histories; identical-telemetry replay remains available in benchmark_engineering.py. No general AI superiority claim.')
