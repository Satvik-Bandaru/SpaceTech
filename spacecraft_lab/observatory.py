"""Bounded synthetic observation agents, template analysis and ideal Grover research.

Independent of spacecraft dynamics and recovery authorization. No sensor, network,
LLM or quantum hardware interfaces exist here. Intensities and material templates
are deliberately fabricated teaching data, not calibrated optical measurements.
"""
import hashlib
import json
import math
import random


AGENTS = (
    ('widefield', 'Widefield Surveyor', 'Wide-field camera'),
    ('telescope', 'Precision Telescope', 'Narrow-field telescope'),
    ('infrared', 'Infrared Sentinel', 'Synthetic infrared imager'),
    ('spectrometer', 'Spectral Explorer', 'Eight-bin spectrometer'),
    ('transient', 'Transient Watch', 'Rapid-cadence camera'),
)
WAVELENGTHS = (450, 550, 650, 750, 900, 1100, 1400, 1700)
# Arbitrary dimensionless toy templates; names are hypotheses, not measurements.
TEMPLATES = (
    ('Silicate-like', (.22, .28, .39, .53, .44, .58, .64, .68)),
    ('Water-ice-like', (.78, .81, .82, .78, .71, .55, .18, .28)),
    ('Carbonaceous-like', (.10, .12, .14, .17, .20, .23, .25, .27)),
    ('Metal-like', (.38, .40, .42, .45, .48, .50, .53, .55)),
    ('Sulfate-like', (.68, .72, .73, .69, .64, .61, .44, .39)),
    ('Iron-oxide-like', (.12, .21, .47, .66, .71, .68, .64, .60)),
    ('Organic-like', (.19, .23, .27, .31, .37, .31, .28, .20)),
    ('Mixed/ambiguous', (.43, .47, .51, .56, .59, .57, .49, .45)),
)
LIMITATIONS = [
    'SYNTHETIC educational simulation; not flight-qualified and no real cameras, telescopes or spacecraft are connected.',
    'Novel means different from this run\'s two-entry toy catalog, not a confirmed astronomical discovery.',
    'Five agents run finite autonomous scan/detect/capture rules in a seeded batch; this is not a continuously running observatory.',
    'Images are 16×16 fabricated intensity maps. Eight-bin spectra and named material templates are invented, uncalibrated examples.',
    'Material similarity is an ambiguous hypothesis, not chemical identification, abundance or calibrated confidence. Real analysis needs calibrated spectra, uncertainty, controls and independent follow-up.',
    'The local analysis agent uses deterministic nearest-template rules, not a trained or externally connected language model.',
    'No diffraction, orbital pointing, telescope optics, detector response, exposure physics, photon noise, thermal infrared radiometry or real discovery catalog is modeled.',
    'Camera positions and amplitudes vary by instrument; all spectra share the same toy wavelength bins. The infrared image is illustrative, not an inferred temperature.',
]
QUANTUM_LIMITATIONS = [
    'Ideal three-qubit Grover amplitude amplification is simulated with classical real-valued state vectors; no quantum hardware is used.',
    'The oracle is constructed after classical template scoring. This does not provide a demonstrated computational speedup or deeper physical evidence.',
    'Measurement probabilities describe this toy circuit, not material confidence, chemical abundance, uncertainty or discovery significance.',
    'The circuit searches eight fabricated hypotheses for one explicitly identified captured spectrum; it cannot identify unknown substances outside that library.',
]


def _number(value, name, low, high, integer=False):
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not low <= value <= high or not math.isfinite(value)
            or (integer and not isinstance(value, int))):
        kind = 'integer' if integer else 'finite number'
        raise ValueError(f'{name} must be a {kind} from {low} to {high}')
    return value


