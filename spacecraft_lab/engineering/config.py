"""Strict bounded v0.2 input contract, intentionally separate from offline contract v1.0."""
from dataclasses import dataclass, fields
import math

FAULTS = ('solar_array_loss', 'heater_stuck_on', 'comms_loss', 'attitude_fault', 'battery_leak')


@dataclass(frozen=True)
class EngineeringFault:
    kind: str
    start_seconds: int
    duration_seconds: int
    severity: float = 1.0

    def active(self, seconds):
        return self.start_seconds <= seconds < self.start_seconds + self.duration_seconds


@dataclass(frozen=True)
class EngineeringConfig:
    duration_seconds: int = 7200
    dt_seconds: int = 10
    seed: int = 42
    battery_capacity_wh: float = 240
    initial_battery_wh: float = 180
    normal_load_w: float = 120
    safe_load_w: float = 35
    radio_load_w: float = 5
    solar_generation_w: float = 180
    charge_efficiency: float = .92
    discharge_efficiency: float = .9
    charge_limit_w: float = 120
    discharge_limit_w: float = 150
    initial_temperature_k: float = 293.15
    sink_temperature_k: float = 250
    thermal_capacity_j_per_k: float = 20000
    emissivity: float = .75
    radiator_area_m2: float = .5
    absorbed_solar_w: float = 40
    internal_heat_fraction: float = .85
    heater_w: float = 40
    heater_on_below_k: float = 283.15
    low_temperature_k: float = 263.15
    high_temperature_k: float = 333.15
    sensor_noise_k: float = .002
    solar_noise_w: float = .5
    battery_noise_wh: float = .002
    attitude_noise_deg: float = .1
    orbit_period_seconds: int = 5400
    eclipse_seconds: int = 1800
    faults: tuple[EngineeringFault, ...] = ()


def engineering_config(data):
    if not isinstance(data, dict):
        raise ValueError('Engineering scenario must be an object')
    names = {f.name for f in fields(EngineeringConfig)}
    if set(data) - names - {'name', 'description'}:
        raise ValueError('Unknown engineering scenario fields')
    for label in ('name','description'):
        if label in data and (not isinstance(data[label],str) or len(data[label])>1000):
            raise ValueError(f'{label} must be a bounded string')
    raw = data.get('faults', [])
    if not isinstance(raw, list) or len(raw) > 64:
        raise ValueError('faults must be an array with at most 64 entries')
    faults = []
    for item in raw:
        if not isinstance(item, dict) or set(item)-{'kind','start_seconds','duration_seconds','severity'}:
            raise ValueError('Invalid engineering fault fields')
        if not {'kind','start_seconds','duration_seconds'} <= set(item):
            raise ValueError('Fault needs kind, start_seconds and duration_seconds')
        if item['kind'] not in FAULTS:
            raise ValueError('Unsupported engineering fault kind')
        for field in ('start_seconds','duration_seconds'):
            if type(item[field]) is not int or item[field] < (1 if field == 'duration_seconds' else 0):
                raise ValueError(f'{field} must be an integer in seconds')
        severity = item.get('severity',1)
        if type(severity) not in (int,float) or not math.isfinite(severity) or not 0 <= severity <= 2:
            raise ValueError('Fault severity must be finite in [0,2]')
        if item['kind'] == 'solar_array_loss' and severity > 1:
            raise ValueError('Solar loss fraction must be in [0,1]')
        faults.append(EngineeringFault(**item))
    cfg = EngineeringConfig(**{k:v for k,v in data.items() if k in names-{'faults'}},faults=tuple(faults))
    for name,low,high in [('duration_seconds',1,21600),('dt_seconds',1,60),('seed',0,2**32-1),
                          ('orbit_period_seconds',60,86400),('eclipse_seconds',0,86400)]:
        value = getattr(cfg,name)
        if type(value) is not int or not low <= value <= high:
            raise ValueError(f'{name} outside integer bounds [{low},{high}]')
    if cfg.duration_seconds % cfg.dt_seconds or cfg.duration_seconds//cfg.dt_seconds > 10000:
        raise ValueError('Horizon must be divisible by dt and have at most 10000 steps')
    if cfg.eclipse_seconds > cfg.orbit_period_seconds:
        raise ValueError('Eclipse cannot exceed illumination cycle')
    for name in names-{'faults','duration_seconds','dt_seconds','seed','orbit_period_seconds','eclipse_seconds'}:
        value = getattr(cfg,name)
        if type(value) not in (int,float) or not math.isfinite(value):
            raise ValueError(f'{name} must be finite numeric input')
    bounds = {
        'battery_capacity_wh':(1,1e6), 'initial_battery_wh':(0,cfg.battery_capacity_wh),
        'normal_load_w':(0,5000), 'safe_load_w':(0,cfg.normal_load_w),'solar_generation_w':(0,10000),
        'radio_load_w':(0,100),
        'charge_efficiency':(.01,1),'discharge_efficiency':(.01,1),
        'charge_limit_w':(0,10000),'discharge_limit_w':(0,10000),
        'initial_temperature_k':(150,400),'sink_temperature_k':(0,350),
        'thermal_capacity_j_per_k':(10000,1e8),'emissivity':(0,1),'radiator_area_m2':(0,5),
        'absorbed_solar_w':(0,1000),'internal_heat_fraction':(0,1),'heater_w':(0,1000),
        'heater_on_below_k':(150,350),'low_temperature_k':(150,350),'high_temperature_k':(200,400),
        'sensor_noise_k':(0,.1),'solar_noise_w':(0,10),'battery_noise_wh':(0,.1),'attitude_noise_deg':(0,5),
    }
    for name,(low,high) in bounds.items():
        if not low <= getattr(cfg,name) <= high:
            raise ValueError(f'{name} outside bounds [{low},{high}]')
    if cfg.low_temperature_k+6 >= cfg.high_temperature_k:
        raise ValueError('Thermal safety limits need room for recovery hysteresis')
    if any(f.start_seconds >= cfg.duration_seconds for f in faults):
        raise ValueError('Fault starts beyond horizon')
    if any(f.start_seconds%cfg.dt_seconds or f.duration_seconds%cfg.dt_seconds or f.duration_seconds>21600 for f in faults):
        raise ValueError('Fault windows must align with dt_seconds and last at most 21600 seconds')
    return cfg
