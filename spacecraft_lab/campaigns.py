"""Bounded paired counterfactual experiments on the existing synthetic plant.

Variants change only validated engineering inputs. Each primary case retains its
complete existing report; an assured case also retains its protected baseline.
Neither baseline duplicates nor telemetry samples are extra statistical trials.
"""
from copy import deepcopy
from dataclasses import asdict, fields
import csv
import hashlib
import io
import json
import math
from pathlib import Path

from .engineering.config import EngineeringConfig, engineering_config
from .reliability import run_strategy, mean_interval, wilson_interval
from .assurance.contracts import digest, validate_options, implementation_manifest
from .assurance.runner import run_assurance


SCHEMA_VERSION = 'counterfactual-campaign-1.0'
STRATEGIES = ('none', 'basic', 'enhanced', 'assured')
_CHANGE_FIELDS = {field.name for field in fields(EngineeringConfig)} - {'seed'}
_CAMPAIGN_SOURCE = Path(__file__).resolve()
_LOADED_CAMPAIGN_SHA256 = hashlib.sha256(_CAMPAIGN_SOURCE.read_bytes()).hexdigest()
LIMITATIONS = (
    'SYNTHETIC simplified engineering reference; not flight-qualified. '
    'Paired noise-seed experiments conditional on the selected plant configurations and fault schedules; '
    'not independent missions or a calibrated hardware reliability distribution. '
    'Student-t 95% mean intervals assume iid seed outcomes and approximate normality; n=1 has no mean interval. '
    'Zero-width intervals mean no observed seed variation, not certainty; no multiple-comparison correction. '
    'Wilson 95% intervals describe the binary research mission-success proxy, not flight reliability. '
    'Common reference criteria evaluate mission_success for every primary trace using the reference temperature limits '
    'and fixed battery, communications and unserved-energy requirements. Variant controller thresholds still affect '
    'the simulated plant, but cannot relax this campaign evaluation criterion. Original reports retain their own '
    'configuration-specific research metrics for replay; campaign summaries and deltas use evaluation_metrics. '
    'Paired variant deltas are variant minus reference for the same strategy and seed. '
    'Strategy deltas use the same variant and seed, relative to basic when selected, otherwise the first selected strategy. '
    'Missing metric values are omitted only from that metric; paired deltas require both values. '
    'Detection latency conditions on detected episodes. Recovery outcomes are immediate command effects, not lasting repairs. '
    'Closed-loop histories can differ; the same seeds pair exogenous noise draws, not identical telemetry. '
    'Assured protected baselines are retained for replay and checked, but never counted again as independent trials. '
    'No general AI superiority claim, hardware command path or external model service.'
)


def _name(value, label):
    if (not isinstance(value, str) or not 1 <= len(value.strip()) <= 80 or len(value) > 80
            or any(ord(character) < 32 or ord(character) == 127 for character in value)):
        raise ValueError(f'{label} must be a nonempty bounded string of at most 80 characters')
    return value


def _config(raw):
    result = asdict(engineering_config(raw))
    result['faults'] = list(result['faults'])
    if result['duration_seconds'] // result['dt_seconds'] > 2000:
        raise ValueError('Each campaign configuration must have at most 2000 engine intervals')
    return result


def _variants(configuration):
    variants = [dict(variant_id='reference', name='Reference', config=deepcopy(configuration['scenario']))]
    for index, variant in enumerate(configuration['variants'], 1):
        variants.append(dict(variant_id=f'variant-{index}', name=variant['name'],
            config=_config({**configuration['scenario'], **variant['changes']})))
    return variants