def _config(config):
    if not isinstance(config, dict):
        raise ValueError('Observatory configuration must be an object')
    allowed = {'seed', 'steps', 'novelty_threshold', 'capture_budget', 'enabled_agents'}
    if set(config) - allowed:
        raise ValueError('Unknown observatory configuration field')
    enabled = config.get('enabled_agents', [a[0] for a in AGENTS])
    valid = {a[0] for a in AGENTS}
    if (not isinstance(enabled, list) or len(enabled) > 5
            or any(not isinstance(a, str) or a not in valid for a in enabled)
            or len(set(enabled)) != len(enabled)):
        raise ValueError('enabled_agents must be a unique list of the five supported agent IDs')
    return {
        'seed': _number(config.get('seed', 7), 'seed', 0, 2**31-1, True),
        'steps': _number(config.get('steps', 24), 'steps', 4, 120, True),
        'novelty_threshold': _number(config.get('novelty_threshold', .22), 'novelty_threshold', .02, 2),
        'capture_budget': _number(config.get('capture_budget', 12), 'capture_budget', 0, 120, True),
        'enabled_agents': [a[0] for a in AGENTS if a[0] in enabled],
    }


def grover_probabilities(scores, threshold):
    """Exact ideal 8-state phase oracle + inversion-about-mean iterations.

    Scores are classically obtained similarity values. No oracle cost advantage
    is asserted. Choose the nearest integer to the first ideal maximum, using
    the known number of marks, avoiding unnecessary oscillation.
    """
    if not isinstance(scores, (list, tuple)) or len(scores) != 8:
        raise ValueError('Grover demonstration requires exactly eight scores')
    values = [_number(v, 'score', 0, 1) for v in scores]
    _number(threshold, 'threshold', 0, 1)
    marked = [i for i, v in enumerate(values) if v >= threshold]
    iterations = 0
    if 0 < len(marked) < 8:
        theta = math.asin(math.sqrt(len(marked) / 8))
        # round(pi/(4 theta) - 1/2), with ties toward the larger integer.
        iterations = max(0, int(math.floor(math.pi / (4*theta))))
    state = [1/math.sqrt(8)] * 8
    for _ in range(iterations):
        for i in marked:
            state[i] = -state[i]
        mean = sum(state)/8
        state = [2*mean-amplitude for amplitude in state]
    return {'qubits': 3, 'iterations': iterations, 'marked_indices': marked,
            'probabilities': [amplitude*amplitude for amplitude in state]}


def _clip(value):
    return max(0., min(1., value))


def _measure(seed, agent_index, target, step):
    """Create toy maps, then extract the features actually used by detection."""
    rng = random.Random(seed*1000003 + agent_index*10007 + step*131 + 53)
    if target == 0:
        x, y, amplitude = .18, .19, .34
    elif target == 1:
        x, y, amplitude = .80, .20, .43
    else:
        angle = (target-2)*2*math.pi/10
        x = .50 + .32*math.cos(angle)
        y = .64 + .22*math.sin(angle)
        amplitude = .4 + .045*(target % 8)
    x = _clip(x + .006*agent_index)
    amplitude *= 1-.04*agent_index
    image = [[round(_clip(.012 + amplitude*math.exp(-((col/15-x)**2+(row/15-y)**2)/.009)
                         + rng.uniform(-.007, .007)), 6)
              for col in range(16)] for row in range(16)]
    weights = [[max(0, pixel-.025) for pixel in row] for row in image]
    total = sum(sum(row) for row in weights)
    cx = sum(v*col/15 for row in weights for col, v in enumerate(row))/total
    cy = sum(v*row_index/15 for row_index, row in enumerate(weights) for v in row)/total
    spectrum = [round(_clip(v + rng.uniform(-.018, .018)), 6)
                for v in TEMPLATES[target % 8][1]]
    # A deliberately mixed spectrum demonstrates ambiguity rather than certainty.
    if target == 11:
        spectrum = [round((a+b)/2, 6) for a, b in zip(spectrum, TEMPLATES[3][1])]
    features = [cx, cy, max(max(row) for row in image), sum(spectrum)/8]
    return image, spectrum, features


