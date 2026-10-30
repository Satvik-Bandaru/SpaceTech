'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const data = require('../spacecraft_lab/web/mission-data.js');

// These tests catch future-record leakage, threshold errors, fabricated records,
// distorted chart bounds, and mutation of the engine report.
const report = {
  config: {duration_seconds: 120, dt_seconds: 10, low_temperature_k: 260, high_temperature_k: 330,
    faults: [{kind: 'comms_loss', start_seconds: 60, duration_seconds: 30, severity: 1}]},
  telemetry: [
    {time_seconds: 10, interval_start_seconds: 0, mode: 'normal', operating_mode: 'NORMAL', battery_pct: 50,
      temperature_k: 290, solar_w: 140, served_w: 100, unserved_w: 0, comms_up: true,
      pointing_error_deg: 0, sunlit: true, diagnosed_faults: []},
    {time_seconds: 20, interval_start_seconds: 10, mode: 'safe', operating_mode: 'SAFE_MODE', battery_pct: 24,
      temperature_k: 331, solar_w: 30, served_w: 40, unserved_w: 5, comms_up: false,
      pointing_error_deg: 30, sunlit: true, diagnosed_faults: ['heater_stuck_on', 'heater_stuck_on']},
    {time_seconds: 120, interval_start_seconds: 110, mode: 'normal', operating_mode: 'NORMAL', battery_pct: 95,
      temperature_k: 295, solar_w: 9000, served_w: 120, unserved_w: 0, comms_up: true,
      pointing_error_deg: 0, sunlit: true, diagnosed_faults: []}
  ],
  events: [{time_seconds: 10, event: 'ENTER_SAFE_MODE', reasons: ['LOW_BATTERY']},
    {time_seconds: 20, event: 'ISOLATE_HEATER'}, {time_seconds: 90, event: 'RETURN_TO_NORMAL'}]
};

let snap = data.snapshot(report, 1);
assert.equal(snap.sample_time_seconds, 20);
assert.equal(snap.progress, 1 / 6);
assert.equal(snap.battery_pct, 24);
assert.equal(snap.temperature_k, 331);
assert.equal(snap.mode, 'safe');
assert.equal(snap.operating_mode, 'SAFE_MODE');
assert.deepEqual(snap.alarms, ['heater_stuck_on']);
assert.deepEqual(snap.subsystems.map(s => s.status), ['critical', 'critical', 'critical', 'critical']);
assert(snap.subsystems.every(s => s.criterion && s.detail));
assert.equal(snap.agents.length, 0);
assert.match(snap.agents_note, /assurance/i);
assert.equal(snap.alerts.total, 3);
assert.equal(snap.alerts.critical, 2);
assert.equal(snap.alerts.warning, 1);
assert.match(snap.limits, /synthetic/i);
assert.match(snap.limits, /flight/i);
assert.equal(Object.hasOwn(snap, 'health_pct'), false);

const series = data.miniSeries(report, 1, 'solar_w', 10);
assert.deepEqual(series.points.map(p => p.value), [140, 30]);
assert.equal(series.min, 0);
assert.equal(series.max, 140);
assert.equal(series.end_seconds, 20);
assert.equal(data.miniSeries(report, 0, 'battery_pct').min, 0);
assert.equal(data.miniSeries(report, 0, 'battery_pct').max, 100);
assert.equal(data.miniSeries(report, 1, 'temperature_k').min, 260);
assert.equal(data.miniSeries(report, 1, 'temperature_k').max, 331);
assert.equal(data.miniSeries(report, 1, 'missing').points.length, 0);

const matrix = data.healthMatrix(report, 0);
assert.equal(matrix.rows.length, 4);
assert(matrix.rows.every(r => r.cells.length === 12));
assert.equal(matrix.rows[0].cells.reduce((n, c) => n + c.samples, 0), 1);
assert(matrix.rows.every(r => r.cells.slice(1).every(c => c.status === 'unknown')));
assert.equal(matrix.rows[0].cells[0].status, 'nominal');
const timeline = data.timeline(report, 1);
assert.equal(timeline.duration_seconds, 120);
assert.equal(timeline.now_seconds, 20);
assert.equal(timeline.faults[0].start_seconds, 60);
assert.equal(timeline.faults[0].end_seconds, 90);
assert.match(timeline.label, /injected fault schedule/i);
assert(timeline.transitions.every(t => t.time_seconds <= 20));
assert(data.events(report, 1).every(e => e.time_seconds <= 20));