def normalize_campaign(request):
    """Validate and independently copy a finite campaign request, without running it."""
    allowed = {'name', 'scenario', 'variants', 'seeds', 'strategies', 'assurance_options'}
    if not isinstance(request, dict) or set(request) - allowed:
        raise ValueError('Unknown campaign fields; expected a campaign object')
    scenario = _config(request.get('scenario', {}))
    raw_variants = request.get('variants', [])
    if not isinstance(raw_variants, list) or len(raw_variants) > 3:
        raise ValueError('Use at most three counterfactual variants in addition to the reference')
    variants = []
    for variant in raw_variants:
        if not isinstance(variant, dict) or set(variant) != {'name', 'changes'}:
            raise ValueError('Each variant needs only name and changes')
        name = _name(variant['name'], 'Variant name')
        changes = variant['changes']
        if not isinstance(changes, dict) or set(changes) - _CHANGE_FIELDS:
            raise ValueError('Variant changes must be engineering fields or faults; paired seeds cannot change')
        merged = _config({**scenario, **changes})
        variants.append(dict(name=name, changes={key: deepcopy(merged[key]) for key in changes}))
    seeds = request.get('seeds', [0, 1, 2])
    if (not isinstance(seeds, list) or not 1 <= len(seeds) <= 8
            or any(type(seed) is not int or not 0 <= seed < 2**32 or seed == 9001 for seed in seeds)
            or len(set(seeds)) != len(seeds)):
        raise ValueError('Use 1–8 distinct uint32 seeds, excluding calibration seed 9001')
    strategies = request.get('strategies', list(STRATEGIES))
    if (not isinstance(strategies, list) or not 2 <= len(strategies) <= 4
            or any(not isinstance(strategy, str) or strategy not in STRATEGIES for strategy in strategies)
            or len(set(strategies)) != len(strategies)):
        raise ValueError('Choose 2–4 distinct strategies from none, basic, enhanced and assured')
    result = dict(name=_name(request.get('name', 'Counterfactual mission campaign'), 'Campaign name'),
        scenario=scenario, variants=variants, seeds=list(seeds), strategies=list(strategies),
        assurance_options=validate_options(request.get('assurance_options', {})))
    configurations = _variants(result)
    if len(configurations) * len(seeds) * len(strategies) > 32:
        raise ValueError('Campaign exceeds 32 primary runs')
    weighted_strategies = len(strategies) + int('assured' in strategies)
    intervals = sum(v['config']['duration_seconds'] // v['config']['dt_seconds'] for v in configurations)
    if intervals * len(seeds) * weighted_strategies > 20000:
        raise ValueError('Campaign exceeds 20000 total engine intervals, including assured baselines')
    return result


def _source_manifest():
    manifest = implementation_manifest()
    campaign_sha256 = hashlib.sha256(_CAMPAIGN_SOURCE.read_bytes()).hexdigest()
    if campaign_sha256 != _LOADED_CAMPAIGN_SHA256:
        raise ValueError('Campaign implementation changed since import; restart the local process')
    manifest['campaigns.py'] = campaign_sha256
    return manifest


def _checked_report(report):
    """Validate generated checks before allowing their data into an aggregate."""
    if not isinstance(report, dict):
        raise ValueError('Invalid engine report')
    checks = report.get('checks')
    expected = {'violations', 'max_power_residual_wh', 'max_thermal_residual_j'}
    if not isinstance(checks, dict) or set(checks) != expected:
        raise ValueError('Invalid engineering checks')
    if not isinstance(checks['violations'], list) or any(not isinstance(v, str) for v in checks['violations']):
        raise ValueError('Invalid engineering check violations')
    for key, limit in (('max_power_residual_wh', 1e-8), ('max_thermal_residual_j', 1e-6)):
        value = checks[key]
        if type(value) not in (int, float) or not math.isfinite(value) or not 0 <= value <= limit:
            raise ValueError('Invalid or violated engineering residual checks')
    if checks['violations']:
        raise ValueError('Engineering invariant violation in campaign case')
    if report.get('data_provenance') != 'SYNTHETIC' or report.get('model_validated_for_flight') is not False:
        raise ValueError('Campaign requires synthetic, non-flight-qualified reports')
    return checks


def _research_metrics(report):
    metrics = report.get('research_metrics')
    if (not isinstance(metrics, dict) or not metrics
            or any(not isinstance(key, str) or (value is not None and
                (type(value) not in (int, float) or not math.isfinite(value))) for key, value in metrics.items())
            or type(metrics.get('mission_success')) is not int or metrics['mission_success'] not in (0, 1)):
        raise ValueError('Invalid research metrics')
    return metrics


def _paired_metrics(left, right, keys):
    return {key: mean_interval([a[key] - b[key] for a, b in zip(left, right)
        if a[key] is not None and b[key] is not None]) for key in keys}


def _evaluation_metrics(report, criteria):
    """Apply one unchanged success criterion to actual traces, preserving reports."""
    metrics = dict(_research_metrics(report))
    rows = report['telemetry']
    low, high = criteria['temperature_limits_k']
    comms_availability_pct = 100 * sum(row['comms_up'] for row in rows) / len(rows)
    unserved_energy_wh = sum(row['unserved_w'] for row in rows) * report['config']['dt_seconds'] / 3600
    metrics['mission_success'] = int(not report['checks']['violations']
        and rows[-1]['battery_pct'] >= criteria['final_battery_pct_at_least']
        and comms_availability_pct >= criteria['comms_availability_pct_at_least']
        and unserved_energy_wh < criteria['unserved_energy_wh_below']
        and all(low <= row['temperature_k'] <= high for row in rows))
    return metrics


def run_campaign(request, cancelled=None, progress=None):
    """Run deterministic paired cases synchronously; engine cancellation propagates."""
    configuration = normalize_campaign(request)
    source_sha256 = _source_manifest()
    campaign_id = 'campaign-' + digest(dict(configuration=configuration, source_sha256=source_sha256))[:24]
    variants = _variants(configuration)
    evaluation_criteria = dict(reference_variant_id='reference', final_battery_pct_at_least=20,
        comms_availability_pct_at_least=80, unserved_energy_wh_below=1e-8,
        temperature_limits_k=[configuration['scenario']['low_temperature_k'],
            configuration['scenario']['high_temperature_k']],
        evaluation_scope='Common reference criteria applied to every primary trace for campaign mission_success; '
            'original reports retain their own configuration-specific criteria. Other evaluation metrics copy research_metrics.')
    seeds = configuration['seeds']
    strategies = configuration['strategies']
    total_runs = len(variants) * len(seeds) * len(strategies)
    runs = []
    checked = []
    metrics_by_case = {}
    keys = None
    for variant in variants:
        for seed in seeds:
            for strategy in strategies:
                identity = dict(variant_id=variant['variant_id'], strategy=strategy, seed=seed)
                if progress:
                    progress(dict(completed_runs=len(runs), total_runs=total_runs, **identity))
                scenario = {**variant['config'], 'seed':seed}
                if strategy == 'assured':
                    report = run_assurance(scenario, configuration['assurance_options'], cancelled=cancelled)
                    checked.append(_checked_report(report.get('baseline')))
                else:
                    report = run_strategy(scenario, strategy, cancelled=cancelled)
                checked.append(_checked_report(report))
                metrics = _evaluation_metrics(report, evaluation_criteria)
                if keys is None:
                    keys = tuple(metrics)
                elif set(metrics) != set(keys):
                    raise ValueError('Campaign cases must have the same research metric contract')
                metrics_by_case[(variant['variant_id'], strategy, seed)] = metrics
                case_id = 'case-' + digest(dict(campaign_id=campaign_id, **identity))[:24]
                runs.append(dict(case_id=case_id, **identity, report=report, evaluation_metrics=metrics))
                if progress:
                    progress(dict(completed_runs=len(runs), total_runs=total_runs, **identity))
    summary = []
    paired_comparisons = []
    strategy_comparisons = []
    reference_strategy = 'basic' if 'basic' in strategies else strategies[0]
    for variant in variants:
        variant_id = variant['variant_id']
        for strategy in strategies:
            metrics = [metrics_by_case[(variant_id, strategy, seed)] for seed in seeds]
            successes = sum(m['mission_success'] for m in metrics)
            summary.append(dict(variant_id=variant_id, name=variant['name'], strategy=strategy,
                metrics={key:mean_interval([m[key] for m in metrics]) for key in keys},
                successes=successes, n=len(seeds), mission_success_ci95=wilson_interval(successes, len(seeds))))
            if variant_id != 'reference':
                reference = [metrics_by_case[('reference', strategy, seed)] for seed in seeds]
                paired_comparisons.append(dict(variant_id=variant_id, reference_variant_id='reference',
                    strategy=strategy, metrics=_paired_metrics(metrics, reference, keys)))
            if strategy != reference_strategy:
                reference = [metrics_by_case[(variant_id, reference_strategy, seed)] for seed in seeds]
                strategy_comparisons.append(dict(variant_id=variant_id, strategy=strategy,
                    reference_strategy=reference_strategy, metrics=_paired_metrics(metrics, reference, keys)))
    if _source_manifest() != source_sha256:
        raise ValueError('Campaign implementation changed during execution')
    return dict(schema_version=SCHEMA_VERSION, campaign_id=campaign_id, configuration=configuration,
        data_provenance='SYNTHETIC', model_validated_for_flight=False, operational_status='advisory_only',
        variants=variants, seeds=list(seeds), strategies=list(strategies), runs=runs, summary=summary,
        evaluation_criteria=evaluation_criteria,
        paired_comparisons=paired_comparisons, strategy_comparisons=strategy_comparisons,
        checks=dict(violations=[], checked_reports=len(checked),
            max_power_residual_wh=max(c['max_power_residual_wh'] for c in checked),
            max_thermal_residual_j=max(c['max_thermal_residual_j'] for c in checked)),
        source_sha256=source_sha256, limitations=LIMITATIONS)


def _csv_text(value):
    """Spreadsheet programs interpret formula prefixes even in quoted CSV cells."""
    text = str(value)
    return "'" + text if text.lstrip().startswith(('=', '+', '-', '@')) or text.startswith(('\t', '\r', '\n')) else text


def _export_rows(report):
    if not isinstance(report, dict) or report.get('schema_version') != SCHEMA_VERSION:
        raise ValueError('Expected a counterfactual campaign report')
    names = {variant['variant_id']:variant['name'] for variant in report['variants']}
    for row_type, section in (('summary', 'summary'), ('paired_variant_delta', 'paired_comparisons'),
            ('paired_strategy_delta', 'strategy_comparisons')):
        for row in report[section]:
            for metric, stats in row['metrics'].items():
                yield dict(row_type=row_type, variant_id=row['variant_id'], variant_name=names[row['variant_id']],
                    strategy=row['strategy'], reference_variant_id=row.get('reference_variant_id', ''),
                    reference_strategy=row.get('reference_strategy', ''), metric=metric, **stats,
                    successes=row.get('successes') if metric == 'mission_success' else None,
                    mission_success_ci95=row.get('mission_success_ci95') if metric == 'mission_success' else None)


def campaign_csv(report):
    """Export summaries and explicitly paired deltas; full reports stay in JSON."""
    output = io.StringIO(newline='')
    columns = ['campaign_id', 'row_type', 'variant_id', 'variant_name', 'strategy', 'reference_variant_id',
        'reference_strategy', 'metric', 'n', 'mean', 'sample_sd', 'ci95_low', 'ci95_high',
        'successes', 'mission_success_ci95_low', 'mission_success_ci95_high', 'seeds',
        'evaluation_criteria', 'data_provenance', 'model_validated_for_flight', 'limitations']
    writer = csv.DictWriter(output, fieldnames=columns)
    writer.writeheader()
    for row in _export_rows(report):
        ci = row.pop('ci95')
        wilson = row.pop('mission_success_ci95')
        row.update(campaign_id=report['campaign_id'], variant_name=_csv_text(row['variant_name']),
            ci95_low=ci[0] if ci is not None else None, ci95_high=ci[1] if ci is not None else None,
            mission_success_ci95_low=wilson[0] if wilson is not None else None,
            mission_success_ci95_high=wilson[1] if wilson is not None else None,
            seeds=json.dumps(report['seeds']), data_provenance='SYNTHETIC', model_validated_for_flight=False,
            evaluation_criteria=json.dumps(report['evaluation_criteria'],sort_keys=True),
            limitations=LIMITATIONS)
        writer.writerow(row)
    return output.getvalue()


def _markdown(value):
    text = str(value)
    for character in ('\\', '`', '*', '_', '{', '}', '[', ']', '<', '>', '#', '|'):
        text = text.replace(character, '\\' + character)
    return text.replace('\r', ' ').replace('\n', ' ')


def _number(value):
    return 'unavailable' if value is None else f'{value:.8g}'


def campaign_markdown(report):
    """Human-readable evidence tables with seed scope and comparison direction."""
    rows = list(_export_rows(report))
    lines = [f"# {_markdown(report['configuration']['name'])}", '',
        f"Campaign: `{report['campaign_id']}`. SYNTHETIC; not flight-qualified. Advisory only.", '',
        f"Paired noise seeds: {json.dumps(report['seeds'])}. Primary cases: {len(report['runs'])}.", '',
        'Common reference criteria for campaign mission_success: '
            f"`{json.dumps(report['evaluation_criteria'],sort_keys=True)}`.", '',
        LIMITATIONS, '']
    labels = {'summary':'Seed summaries', 'paired_variant_delta':'Paired variant minus reference',
        'paired_strategy_delta':'Paired strategy minus reference strategy'}
    for row_type, label in labels.items():
        section = [row for row in rows if row['row_type'] == row_type]
        if not section:
            continue
        lines += [f'## {label}', '',
            '| Variant | Strategy | Reference | Metric | n | Mean | Student-t 95% interval | Successes | Wilson 95% interval |',
            '| --- | --- | --- | --- | ---: | ---: | --- | ---: | --- |']
        for row in section:
            ci = row['ci95']; wilson = row['mission_success_ci95']
            reference = row['reference_variant_id'] or row['reference_strategy'] or '—'
            ci_text = 'unavailable' if ci is None else f'[{_number(ci[0])}, {_number(ci[1])}]'
            wilson_text = '—' if wilson is None else f'[{_number(wilson[0])}, {_number(wilson[1])}]'
            successes = '—' if row['successes'] is None else str(row['successes'])
            lines.append('| ' + ' | '.join([_markdown(row['variant_name']), row['strategy'], reference,
                _markdown(row['metric']), str(row['n']), _number(row['mean']), ci_text, successes, wilson_text]) + ' |')
        lines.append('')
    return '\n'.join(lines)
