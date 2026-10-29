"""Independent engineering presets, not the legacy conceptual scenario format."""
from copy import deepcopy

BASE=dict(duration_seconds=5400,dt_seconds=10,seed=7,initial_battery_wh=140)
PRESETS={
    'nominal':dict(name='Nominal orbital reference',**BASE,faults=[]),
    'eclipse':dict(name='Extended eclipse',**BASE,orbit_period_seconds=5400,eclipse_seconds=4200,faults=[]),
    'solar':dict(name='Solar-array damage',**BASE,faults=[dict(kind='solar_array_loss',start_seconds=300,duration_seconds=4800,severity=.65)]),
    'thermal':dict(name='Thermal-control failure',**BASE,faults=[dict(kind='heater_stuck_on',start_seconds=300,duration_seconds=3600,severity=1)]),
    'comms':dict(name='Communications blackout',**BASE,faults=[dict(kind='comms_loss',start_seconds=900,duration_seconds=1800,severity=1)]),
    'power':dict(name='Battery emergency with solar recovery',**{**BASE,'initial_battery_wh':40},faults=[dict(kind='solar_array_loss',start_seconds=0,duration_seconds=900,severity=1)]),
    'multifault':dict(name='Cascading subsystem faults',**BASE,faults=[
        dict(kind='solar_array_loss',start_seconds=300,duration_seconds=2400,severity=.35),
        dict(kind='heater_stuck_on',start_seconds=600,duration_seconds=1800,severity=.65),
        dict(kind='attitude_fault',start_seconds=900,duration_seconds=1200,severity=.5),
        dict(kind='comms_loss',start_seconds=1500,duration_seconds=900,severity=1),
        dict(kind='battery_leak',start_seconds=2100,duration_seconds=900,severity=.8)])}


def presets():
    return deepcopy(PRESETS)
