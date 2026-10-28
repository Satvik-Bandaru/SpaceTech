"""Paired synthetic studies and identical-telemetry diagnostic replay, with descriptive statistics."""
from dataclasses import asdict
import hashlib
from pathlib import Path
from statistics import mean,stdev

from . import MODEL_VERSION
from .config import engineering_config, FAULTS
from .diagnostics import Diagnoser,fit_signature_model
from .model import run_engineering


def describe(values):
    return dict(n=len(values),mean=mean(values),sample_sd=stdev(values) if len(values)>1 else None,
                minimum=min(values),maximum=max(values))


def replay_diagnostics(reference,policy,calibration):
    """Both policies see exactly the same recorded features and evaluator-only manifestation labels."""
    diagnoser=Diagnoser(policy,calibration)
    tp=fp=fn=negatives=0;observations=[]
    for row in reference['telemetry']:
        predicted=diagnoser.observe(row['observed_residuals'],reference['config']['dt_seconds'])
        truth=set(row['manifesting_faults'])
        tp+=len(predicted&truth);fp+=len(predicted-truth);fn+=len(truth-predicted)
        negatives+=len(FAULTS)-len(truth)
        observations.append((row['interval_start_seconds'],row['time_seconds'],predicted,truth))
    latencies=[];missed=0
    for fault in reference['config']['faults']:
        if fault['severity']==0:continue
        end=fault['start_seconds']+fault['duration_seconds']
        times=[time for start,time,predicted,truth in observations
               if fault['start_seconds']<=start<end and fault['kind'] in predicted and fault['kind'] in truth]
        if times:latencies.append(min(times)-fault['start_seconds'])
        else:missed+=1
    return dict(samples=len(reference['telemetry']),true_positive_samples=tp,false_positive_samples=fp,
        false_negative_samples=fn,precision=tp/(tp+fp) if tp+fp else None,
        recall=tp/(tp+fn) if tp+fn else None,false_positive_rate=fp/negatives if negatives else None,
        detected_episode_mean_latency_s=mean(latencies) if latencies else None,
        missed_injected_episodes=missed)


def paired_benchmark(scenario,seeds,training_seed=9001):
    cfg=engineering_config(scenario)
    if (not isinstance(seeds,list) or not 1<=len(seeds)<=50 or len(set(seeds))!=len(seeds)
            or any(type(s) is not int or not 0<=s<2**32 for s in seeds) or training_seed in seeds):
        raise ValueError('Use 1–50 distinct uint32 evaluation seeds, separate from the training seed')
    base=asdict(cfg);base['faults']=list(base['faults'])
    calibration=fit_signature_model(training_seed)
    runs=[]
    for seed in seeds:
        results={policy:run_engineering({**base,'seed':seed},policy,training_seed) for policy in ('baseline','assisted')}
        pair=dict(seed=seed,diagnostic_replay={p:replay_diagnostics(results['baseline'],p,calibration) for p in results})
        for p,r in results.items():
            pair[p]=dict(run_id=r['run_id'],scenario_sha256=r['scenario_sha256'],metrics=r['metrics'],violations=r['checks']['violations'])
        runs.append(pair)
    metrics=tuple(runs[0]['baseline']['metrics'])
    summary={p:{key:describe([r[p]['metrics'][key] for r in runs]) for key in metrics} for p in ('baseline','assisted')}
    paired={key:describe([r['assisted']['metrics'][key]-r['baseline']['metrics'][key] for r in runs]) for key in metrics}
    replay_summary={p:{key:describe([r['diagnostic_replay'][p][key] for r in runs])
                      for key in ('true_positive_samples','false_positive_samples','false_negative_samples','missed_injected_episodes')}
                    for p in ('baseline','assisted')}
    sources={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(Path(__file__).parent.glob('*.py'))}
    return dict(schema_version='engineering-benchmark-0.2',model_version=MODEL_VERSION,
        data_provenance='SYNTHETIC',model_validated_for_flight=False,base_config=base,calibration=calibration,
        engine_source_sha256=sources,runs=runs,summary=summary,paired_assisted_minus_baseline=paired,
        diagnostic_replay_summary=replay_summary,
        interpretation='Closed-loop policies share exogenous seeds but may produce different plant histories. '
        'Diagnostic replay separately compares both detectors on the identical baseline-controlled trace. '
        'Seeds vary sensor noise, not independent spacecraft designs. Synthetic calibration and small descriptive '
        'studies establish no flight accuracy or general AI superiority. No significance test is claimed.')
