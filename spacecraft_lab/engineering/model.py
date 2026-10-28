"""Coupled EPS/thermal plant, observable residuals, FDIR and synthetic engineering evidence."""
from dataclasses import asdict
import hashlib
import json
import math
import random

from . import MODEL_VERSION
from .config import EngineeringConfig, engineering_config, FAULTS
from .controller import SafeManager
from .diagnostics import Diagnoser, fit_signature_model
from .physics import power_step, thermal_step, radiated_power


def _hash(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),allow_nan=False).encode()).hexdigest()


def run_engineering(data,policy='baseline',training_seed=9001):
    if policy not in ('baseline','assisted'):
        raise ValueError('Unknown diagnostic policy')
    raw=asdict(data) if isinstance(data,EngineeringConfig) else data
    if isinstance(data,EngineeringConfig):raw['faults']=list(raw['faults'])
    cfg=engineering_config(raw)
    calibration=fit_signature_model(training_seed)
    diag=Diagnoser(policy,calibration)
    safety=SafeManager(cfg.low_temperature_k,cfg.high_temperature_k)
    rng=random.Random(cfg.seed)
    battery,temp=cfg.initial_battery_wh,cfg.initial_temperature_k
    alarms=set();heater_isolated_since=None;heater_attempts=0;adcs_redundant=False
    radio_attempts=0;last_radio_attempt=-120;radio_reset_until=0
    previous_unserved=0
    previous_powered=cfg.initial_battery_wh>0
    events=[];telemetry=[]
    tp=fp=fn=0
    confusion={name:dict(tp=0,fp=0,fn=0) for name in FAULTS}

    def emit(t,event,**detail):
        events.append(dict(time_seconds=t,event=event,**detail))

    for t in range(0,cfg.duration_seconds,cfg.dt_seconds):
        dt=cfg.dt_seconds;h=dt/3600
        active=[f for f in cfg.faults if f.active(t) and f.severity>0]
        magnitude={name:sum(f.severity for f in active if f.kind==name) for name in FAULTS}
        sun=(t%cfg.orbit_period_seconds)<(cfg.orbit_period_seconds-cfg.eclipse_seconds)
        # Exogenous draws have fixed count/order across policies: paired common random numbers.
        noise=[rng.gauss(0,1) for _ in range(6)]
        sensed_temp=temp+noise[1]*cfg.sensor_noise_k
        if heater_isolated_since is not None and t-heater_isolated_since>=300 and heater_attempts<2 and sensed_temp<cfg.high_temperature_k-3:
            heater_isolated_since=None;heater_attempts+=1
            emit(t,'RETRY_HEATER',attempt=heater_attempts)
        if 'heater_stuck_on' in alarms and heater_isolated_since is None:
            heater_isolated_since=t;emit(t,'ISOLATE_HEATER',retry_budget_remaining=2-heater_attempts)
        if 'attitude_fault' in alarms and not adcs_redundant:
            adcs_redundant=True;emit(t,'SWITCH_REDUNDANT_ADCS')
        if 'comms_loss' in alarms and radio_attempts<2 and t-last_radio_attempt>=120:
            radio_attempts+=1;last_radio_attempt=t;radio_reset_until=t+dt
            emit(t,'RESET_RADIO_ATTEMPT',attempt=radio_attempts,note='Does not cure an injected external outage')
        pointing=(5 if adcs_redundant else min(85,45*magnitude['attitude_fault']))
        measured_pointing=pointing+noise[2]*cfg.attitude_noise_deg
        channel_up=not magnitude['comms_loss'] and pointing<20 and t>=radio_reset_until
        sensed_battery=battery+noise[0]*cfg.battery_noise_wh
        sensed_temp=temp+noise[1]*cfg.sensor_noise_k
        observed=dict(battery_pct=100*sensed_battery/cfg.battery_capacity_wh,temperature_k=sensed_temp,
                      pointing_error_deg=measured_pointing,comms_up=bool(channel_up and previous_powered),unserved_w=previous_unserved)
        before_mode=safety.mode
        mode,reasons=safety.update(observed,alarms,dt)
        if mode!=before_mode:emit(t,'ENTER_SAFE_MODE' if mode=='safe' else 'RETURN_TO_NORMAL',reasons=reasons)
        base_load=cfg.safe_load_w if mode=='safe' else cfg.normal_load_w
        heater_command=cfg.heater_w if sensed_temp<cfg.heater_on_below_k and heater_isolated_since is None else 0
        unwanted_heater=80*magnitude['heater_stuck_on'] if heater_isolated_since is None else 0
        reset_load=5 if t<radio_reset_until else 0
        critical_demand=base_load+cfg.radio_load_w+reset_load
        demand=critical_demand+heater_command+unwanted_heater
        solar=cfg.solar_generation_w*sun*math.cos(math.radians(pointing))*max(0,1-magnitude['solar_array_loss'])
        before_energy=battery
        leak_wh=min(battery,20*magnitude['battery_leak']*h)
        eps=power_step(battery-leak_wh,cfg.battery_capacity_wh,solar,demand,dt,
                       cfg.charge_efficiency,cfg.discharge_efficiency,cfg.charge_limit_w,cfg.discharge_limit_w)
        battery=eps['battery_wh'];previous_unserved=eps['unserved_w']
        # Critical/base bus first; then commanded and unwanted heater loads.
        base_served=min(eps['served_w'],critical_demand)
        critical_powered=cfg.radio_load_w>0 and base_served>=critical_demand-1e-9
        comms_up=bool(channel_up and critical_powered)
        previous_powered=critical_powered
        heater_served=min(max(0,eps['served_w']-base_served),heater_command)
        extra_heat_served=min(max(0,eps['served_w']-base_served-heater_served),unwanted_heater)
        conversion_heat_w=eps['conversion_loss_wh']/h
        nominal_heat=base_served*cfg.internal_heat_fraction+heater_served+conversion_heat_w
        absorbed=cfg.absorbed_solar_w*sun
        total_heat=nominal_heat+extra_heat_served+leak_wh/h+absorbed
        heat=thermal_step(temp,total_heat,cfg.sink_temperature_k,cfg.emissivity,
                          cfg.radiator_area_m2,cfg.thermal_capacity_j_per_k,dt)
        next_temp=heat['temperature_k']
        end_battery=battery+noise[3]*cfg.battery_noise_wh
        end_temp=next_temp+noise[4]*cfg.sensor_noise_k
        # Residuals are computed from measured storage/current/temperature and known commands.
        expected_end=(sensed_battery+eps['charge_input_w']*cfg.charge_efficiency*h
                      -eps['discharge_bus_w']/cfg.discharge_efficiency*h)
        battery_residual=(expected_end-end_battery)/h
        thermal_residual=((end_temp-sensed_temp)*cfg.thermal_capacity_j_per_k/dt
                          +radiated_power(max(0,sensed_temp),cfg.sink_temperature_k,cfg.emissivity,cfg.radiator_area_m2)
                          -nominal_heat-absorbed-max(0,battery_residual))
        expected_solar=cfg.solar_generation_w*sun*max(0,math.cos(math.radians(measured_pointing)))
        measured_solar=solar+noise[5]*cfg.solar_noise_w
        features=dict(solar_array_loss=max(0,(expected_solar-measured_solar)/expected_solar) if expected_solar>10 else 0,
                      heater_stuck_on=thermal_residual,comms_loss=float(not channel_up and critical_powered and abs(measured_pointing)<20 and t>=radio_reset_until),
                      attitude_fault=abs(measured_pointing) if not adcs_redundant else 0,battery_leak=battery_residual)
        detected=diag.observe(features,dt)
        for name in sorted(detected-alarms):emit(t+dt,'FAULT_DETECTED',fault=name,policy=policy)
        for name in sorted(alarms-detected):emit(t+dt,'DIAGNOSTIC_CLEARED',fault=name)
        alarms=detected
        # Ground truth is used ONLY here, by the evaluator; mitigated/unobservable manifestations are excluded.
        truth=set()
        if magnitude['solar_array_loss'] and expected_solar>10:truth.add('solar_array_loss')
        if extra_heat_served>0:truth.add('heater_stuck_on')
        if magnitude['comms_loss'] and critical_powered and pointing<20 and t>=radio_reset_until:truth.add('comms_loss')
        if magnitude['attitude_fault'] and not adcs_redundant:truth.add('attitude_fault')
        if leak_wh>0:truth.add('battery_leak')
        tp+=len(detected&truth);fp+=len(detected-truth);fn+=len(truth-detected)
        for name in FAULTS:
            confusion[name]['tp']+=int(name in detected and name in truth)
            confusion[name]['fp']+=int(name in detected and name not in truth)
            confusion[name]['fn']+=int(name not in detected and name in truth)
        whole_power_residual=(before_energy+solar*h-battery-eps['served_w']*h
                              -eps['curtailed_w']*h-eps['conversion_loss_wh']-leak_wh)
        telemetry.append(dict(time_seconds=t+dt,interval_start_seconds=t,mode=mode,battery_wh=battery,
            battery_pct=100*battery/cfg.battery_capacity_wh,temperature_k=next_temp,solar_w=solar,demand_w=demand,
            served_w=eps['served_w'],unserved_w=eps['unserved_w'],curtailed_w=eps['curtailed_w'],
            conversion_loss_wh=eps['conversion_loss_wh'],leak_loss_wh=leak_wh,
            heat_input_w=total_heat,radiated_w=heat['radiated_w'],stored_heat_j=heat['stored_heat_j'],
            power_balance_residual_wh=whole_power_residual,thermal_balance_residual_j=heat['balance_residual_j'],
            comms_up=bool(comms_up),critical_bus_powered=critical_powered,radio_load_w=cfg.radio_load_w,
            pointing_error_deg=pointing,heater_isolated=heater_isolated_since is not None,
            redundant_adcs=adcs_redundant,observed_residuals=features,diagnosed_faults=sorted(detected),
            injected_faults=sorted({f.kind for f in active}),manifesting_faults=sorted(truth)))
        temp=next_temp
    checks=check_report(cfg,telemetry)
    latencies=[];missed=0
    for fault in cfg.faults:
        detections=[r['time_seconds'] for r in telemetry if fault.severity>0 and fault.active(r['interval_start_seconds'])
                    and fault.kind in r['diagnosed_faults'] and fault.kind in r['manifesting_faults']]
        latency=min(detections)-fault.start_seconds if detections else None
        latencies.append(dict(fault=fault.kind,start_seconds=fault.start_seconds,latency_seconds=latency,eligible=fault.severity>0))
        missed+=int(latency is None and fault.severity>0)
    config=asdict(cfg);config['faults']=list(config['faults']);scenario_hash=_hash(config)
    identity=_hash(dict(model=MODEL_VERSION,scenario=config,policy=policy,calibration=calibration))
    metrics=dict(safe_mode_seconds=sum(r['mode']=='safe' for r in telemetry)*cfg.dt_seconds,
        comms_availability_pct=100*sum(r['comms_up'] for r in telemetry)/len(telemetry),
        min_battery_pct=min(r['battery_pct'] for r in telemetry),max_temperature_k=max(r['temperature_k'] for r in telemetry),
        unserved_energy_wh=sum(r['unserved_w'] for r in telemetry)*cfg.dt_seconds/3600,
        curtailed_energy_wh=sum(r['curtailed_w'] for r in telemetry)*cfg.dt_seconds/3600,
        conversion_loss_wh=sum(r['conversion_loss_wh'] for r in telemetry),
        isolation_count=sum(e['event']=='ISOLATE_HEATER' for e in events),
        heater_retries=heater_attempts,radio_reset_attempts=radio_attempts)
    return dict(schema_version='engineering-0.2',model_version=MODEL_VERSION,run_id='eng-'+identity[:24],
        scenario_sha256=scenario_hash,policy=policy,config=config,data_provenance='SYNTHETIC',
        model_validated_for_flight=False,operational_status='advisory_only',calibration=calibration,
        metrics=metrics,events=events,telemetry=telemetry,checks=checks,
        diagnostics=dict(true_positive_samples=tp,false_positive_samples=fp,false_negative_samples=fn,
                         per_fault=confusion,episode_latencies=latencies,missed_injected_episodes=missed),
        disclaimer='Engineering reference prototype with synthetic inputs; not flight software, qualified hardware or certified predictions.')