const audited = structuredClone(report);
audited.assurance = {
  agents: ['power', 'thermal', 'diagnostic', 'recovery', 'commander', 'safety', 'validation'].map(agent_id => ({
    agent_id, status: 'COMPLETE', compute_units: 900, last_evidence: {time_seconds: 110, secret_future: true}
  })),
  safety_summary: {proposals: 90, approved: 80, executed: 80},
  decisions: [
    {time_seconds: 10, source_agent: 'recovery', action: 'ISOLATE_HEATER', reason: 'Confirmed heater alarm',
      evidence_state: {time_seconds: 10, battery_wh: 80, battery_capacity_wh: 200, temperature_k: 329,
        alarms: ['heater_stuck_on']},
      verification_result: {verified: true, reasons: []}, safety_check_result: {approved: true, reasons: []},
      execution_status: 'EXECUTED', observed_outcome: {time_seconds: 20, field: 'heater_isolated', value: true, status: 'ACHIEVED'}},
    {time_seconds: 20, source_agent: 'recovery', action: 'REQUEST_NORMAL_MODE', reason: 'Early trial',
      safety_check_result: {approved: false, reasons: ['NORMAL_MODE_PRECONDITIONS']}, execution_status: 'REJECTED'},
    {time_seconds: 100, source_agent: 'power', action: 'REQUEST_SAFE_MODE', reason: 'FUTURE PROPOSAL',
      safety_check_result: {approved: true, reasons: []}, execution_status: 'EXECUTED',
      observed_outcome: {time_seconds: 110, status: 'ACHIEVED'}}
  ]
};
snap = data.snapshot(audited, 0);
assert.equal(snap.safety.proposals, 1);
assert.equal(snap.safety.approved, 1);
assert.equal(snap.safety.rejected, 0);
assert.equal(snap.safety.executed, 0);
assert.equal(snap.safety.outcomes_observed, 0);
assert.equal(snap.safety.latest[0].observed_outcome, null);
assert.equal(snap.safety.latest[0].execution_status, 'APPROVED');
assert.equal(snap.agents.length, 7);
assert(snap.agents.every(a => a.evidence_time_seconds === null || a.evidence_time_seconds <= 10));
assert(!JSON.stringify(snap).includes('secret_future'));
assert(!JSON.stringify(snap).includes('FUTURE PROPOSAL'));
assert(!JSON.stringify(snap.agents).includes('900'));
snap = data.snapshot(audited, 1);
assert.equal(snap.safety.proposals, 2);
assert.equal(snap.safety.rejected, 1);
assert.equal(snap.safety.executed, 1);
assert.equal(snap.safety.outcomes_observed, 1);
assert(data.events(audited, 1).some(e => e.event === 'SAFETY_KERNEL_REJECTED'));
assert(data.events(audited, 0).every(e => e.event !== 'SAFETY_KERNEL_REJECTED'));
const verificationRejected = structuredClone(audited);
verificationRejected.assurance.decisions[1].safety_check_result.kernel_status = 'NOT_RUN';
verificationRejected.assurance.decisions[1].verification_result = {verified: false, reasons: ['EVIDENCE_MISMATCH']};
assert(data.events(verificationRejected, 1).some(e => e.event === 'PROPOSAL_VERIFICATION_REJECTED'));
assert(!data.events(verificationRejected, 1).some(e => e.event === 'SAFETY_KERNEL_REJECTED'));

const empty = data.snapshot({}, 99);
assert.equal(empty.sample_time_seconds, null);
assert.equal(empty.battery_pct, null);
assert(empty.subsystems.every(s => s.status === 'unknown'));
assert.equal(empty.alerts.total, 0);
assert.equal(data.miniSeries({}, -1, 'solar_w').min, null);
assert.equal(data.miniSeries(report, 1).points.length, 0);
assert.equal(data.snapshot(report, -99).sample_time_seconds, 10);
assert.equal(data.snapshot(report, Infinity).sample_time_seconds, 10);
assert.equal(data.snapshot(report, 9999).sample_time_seconds, 120);
const many = {...report, telemetry: Array.from({length: 1000}, (_, i) => ({time_seconds: i + 1, solar_w: i % 71}))};
const bounded = data.miniSeries(many, 800, 'solar_w', 32);
assert(bounded.points.length <= 32);
assert.equal(bounded.points[0].time_seconds, 1);
assert.equal(bounded.points.at(-1).time_seconds, 801);
assert.equal(bounded.sample_count, 801);

function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); }
  return value;
}
freeze(audited);
const before = JSON.stringify(audited);
data.snapshot(audited, 1); data.miniSeries(audited, 1, 'solar_w'); data.healthMatrix(audited, 1);
data.timeline(audited, 1); data.events(audited, 1);
assert.equal(JSON.stringify(audited), before);

if (process.argv.includes('--engine-reports')) {
  const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
  for (const engine of [payload.standard, payload.assured]) {
    const original = JSON.stringify(engine);
    for (const i of [0, 2, Math.floor(engine.telemetry.length / 2), engine.telemetry.length - 1]) {
      const row = engine.telemetry[i], current = data.snapshot(engine, i);
      assert.equal(current.sample_time_seconds, row.time_seconds);
      assert.equal(current.battery_pct, row.battery_pct);
      assert.equal(current.temperature_k, row.temperature_k);
      assert.equal(current.solar_w, row.solar_w);
      assert.equal(current.comms_up, row.comms_up);
      assert.deepEqual(current.alarms, row.diagnosed_faults);
      assert(data.miniSeries(engine, i, 'solar_w').points.every(p => p.time_seconds <= row.time_seconds));
      assert(data.events(engine, i).every(e => e.time_seconds <= row.time_seconds));
      assert(data.timeline(engine, i).transitions.every(t => t.time_seconds <= row.time_seconds));
      if (engine.assurance) {
        assert.equal(current.safety.proposals, engine.assurance.decisions.filter(d => d.time_seconds <= row.time_seconds).length);
        assert(current.safety.latest.every(d => !d.observed_outcome || d.observed_outcome.time_seconds <= row.time_seconds));
      }
    }
    assert.equal(JSON.stringify(engine), original);
  }
  const last = data.snapshot(payload.assured, payload.assured.telemetry.length - 1);
  assert.equal(last.agents.length, 7);
  assert.equal(last.safety.proposals, payload.assured.assurance.safety_summary.proposals);
  assert.equal(last.safety.rejected, payload.assured.assurance.safety_summary.rejected);
  assert.equal(last.safety.executed, payload.assured.assurance.safety_summary.executed);
}
console.log('Mission instrumentation: measured telemetry, replay evidence bounds, histories and report immutability passed');
