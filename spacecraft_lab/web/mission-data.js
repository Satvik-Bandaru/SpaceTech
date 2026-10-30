(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MissionData = api;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const LIMITS = 'SYNTHETIC recorded simulation · coarse EPS, single-node thermal and pointing/link models · no propulsion model · not flight-qualified or certified.';
  const ROLES = {power: 'Power specialist', thermal: 'Thermal specialist', diagnostic: 'Diagnostic specialist',
    recovery: 'Recovery planner', commander: 'Mission commander', safety: 'Safety kernel', validation: 'Evidence validation'};
  const SUBSYSTEMS = [['eps', 'Electrical power'], ['thermal', 'Thermal'], ['comms', 'Communications'], ['attitude', 'Attitude']];
  const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
  const bool = value => typeof value === 'boolean' ? value : null;
  const str = value => typeof value === 'string' ? value.slice(0, 1000) : '';
  const words = value => str(value).replaceAll('_', ' ').toLowerCase();
  const list = value => Array.isArray(value) ? value : [];
  const strings = value => [...new Set(list(value).filter(v => typeof v === 'string').slice(0, 64).map(str))];
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const number = value => finite(value) === null ? 'unknown' : String(Math.round(value * 100) / 100);

  function context(report, index) {
    report = report && typeof report === 'object' ? report : {};
    const rows = list(report.telemetry).slice(0, 10000);
    const selected = rows.length ? clamp(Number.isFinite(index) ? Math.floor(index) : 0, 0, rows.length - 1) : -1;
    const row = rows[selected] || {};
    const now = finite(row.time_seconds);
    const configured = finite(report.config?.duration_seconds);
    const horizon = configured !== null && configured > 0 ? configured : finite(rows.at(-1)?.time_seconds);
    return {report, rows, index: selected, row, now, horizon, cfg: report.config || {}};
  }

  function statuses(row, cfg) {
    const soc = finite(row.battery_pct), unmet = finite(row.unserved_w), temp = finite(row.temperature_k);
    const pointing = finite(row.pointing_error_deg), link = bool(row.comms_up);
    const low = finite(cfg.low_temperature_k), high = finite(cfg.high_temperature_k);
    const alarms = strings(row.diagnosed_faults);
    const epsStatus = soc === null || unmet === null ? 'unknown' :
      soc < 25 || unmet > 1e-9 ? 'critical' : soc < 40 || alarms.some(a => ['solar_array_loss', 'battery_leak'].includes(a)) ? 'warning' : 'nominal';
    const thermalStatus = temp === null || low === null || high === null || low >= high ? 'unknown' :
      temp < low || temp > high ? 'critical' : alarms.includes('heater_stuck_on') ? 'warning' : 'nominal';
    const commsStatus = link === null ? 'unknown' : !link ? 'critical' : alarms.includes('comms_loss') ? 'warning' : 'nominal';
    const attitudeStatus = pointing === null ? 'unknown' : Math.abs(pointing) > 25 ? 'critical' :
      Math.abs(pointing) >= 10 || alarms.includes('attitude_fault') ? 'warning' : 'nominal';
    return [
      {id: 'eps', label: 'Electrical power', status: epsStatus,
        criterion: 'Critical: reserve <25% or unserved demand >0 W (1e-9 tolerance); caution: reserve <40% or power alarm.',
        detail: `${number(soc)}% battery · ${number(unmet)} W unserved`},
      {id: 'thermal', label: 'Thermal', status: thermalStatus,
        criterion: `Critical: temperature outside configured ${number(low)}–${number(high)} K; caution: confirmed heater alarm.`,
        detail: `${number(temp)} K · ${bool(row.heater_isolated) === null ? 'heater state unknown' : row.heater_isolated ? 'heater isolated' : 'heater connected'}`},
      {id: 'comms', label: 'Communications', status: commsStatus,
        criterion: 'Critical: recorded link down; caution: confirmed communications alarm with link up.',
        detail: link === null ? 'Link state unknown' : link ? 'Recorded link up' : 'Recorded link down'},
      {id: 'attitude', label: 'Attitude', status: attitudeStatus,
        criterion: 'Critical: absolute pointing error >25°; caution: error ≥10° or confirmed attitude alarm.',
        detail: `${number(pointing)}° pointing error · ${bool(row.redundant_adcs) === null ? 'actuator state unknown' : row.redundant_adcs ? 'redundant actuator' : 'primary actuator'}`}
    ];
  }

  function alerts(row, cfg) {
    const items = strings(row.diagnosed_faults).map(id => ({id, label: `Confirmed ${words(id)}`, severity: 'warning'}));
    const temp = finite(row.temperature_k), low = finite(cfg.low_temperature_k), high = finite(cfg.high_temperature_k);
    if (temp !== null && low !== null && temp < low) items.push({id: 'LOW_TEMPERATURE', label: `Temperature below ${number(low)} K`, severity: 'critical'});
    if (temp !== null && high !== null && temp > high) items.push({id: 'HIGH_TEMPERATURE', label: `Temperature above ${number(high)} K`, severity: 'critical'});
    if (finite(row.unserved_w) !== null && row.unserved_w > 1e-9) items.push({id: 'UNSERVED_POWER', label: `${number(row.unserved_w)} W unserved demand`, severity: 'critical'});
    return {total: items.length, critical: items.filter(a => a.severity === 'critical').length,
      warning: items.filter(a => a.severity === 'warning').length, items,
      criterion: 'Current unique confirmed alarms (warning), temperature outside configured limits or unserved demand >1e-9 W (critical).'};
  }

  function observedOutcome(decision, now) {
    const outcome = decision.observed_outcome;
    if (!outcome || finite(outcome.time_seconds) === null || outcome.time_seconds > now) return null;
    return {time_seconds: outcome.time_seconds, status: str(outcome.status), field: str(outcome.field),
      value: typeof outcome.value === 'boolean' || typeof outcome.value === 'string' ? outcome.value : finite(outcome.value),
      expected: typeof outcome.expected === 'boolean' || typeof outcome.expected === 'string' ? outcome.expected : finite(outcome.expected),
      interpretation: str(outcome.interpretation)};
  }

  function recordedExecution(report, decision, now, outcome) {
    if (decision.safety_check_result?.approved !== true) return 'REJECTED';
    if (outcome) return str(decision.execution_status) || 'APPROVED';
    const action = {REQUEST_SAFE_MODE: 'ENTER_SAFE_MODE', REQUEST_NORMAL_MODE: 'RETURN_TO_NORMAL'}[decision.action] || decision.action;
    const event = list(report.events).slice(0, 60000).some(e => e && e.event === action &&
      e.time_seconds === decision.time_seconds && finite(e.time_seconds) !== null && e.time_seconds <= now);
    return event ? 'EXECUTED' : 'APPROVED';
  }

  function visibleDecisions(ctx) {
    if (ctx.now === null) return [];
    return list(ctx.report.assurance?.decisions).slice(0, 256)
      .filter(d => d && finite(d.time_seconds) !== null && d.time_seconds <= ctx.now)
      .sort((a, b) => a.time_seconds - b.time_seconds);
  }

  function decisionView(ctx, decision) {
    const outcome = observedOutcome(decision, ctx.now);
    const approved = bool(decision.safety_check_result?.approved);
    return {proposal_id: str(decision.proposal_id), time_seconds: decision.time_seconds,
      source_agent: str(decision.source_agent), action: str(decision.action), reason: str(decision.reason),
      evidence: strings(decision.evidence),
      verification_result: {verified: bool(decision.verification_result?.verified), reasons: strings(decision.verification_result?.reasons)},
      safety_check_result: {approved, reasons: strings(decision.safety_check_result?.reasons)},
      execution_status: approved === null ? 'UNKNOWN' : recordedExecution(ctx.report, decision, ctx.now, outcome),
      observed_outcome: outcome};
  }

  function safety(ctx, decisions) {
    const views = decisions.map(d => decisionView(ctx, d));
    return {available: !!ctx.report.assurance, proposals: views.length,
      approved: views.filter(d => d.safety_check_result.approved === true).length,
      rejected: views.filter(d => d.safety_check_result.approved === false).length,
      executed: views.filter(d => d.execution_status === 'EXECUTED').length,
      outcomes_observed: views.filter(d => d.observed_outcome && !['NOT_OBSERVED', 'NOT_APPLIED'].includes(d.observed_outcome.status)).length,
      latest: views.slice(-5).reverse(),
      label: 'Recorded decisions at or before replay time; observed results appear only after their recorded timestamp.'};
  }

  function agents(ctx, decisions) {
    const audit = ctx.report.assurance;
    const finalSample = ctx.index >= 0 && ctx.index === ctx.rows.length - 1;
    const seen = new Set();
    return list(audit?.agents).slice(0, 7).filter(a => a && ROLES[a.agent_id] && !seen.has(a.agent_id) && seen.add(a.agent_id)).map(agent => {
      const id = agent.agent_id;
      let status = 'waiting', detail = 'No historical role evidence recorded by this replay time.', evidenceTime = null;
      const facts = decisions.filter(d => finite(d.evidence_state?.time_seconds) !== null && d.evidence_state.time_seconds <= ctx.now).at(-1)?.evidence_state;
      const finalEvidence = agent.last_evidence;
      const evidence = finalEvidence && finite(finalEvidence.time_seconds) !== null && finalEvidence.time_seconds <= ctx.now &&
        (!facts || finalEvidence.time_seconds >= facts.time_seconds) ? finalEvidence : facts;
      if (['power', 'thermal', 'diagnostic'].includes(id) && evidence) {
        status = 'recorded'; evidenceTime = evidence.time_seconds;
        if (id === 'power') {
          const pct = finite(evidence.battery_pct) ?? (finite(evidence.battery_wh) !== null && finite(evidence.battery_capacity_wh) > 0 ? 100 * evidence.battery_wh / evidence.battery_capacity_wh : null);
          detail = `Recorded evidence: battery ${number(pct)}%.`;
        } else if (id === 'thermal') detail = `Recorded evidence: ${number(finite(evidence.temperature_k))} K.`;
        else detail = `Recorded confirmed alarms: ${strings(evidence.confirmed_alarms || evidence.alarms).map(words).join(', ') || 'none'}.`;
      }
      let decision = null;
      if (id === 'recovery') decision = decisions.filter(d => d.source_agent === 'recovery').at(-1);
      if (id === 'commander') decision = decisions.at(-1);
      if (id === 'safety') decision = decisions.filter(d => d.safety_check_result && d.safety_check_result.kernel_status !== 'NOT_RUN').at(-1);
      if (id === 'validation') decision = decisions.filter(d => d.verification_result || observedOutcome(d, ctx.now)).at(-1);
      if (decision) {
        const view = decisionView(ctx, decision), outcome = view.observed_outcome;
        evidenceTime = decision.time_seconds;
        if (id === 'validation' && outcome) {
          evidenceTime = outcome.time_seconds; status = 'observed';
          detail = `${words(decision.action)}: recorded outcome ${words(outcome.status)}.`;
        } else {
          status = id === 'safety' ? view.safety_check_result.approved ? 'approved' : 'rejected' : 'recorded';
          detail = `${id === 'validation' ? 'Evidence check' : id === 'safety' ? 'Kernel decision' : 'Recorded proposal'}: ${words(decision.action)}${id === 'safety' ? ` · ${status}` : ''}.`;
        }
      }
      if (finalSample && status === 'waiting') {
        status = 'recorded'; detail = `Completed audit record: ${str(agent.status) || 'status unknown'}. Historical execution times are not recorded for this role.`;
      }
      return {id, label: ROLES[id], status, detail, evidence_time_seconds: evidenceTime,
        record_type: finalSample ? 'Completed deterministic audit' : 'Recorded deterministic audit replay',
        compute_units: finalSample ? finite(agent.compute_units) : null};
    });
  }

  function snapshot(report, index) {
    const ctx = context(report, index), row = ctx.row, decisions = visibleDecisions(ctx);
    return {index: ctx.index, sample_time_seconds: ctx.now, horizon_seconds: ctx.horizon,
      progress: ctx.now !== null && ctx.horizon > 0 ? clamp(ctx.now / ctx.horizon, 0, 1) : null,
      mode: str(row.mode) || 'unknown', operating_mode: str(row.operating_mode) || str(row.mode) || 'unknown',
      battery_pct: finite(row.battery_pct), temperature_k: finite(row.temperature_k), solar_w: finite(row.solar_w),
      served_w: finite(row.served_w), unserved_w: finite(row.unserved_w), comms_up: bool(row.comms_up),
      pointing_error_deg: finite(row.pointing_error_deg), sunlit: bool(row.sunlit), alarms: strings(row.diagnosed_faults),
      subsystems: statuses(row, ctx.cfg), agents: agents(ctx, decisions),
      agents_note: ctx.report.assurance ? 'Seven bounded deterministic roles · recorded audit, no live agents or LLM connection.' :
        'No assurance audit in this standard report. Run an approved mission-assurance experiment to inspect its deterministic role records.',
      safety: safety(ctx, decisions), alerts: alerts(row, ctx.cfg), limits: LIMITS};
  }

  function miniSeries(report, index, key, maxPoints = 48) {
    key = str(key);
    const ctx = context(report, index);
    const values = ctx.rows.slice(0, ctx.index + 1).filter(r => r && finite(r.time_seconds) !== null &&
      finite(r[key]) !== null && ctx.now !== null && r.time_seconds <= ctx.now)
      .map(r => ({time_seconds: r.time_seconds, value: r[key]}));
    const unit = key === 'battery_pct' ? '%' : key === 'temperature_k' ? 'K' : key.endsWith('_w') ? 'W' : key.endsWith('_deg') ? '°' : '';
    if (!values.length) return {key, unit, points: [], min: null, max: null, start_seconds: null, end_seconds: null, sample_count: 0};
    let low = Math.min(...values.map(p => p.value)), high = Math.max(...values.map(p => p.value));
    if (key === 'battery_pct') { low = Math.min(0, low); high = Math.max(100, high); }
    else if (key === 'temperature_k') {
      if (finite(ctx.cfg.low_temperature_k) !== null) low = Math.min(low, ctx.cfg.low_temperature_k);
      if (finite(ctx.cfg.high_temperature_k) !== null) high = Math.max(high, ctx.cfg.high_temperature_k);
    } else if (key.endsWith('_w')) low = Math.min(0, low);
    if (low === high) high = low + 1;
    const limit = clamp(Number.isFinite(maxPoints) ? Math.floor(maxPoints) : 48, 2, 240);
    let points = values;
    if (values.length > limit) {
      // Preserve the endpoints and bucket extrema, including short power excursions.
      points = [values[0]];
      const buckets = Math.floor((limit - 2) / 2);
      for (let b = 0; b < buckets; b++) {
        const start = 1 + Math.floor(b * (values.length - 2) / buckets);
        const end = 1 + Math.floor((b + 1) * (values.length - 2) / buckets);
        let min = start, max = start;
        for (let j = start + 1; j < end; j++) {
          if (values[j].value < values[min].value) min = j;
          if (values[j].value > values[max].value) max = j;
        }
        for (const j of [...new Set([min, max])].sort((a, b) => a - b)) points.push(values[j]);
      }
      points.push(values.at(-1));
    }
    return {key, unit, points, min: low, max: high, start_seconds: values[0].time_seconds,
      end_seconds: values.at(-1).time_seconds, sample_count: values.length};
  }

  function healthMatrix(report, index, count = 12) {
    const ctx = context(report, index), duration = ctx.horizon > 0 ? ctx.horizon : 0;
    const n = clamp(Number.isFinite(count) ? Math.floor(count) : 12, 1, 48);
    const bins = Array.from({length: n}, (_, i) => ({start_seconds: duration * i / n, end_seconds: duration * (i + 1) / n}));
    const rows = SUBSYSTEMS.map(([id, label]) => ({id, label, cells: bins.map(b => ({...b, status: 'unknown', samples: 0}))}));
    const rank = {unknown: 0, nominal: 1, warning: 2, critical: 3};
    if (duration) for (const row of ctx.rows.slice(0, ctx.index + 1)) {
      const t = finite(row?.time_seconds);
      if (t === null || ctx.now === null || t > ctx.now || t < 0 || t > duration) continue;
      const bin = clamp(Math.ceil(t / duration * n) - 1, 0, n - 1);
      statuses(row, ctx.cfg).forEach((subsystem, i) => {
        const cell = rows[i].cells[bin]; cell.samples++;
        if (rank[subsystem.status] > rank[cell.status]) cell.status = subsystem.status;
      });
    }
    return {bins, rows, now_seconds: ctx.now, duration_seconds: ctx.horizon,
      label: 'Worst measured subsystem status in each observed time bin; unobserved bins are unknown.'};
  }

  function timeline(report, index) {
    const ctx = context(report, index);
    const faults = list(ctx.cfg.faults).slice(0, 64).filter(f => f && finite(f.start_seconds) !== null && finite(f.duration_seconds) !== null)
      .map(f => ({kind: str(f.kind), start_seconds: Math.max(0, f.start_seconds),
        end_seconds: Math.min(ctx.horizon ?? Infinity, f.start_seconds + f.duration_seconds),
        severity: finite(f.severity) ?? 1, label: `Configured injection: ${words(f.kind)}`}));
    const transitions = list(ctx.report.events).slice(0, 60000)
      .filter(e => e && ['ENTER_SAFE_MODE', 'RETURN_TO_NORMAL'].includes(e.event) && finite(e.time_seconds) !== null && ctx.now !== null && e.time_seconds <= ctx.now)
      .map(e => ({time_seconds: e.time_seconds, mode: e.event === 'ENTER_SAFE_MODE' ? 'safe' : 'normal',
        label: `Recorded ${words(e.event)}`}));
    return {duration_seconds: ctx.horizon, now_seconds: ctx.now,
      progress: ctx.now !== null && ctx.horizon > 0 ? clamp(ctx.now / ctx.horizon, 0, 1) : null,
      faults, transitions, label: 'Configured injected fault schedule · recorded mode transitions'};
  }

  function events(report, index, maxEvents = 60) {
    const ctx = context(report, index);
    if (ctx.now === null) return [];
    const result = list(ctx.report.events).slice(0, 60000).filter(e => e && finite(e.time_seconds) !== null && e.time_seconds <= ctx.now)
      .map(e => ({time_seconds: e.time_seconds, event: str(e.event), label: words(e.event),
        note: str(e.note) || (e.fault ? words(e.fault) : strings(e.reasons).map(words).join(' · ')) ||
          (finite(e.attempt) !== null ? `Attempt ${e.attempt}` : 'Recorded controller event'),
        severity: e.event === 'ENTER_SAFE_MODE' ? 'critical' : e.event === 'FAULT_DETECTED' ? 'warning' : 'info', source: 'controller'}));
    for (const d of visibleDecisions(ctx)) if (d.safety_check_result?.approved === false) {
      const verificationRejected = d.safety_check_result.kernel_status === 'NOT_RUN';
      result.push({time_seconds: d.time_seconds, event: verificationRejected ? 'PROPOSAL_VERIFICATION_REJECTED' : 'SAFETY_KERNEL_REJECTED',
        label: verificationRejected ? 'proposal evidence rejected' : 'safety kernel rejected',
        note: `${words(d.action)} · ${strings(d.safety_check_result.reasons).map(words).join(' · ')}`,
        severity: 'warning', source: verificationRejected ? 'verification' : 'assurance'});
    }
    const limit = clamp(Number.isFinite(maxEvents) ? Math.floor(maxEvents) : 60, 1, 100);
    return result.sort((a, b) => b.time_seconds - a.time_seconds).slice(0, limit);
  }

  return Object.freeze({snapshot, miniSeries, healthMatrix, timeline, events});
});
