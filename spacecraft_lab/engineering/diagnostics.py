"""Telemetry-only baseline and experimental fitted synthetic-signature classifier.

The assisted model fits independent binary nearest-centroid classifiers to synthetic
analytic signatures, not flight data. It is not an LLM, fault oracle or certified AI.
"""
import math
import random
from statistics import mean

from .config import FAULTS

BASELINE_THRESHOLDS = dict(solar_array_loss=.4,heater_stuck_on=60,comms_loss=.5,attitude_fault=15,battery_leak=15)
SIGNATURES = dict(solar_array_loss=(.55,.10,.02),heater_stuck_on=(90,18,12),
                  comms_loss=(1,0,0),attitude_fault=(45,5,.3),battery_leak=(25,5,3))


def fit_signature_model(seed=9001):
    if type(seed) is not int or not 0 <= seed < 2**32:
        raise ValueError('Training seed must be uint32')
    rng=random.Random(seed)
    centers={}
    for name,(fault_mean,fault_std,normal_std) in SIGNATURES.items():
        healthy=[rng.gauss(0,normal_std) for _ in range(256)]
        faulty=[rng.gauss(fault_mean,fault_std) for _ in range(256)]
        centers[name]=dict(healthy=mean(healthy),fault=mean(faulty))
    return dict(method='independent_binary_nearest_centroid',training_seed=seed,
                samples_per_class_per_channel=256,data_provenance='SYNTHETIC_ANALYTIC_SIGNATURES',
                centers=centers,warning='Synthetic calibration only; no operational accuracy or general superiority claim')


class Diagnoser:
    def __init__(self,policy,calibration,persistence_seconds=30):
        if policy not in ('baseline','assisted'):
            raise ValueError('policy must be baseline or assisted')
        self.policy=policy
        self.calibration=calibration
        self.persistence=persistence_seconds
        self.counters={name:0 for name in FAULTS}

    def observe(self,features,dt_seconds):
        if set(features)!=set(FAULTS) or any(type(v) not in (int,float) or not math.isfinite(v) for v in features.values()):
            raise ValueError('Diagnoser accepts only the five finite observed residual channels')
        if type(dt_seconds) is not int or dt_seconds <= 0:
            raise ValueError('dt_seconds must be positive integer')
        for name,value in features.items():
            if self.policy=='baseline':
                positive=value>BASELINE_THRESHOLDS[name]
            else:
                center=self.calibration['centers'][name]
                positive=abs(value-center['fault'])<abs(value-center['healthy'])
            self.counters[name]=self.counters[name]+dt_seconds if positive else 0
        return {name for name,seconds in self.counters.items() if seconds>=self.persistence}
