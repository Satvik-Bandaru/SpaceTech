"""Deterministic safety supervisor. Diagnostics cannot override hard protection thresholds."""


class SafeManager:
    def __init__(self,low_k,high_k,recovery_seconds=300):
        self.low_k,self.high_k=low_k,high_k
        self.recovery_seconds=recovery_seconds
        self.mode='normal'
        self.stable_seconds=0
        self.comms_down_seconds=0

    def update(self,observed,alarms,dt_seconds):
        self.comms_down_seconds=0 if observed['comms_up'] else self.comms_down_seconds+dt_seconds
        reasons=[]
        if observed['battery_pct']<25:reasons.append('LOW_BATTERY')
        if observed['temperature_k']>self.high_k:reasons.append('HIGH_TEMPERATURE')
        if observed['temperature_k']<self.low_k:reasons.append('LOW_TEMPERATURE')
        if abs(observed['pointing_error_deg'])>25:reasons.append('POINTING_LIMIT')
        if self.comms_down_seconds>=180:reasons.append('COMMS_TIMEOUT')
        if observed['unserved_w']>1e-9:reasons.append('UNSERVED_POWER')
        reasons.extend('DIAG:'+name for name in sorted(alarms))
        if reasons:
            self.mode='safe';self.stable_seconds=0
        elif self.mode=='safe':
            healthy=(observed['battery_pct']>=40 and self.low_k+3<=observed['temperature_k']<=self.high_k-3
                     and abs(observed['pointing_error_deg'])<10 and observed['comms_up'] and observed['unserved_w']<=1e-9)
            self.stable_seconds=self.stable_seconds+dt_seconds if healthy else 0
            if self.stable_seconds>=self.recovery_seconds:
                self.mode='normal';self.stable_seconds=0
        return self.mode,reasons