def _scores(spectrum):
    return [{'name': name, 'score': round(max(0, 1-math.sqrt(sum((a-b)**2 for a, b in zip(spectrum, template))/8)), 8)}
            for name, template in TEMPLATES]


def _quantum(observations):
    base = {'method': 'Ideal Grover state-vector simulation; classically scored oracle',
            'qubits': 3, 'iterations': 0, 'marked_candidates': [], 'probabilities': [],
            'classical_scores': [], 'limitations': list(QUANTUM_LIMITATIONS)}
    if not observations:
        return {**base, 'status': 'not_run', 'observation_id': None,
                'reason': 'No captured spectrum is available; no material inference was run.'}
    observation = observations[-1]
    scores = _scores(observation['spectrum']['reflectance'])
    threshold = max(s['score'] for s in scores)-.015
    result = grover_probabilities([s['score'] for s in scores], threshold)
    return {**base, 'status': 'complete', 'observation_id': observation['id'],
            'oracle_threshold': threshold, 'iterations': result['iterations'],
            'marked_candidates': [scores[i]['name'] for i in result['marked_indices']],
            'probabilities': [{'name': s['name'], 'probability': p}
                              for s, p in zip(scores, result['probabilities'])],
            'classical_scores': scores}


def run_observatory(config):
    """Run a reproducible finite scan loop; only novelty captures become evidence."""
    cfg = _config(config)
    digest = hashlib.sha256(json.dumps({'model': 'observatory-1.0', 'config': cfg},
                                      sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    observations, timeline, agents = [], [], []
    detected_candidates = 0
    for ordinal, (agent_id, name, instrument) in enumerate(AGENTS):
        enabled = agent_id in cfg['enabled_agents']
        agent = {'id': agent_id, 'name': name, 'instrument': instrument,
                 'status': 'complete' if enabled else 'disabled', 'scanned': 0,
                 'captures': 0, 'skipped_budget': 0}
        agents.append(agent)
        if not enabled:
            continue
        catalog = [_measure(cfg['seed'], ordinal, target, -1)[2] for target in (0, 1)]
        captured = set()
        for step in range(cfg['steps']):
            target = (step+ordinal*2) % 12
            target_id = f'T{target:03d}'
            image, spectrum, features = _measure(cfg['seed'], ordinal, target, step)
            novelty = min(math.sqrt(sum((a-b)**2 for a, b in zip(features, known))) for known in catalog)
            agent['scanned'] += 1
            event = {'time_seconds': step*60, 'agent_id': agent_id, 'target_id': target_id,
                     'novelty_score': round(novelty, 8)}
            if target_id in captured:
                event.update(event='already_captured', note='Target already recorded by this agent; duplicate capture suppressed.')
            elif novelty < cfg['novelty_threshold']:
                event.update(event='catalog_match', note='Measured features are within the configured toy-catalog novelty threshold.')
            else:
                detected_candidates += 1
                if agent['captures'] >= cfg['capture_budget']:
                    agent['skipped_budget'] += 1
                    event.update(event='budget_skipped', note='Novelty detected; per-agent capture budget exhausted. No evidence frame stored.')
                else:
                    captured.add(target_id)
                    catalog.append(features)
                    agent['captures'] += 1
                    event.update(event='captured', note='Measured novelty triggered an automatic synthetic intensity map and spectrum recording.')
                    observations.append({
                        'id': f'{agent_id}-{step:03d}', 'agent_id': agent_id, 'target_id': target_id,
                        'time_seconds': step*60, 'novelty_score': round(novelty, 8),
                        'trigger': 'Euclidean distance of measured centroid, peak intensity and mean toy reflectance to the nearest catalog entry',
                        'captured': True, 'source': 'SYNTHETIC', 'image': image,
                        'spectrum': {'wavelengths_nm': list(WAVELENGTHS), 'reflectance': spectrum},
                    })
            timeline.append(event)
    # Agent execution order must not be mistaken for observation chronology.
    observations.sort(key=lambda o: (o['time_seconds'], o['agent_id']))
    timeline.sort(key=lambda e: (e['time_seconds'], e['agent_id']))
    findings = []
    for observation in observations:
        candidates = sorted(_scores(observation['spectrum']['reflectance']), key=lambda c: (-c['score'], c['name']))[:3]
        findings.append({
            'observation_id': observation['id'], 'target_id': observation['target_id'],
            'explanation': f"Measured feature distance {observation['novelty_score']:.3f} exceeded {cfg['novelty_threshold']:.3f}; "
                           f"the nearest fabricated spectrum template is {candidates[0]['name']}. "
                           'The score is similarity only; mixed materials and unmodeled substances remain possible.',
            'material_candidates': candidates,
        })
    report = {
        'schema_version': 'observatory-1.0', 'run_id': digest,
        'config_sha256': digest, 'source': 'SYNTHETIC', 'model_validated_for_flight': False,
        'config': cfg, 'agents': agents, 'observations': observations, 'timeline': timeline,
        'metrics': {'scans': sum(a['scanned'] for a in agents), 'captures': len(observations),
                    'novel_targets': len({o['target_id'] for o in observations}),
                    'budget_skips': sum(a['skipped_budget'] for a in agents),
                    'detected_candidates': detected_candidates},
        'metric_definitions': {'novel_targets': 'Distinct synthetic target IDs with at least one captured observation across instruments.',
                               'detected_candidates': 'Novelty-threshold crossings before capture-budget admission; repeated uncaptured candidates may count again.',
                               'budget_skips': 'Individual exposures skipped after novelty detection because an agent exhausted its budget.'},
        'analysis': {'method': 'Local deterministic novelty and nearest-template analysis agent',
                     'summary': f'{len(observations)} synthetic observations recorded. Each material ranking is a toy-library hypothesis requiring independent follow-up.',
                     'findings': findings},
        'quantum': _quantum(observations), 'limitations': list(LIMITATIONS),
    }
    report['report_markdown'] = markdown(report)
    return report


def markdown(report):
    """Human-readable evidence report with reproducible inputs and honest limits."""
    lines = ['# Discovery Observatory — SYNTHETIC', '', f"Run: `{report['run_id']}`", '',
             'Not flight-qualified. No live sensors, spacecraft or quantum hardware are connected.', '',
             '## Reproducible configuration', '', '```json', json.dumps(report['config'], sort_keys=True, indent=2),
             '```', '', '## Recorded results', '', report['analysis']['summary'], '',
             '| Metric | Value |', '| --- | ---: |']
    lines.extend(f'| {key} | {value} |' for key, value in report['metrics'].items())
    lines.extend(['', '## Captured evidence', '', '| Observation | Time (s) | Target | Novelty | Nearest toy template |',
                  '| --- | ---: | --- | ---: | --- |'])
    by_id = {f['observation_id']: f for f in report['analysis']['findings']}
    for observation in report['observations']:
        candidate = by_id[observation['id']]['material_candidates'][0]
        lines.append(f"| {observation['id']} | {observation['time_seconds']} | {observation['target_id']} | "
                     f"{observation['novelty_score']:.4f} | {candidate['name']} ({candidate['score']:.4f} similarity) |")
    quantum = report['quantum']
    lines.extend(['', '## Quantum research demonstration', '', quantum['method'], '',
                  f"Status: {quantum['status']}; selected observation: {quantum['observation_id']}; iterations: {quantum['iterations']}.", ''])
    lines.extend(f'- {text}' for text in quantum['limitations'])
    lines.extend(['', '## Assumptions and limitations', ''])
    lines.extend(f'- {text}' for text in report['limitations'])
    lines.extend(['', 'Capture budgets are per agent. Duplicate targets already captured by the same agent are suppressed.',
                  'The finite batch completes before this report is returned; browser replay does not acquire live data.', ''])
    return '\n'.join(lines)