def check_report(cfg,rows):
    """Recompute ledgers independently from state changes/flows, without trusting supplied residual fields."""
    violations=[]
    max_power=max_heat=0
    previous_battery=cfg.initial_battery_wh
    previous_temp=cfg.initial_temperature_k
    previous_time=0
    if len(rows)!=cfg.duration_seconds//cfg.dt_seconds:violations.append('trace length')
    for r in rows:
        dt=r['time_seconds']-previous_time
        if dt!=cfg.dt_seconds:violations.append('trace timing')
        if not all(math.isfinite(r[k]) for k in ('battery_wh','temperature_k','solar_w','served_w','unserved_w','demand_w',
                'curtailed_w','conversion_loss_wh','leak_loss_wh','heat_input_w','radiated_w','stored_heat_j')):
            violations.append('nonfinite trace');continue
        power=(previous_battery+r['solar_w']*dt/3600-r['battery_wh']-r['served_w']*dt/3600
               -r['curtailed_w']*dt/3600-r['conversion_loss_wh']-r['leak_loss_wh'])
        heat=(r['heat_input_w']-r['radiated_w'])*dt-cfg.thermal_capacity_j_per_k*(r['temperature_k']-previous_temp)
        max_power=max(max_power,abs(power));max_heat=max(max_heat,abs(heat))
        if not 0<=r['battery_wh']<=cfg.battery_capacity_wh:violations.append('battery bounds')
        if not math.isfinite(r['temperature_k']) or r['temperature_k']<=0:violations.append('absolute temperature')
        if min(r['served_w'],r['unserved_w'],r['curtailed_w']) < -1e-8:violations.append('negative power flow')
        if abs(r['served_w']+r['unserved_w']-r['demand_w'])>1e-8:violations.append('demand balance')
        previous_battery,previous_temp,previous_time=r['battery_wh'],r['temperature_k'],r['time_seconds']
    if max_power>1e-8:violations.append('power conservation')
    if max_heat>1e-6:violations.append('thermal conservation')
    return dict(violations=sorted(set(violations)),max_power_residual_wh=max_power,max_thermal_residual_j=max_heat)
