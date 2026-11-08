'use strict';
/* Presentation shell only. Existing controls and recorded reports remain authoritative. */
(() => {
  const byId = id => document.getElementById(id),
    overview = byId('overview');
  if (!overview || !window.MissionData) return;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const value = (n, d = 1) => Number.isFinite(n) ? n.toFixed(d) : '—';
  const stamp = n => Number.isFinite(n) ? `${String(Math.floor(n / 60)).padStart(2, '0') }:${String(Math.floor(n % 60)).padStart(2,
    '0') }` : '—';
  const words = s => String(s || 'unknown').replaceAll('_', ' ').toLowerCase();
  const iconPaths = {
    home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
    cube: 'm12 2 9 5v10l-9 5-9-5V7Zm0 0v20M3 7l9 5 9-5',
    chart: 'M3 3v18h18M6 15l4-6 4 4 6-9',
    bolt: 'm13 2-9 12h7l-1 8 10-13h-8Z',
    shield: 'm12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Zm-4 9 3 3 5-6',
    orbit: 'M21 10c2 5-3 11-9 11S1 16 3 10 14 1 19 4M3 21 21 3',
    play: 'm7 3 14 9-14 9Z',
    file: 'M5 2h9l5 5v15H5Zm9 0v6h5M8 12h8M8 16h8',
    compare: 'M4 4h6v16H4Zm10 4h6v12h-6',
    gear: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',
    layers: 'm12 2 10 6-10 6L2 8Zm-10 11 10 6 10-6M2 18l10 6 10-6',
    thermal: 'M10 14V4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0Zm2-7v10',
    radio: 'M9 14a4 4 0 1 1 6 0M6 17a8 8 0 1 1 12 0M12 12v10M8 22h8'
  };

  function icon(name) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.classList.add('mc-icon');
    const p = document.createElementNS(s.namespaceURI, 'path');
    p.setAttribute('d', iconPaths[name] || iconPaths.cube);
    s.append(p);
    return s;
  }

  function button(label, name, action, cls = 'button secondary') {
    const b = el('button', undefined, cls);
    b.append(icon(name), el('span', label));
    b.addEventListener('click', action);
    return b;
  }

  function jump(view, selector) {
    document.querySelector(`.nav[data-view="${view}"]:not([data-jump])`)?.click();
    if (selector) document.querySelector(selector)?.scrollIntoView({
      block: 'start',
      behavior: 'smooth'
    });
  }

  function panel(title, cls = '') {
    const p = el('article', undefined, `panel mc-card ${cls}`),
      head = el('div', undefined, 'mc-card-head');
    head.append(el('h2', title));
    p.append(head);
    return p;
  }

  function identity(n, id) {
    n.id = id;
    return n;
  }

  function pair(container, label, id) {
    const row = el('div', undefined, 'mc-data-pair');
    row.append(el('span', label), identity(el('strong', '—'), id));
    container.append(row);
  }

  const brand = document.querySelector('.brand');
  brand.replaceChildren(el('span', '✧', 'brandmark'), el('span', 'SRAI', 'mc-brand-name'));
  brand.lastChild.append(el('small', 'Spacecraft Reliability & Autonomy Lab'));
  document.querySelector('.rail-label').textContent = 'MISSION WORKSPACES';
  const navIcons = {
    overview: 'home',
    campaign: 'layers',
    comparison: 'compare',
    scenario: 'bolt',
    research: 'chart',
    assurance: 'shield',
    observatory: 'orbit'
  };
  document.querySelectorAll('.nav').forEach(b => {
    const text = b.textContent.trim().replace(/^[^\p{L}]+/u, '');
    b.replaceChildren(icon(b.dataset.jump === 'twin' ? 'cube' : b.dataset.jump === 'telemetry' ? 'chart' : b.dataset.jump === 'reports' ? 'file' : navIcons[b.dataset.view]),
      el('span', text));
    if (!b.dataset.jump) b.addEventListener('click', () => window.scrollTo({
      top: 0,
      behavior: 'instant'
    }));
    if (b.dataset.jump) b.addEventListener('click', () => {
      if (b.dataset.jump === 'twin') byId('view-3d').click();
      const targets = {
        twin: '.spacecraft-panel',
        systems: '#mc-system-health',
        telemetry: '.telemetry-panel',
        reports: '#campaign-history'
      };
      document.querySelector(targets[b.dataset.jump])?.scrollIntoView({
        block: 'start',
        behavior: 'smooth'
      });
    });
  });
  const navigation = document.querySelector('.rail').querySelector('nav');
  const navigationButtons = [...navigation.querySelectorAll('.nav')];
  const workspaces = el('div', undefined, 'mc-nav-workspaces');
  const shortcuts = el('div', undefined, 'mc-nav-shortcuts');
  const savedReports = el('div', undefined, 'mc-nav-reports');
  for (const b of navigationButtons) {
    (b.dataset.jump === 'reports' ? savedReports : b.dataset.jump ? shortcuts : workspaces).append(b);
    b.addEventListener('click', () => {
      for (const link of navigationButtons) link.setAttribute('aria-current',
        link.classList.contains('active') ? link.dataset.jump ? 'location' : 'page' : 'false');
    });
  }
  navigation.replaceChildren(workspaces, el('div', 'JUMP TO OVERVIEW', 'mc-nav-heading'), shortcuts,
    el('div', 'SAVED EXPERIMENTS', 'mc-nav-heading'), savedReports);
  const railNote = document.querySelector('.rail-note');
  railNote.replaceChildren(el('div', undefined, 'mc-orbit-thumb'), el('span', 'ACTIVE EXPERIMENT', 'tiny'),
    el('strong', 'Reference spacecraft'), identity(el('p', 'Awaiting recorded data'), 'mc-rail-context'));
  const railMeter = el('div', undefined, 'mc-progress');
  railMeter.append(identity(el('i'), 'mc-rail-progress'));
  railNote.append(railMeter, identity(el('small', 'Recorded simulation'), 'mc-rail-time'), el('p', 'Local research simulator\nSynthetic · no hardware link',
    'mc-rail-limit'));

  const header = document.querySelector('header'),
    modelVersion = byId('model-version'),
    run = byId('run'),
    exportRun = byId('export');
  header.replaceChildren();
  header.classList.add('mc-command-bar');
  const mission = el('div', undefined, 'mc-command-mission');
  mission.append(icon('cube'), el('div'));
  mission.lastChild.append(el('small', 'SPACECRAFT LAB'), identity(el('h1', 'Mission control'),
    'mc-mission-name'), identity(el('span', 'Local simulation · fixed seed'), 'mc-mission-context'));
  header.append(mission);

  function chip(caption, id, hint) {
    const c = el('div', undefined, 'mc-command-chip');
    c.append(el('small', caption), identity(el('strong', '—'), id), el('span', hint));
    header.append(c);
    return c;
  }
  chip('SPACECRAFT STATE', 'mc-state', 'Recorded operating label');
  chip('AUTONOMY', 'mc-autonomy', 'Deterministic controller');
  chip('SIMULATION TIME', 'mc-time', 'Elapsed · recorded replay');
  const alerts = button('— alarms', 'bolt', () => jump('overview', '.mc-alerts'), 'mc-command-alert');
  alerts.id = 'mc-alert-button';
  header.append(alerts);
  const actions = el('div', undefined, 'mc-command-actions');
  run.replaceChildren(icon('play'), el('span', 'Run scenario'));
  run.title = 'Run the current Scenario studio draft';
  exportRun.replaceChildren(icon('file'), el('span', 'Export report'));
  actions.append(run, button('Edit scenario', 'gear', () => {
    jump('scenario');
    byId('fault-kind').focus();
  }), exportRun);
  header.append(actions);
  const versionLabel = el('div', undefined, 'mc-version');
  versionLabel.append(modelVersion, el('span', 'LOCAL · SYNTHETIC'));
  document.querySelector('.disclaimer').append(versionLabel);

  overview.classList.add('mc-overview');
  const stats = overview.querySelector('.stats'),
    spacecraft = overview.querySelector('.spacecraft-panel'),
    eventPanel = overview.querySelector('.event-panel'),
    telemetry = overview.querySelector('.telemetry-panel');
  overview.querySelector('.console-grid').remove();
  overview.replaceChildren();
  const deck = el('div', undefined, 'mc-flight-deck'),
    main = el('div', undefined, 'mc-main-stack'),
    systems = el('div', undefined, 'mc-system-stack'),
    rail = el('aside', undefined, 'mc-agent-rail');
  spacecraft.classList.add('mc-viewport');
  spacecraft.querySelector('h2').textContent = 'Spacecraft digital twin';
  spacecraft.querySelector('.eyebrow').textContent = 'INTERACTIVE SPACECRAFT';
  const tabs = el('div', undefined, 'mc-view-tabs');
  const view3dButton = spacecraft.querySelector('#view-3d');
  const view2dButton = spacecraft.querySelector('#view-2d');
  view3dButton.replaceChildren(icon('cube'), el('span', '3D view'));
  view2dButton.replaceChildren(icon('layers'), el('span', '2D schematic'));
  view3dButton.className = view2dButton.className = 'button mc-view-tab';
  tabs.append(view3dButton, view2dButton);
  const labels = el('label', undefined, 'mc-label-switch'),
    check = el('input');
  check.type = 'checkbox';
  check.checked = true;
  check.setAttribute('aria-label', 'Show spacecraft labels');
  labels.append(check, el('span', 'Labels'));
  check.addEventListener('change', () => spacecraft.classList.toggle('mc-labels-hidden', !check.checked));
  tabs.append(labels);
  const inspection = spacecraft.querySelector('#inspection-tools');
  const modelChoice = inspection.querySelector('#inspection-model-field');
  modelChoice.classList.add('mc-model-choice');
  tabs.append(modelChoice);
  const inspectionSettings = el('details', undefined, 'mc-inspection-settings');
  inspectionSettings.append(el('summary', 'Inspection settings'), inspection);
  const cameraActions = el('div', undefined, 'mc-camera-actions');
  for (const id of ['inspection-reset', 'inspection-zoom-in', 'inspection-zoom-out']) {
    cameraActions.append(inspection.querySelector('#' + id));
  }
  const sceneHint = spacecraft.querySelector('#scene-hint');
  sceneHint.textContent = 'Drag to rotate · Ctrl + scroll to zoom';
  const tools = spacecraft.querySelector('.scene-toolbar');
  tools.replaceChildren(tabs, inspectionSettings);
  const syncView = () => {
    const is3d = !spacecraft.querySelector('#scene-3d').hidden;
    view3dButton.classList.toggle('active', is3d);
    view2dButton.classList.toggle('active', !is3d);
    view3dButton.setAttribute('aria-pressed', String(is3d));
    view2dButton.setAttribute('aria-pressed', String(!is3d));
    spacecraft.classList.toggle('mc-is-2d', !is3d);
    inspectionSettings.hidden = cameraActions.hidden = !is3d;
    modelChoice.hidden = !is3d;
    if (is3d) sceneHint.textContent = 'Drag to rotate · Ctrl + scroll to zoom';
  };
  view2dButton.addEventListener('click', syncView);
  view3dButton.addEventListener('click', syncView);
  syncView();
  const space = spacecraft.querySelector('.space-scene');
  space.classList.add('mc-orbital-scene');
  space.append(cameraActions);
  const guidance = el('div', undefined, 'mc-scene-guidance');
  guidance.append(sceneHint, el('span', 'Illustrative model · recorded simulation', 'mc-scene-provenance'));
  const modelInfo = el('details', undefined, 'mc-model-info');
  modelInfo.append(el('summary', 'Detailed telemetry & model assumptions'),
    spacecraft.querySelector('#subsystem-detail'), spacecraft.querySelector('.orbit-state'),
    spacecraft.querySelector('#inspection-legend'),
    el('p', 'Synthetic research model. One thermal node, prescribed illumination and simplified power/attitude/link behavior. Geometry and Earth scenery are illustrative; no flight certification.', 'mc-caption'));
  spacecraft.append(guidance, modelInfo);
  spacecraft.querySelectorAll('[data-subsystem]').forEach(control => {
    control.addEventListener('click', () => { modelInfo.open = true; });
  });
  const hud = el('div', undefined, 'mc-scene-hud');
  hud.append(el('span', 'REFERENCE SATELLITE', 'mc-hud-title'));
  pair(hud, 'Recorded mode', 'mc-hud-mode');
  pair(hud, 'Pointing error', 'mc-hud-pointing');
  pair(hud, 'Illumination', 'mc-hud-sun');
  modelInfo.append(hud);
  space.append(el('span', 'ILLUSTRATIVE SCENERY', 'mc-scene-caption'));
  const callouts = el('div', undefined, 'mc-callouts');
  for (const [key, label] of [['solar', 'Solar arrays'], ['battery', 'Battery pack'], ['thermal', 'Thermal node'],
    ['link', 'Antenna / link']]) {
    const item = el('div', undefined, `mc-callout mc-callout-${key}`);
    item.append(el('span', label), identity(el('strong', '—'), `mc-callout-${key}`));
    callouts.append(item);
  }
  space.append(callouts);
  const health = panel('Spacecraft health', 'mc-health');
  health.id = 'mc-system-health';
  const healthBody = el('div', undefined, 'mc-health-body'),
    ring = el('div', undefined, 'mc-health-ring');
  ring.id = 'mc-health-ring';
  ring.append(identity(el('strong', '—'), 'mc-health-count'), el('small', 'checks nominal'));
  healthBody.append(ring, identity(el('div', undefined, 'mc-health-list'), 'mc-health-list'));
  health.append(healthBody, el('p', 'Four explicit model checks · no inferred health probability', 'mc-caption'));
  const environment = panel('Environment & power', 'mc-environment');
  environment.id = 'mc-environment';
  const envData = el('div', undefined, 'mc-data-grid');
  pair(envData, 'Illumination', 'mc-env-light');
  pair(envData, 'Solar generation', 'mc-env-solar');
  pair(envData, 'Electrical demand', 'mc-env-demand');
  pair(envData, 'Cycle / eclipse', 'mc-env-cycle');
  environment.append(envData, el('p', 'Prescribed illumination cycle · no orbit propagation', 'mc-caption'));
  const state = panel('Attitude & communications', 'mc-attitude');
  const stateData = el('div', undefined, 'mc-data-grid');
  pair(stateData, 'Pointing error', 'mc-pointing-value');
  pair(stateData, 'Recorded link', 'mc-link-value');
  pair(stateData, 'Modeled actuator', 'mc-actuator-value');
  pair(stateData, 'Thermal node', 'mc-thermal-value');
  state.append(stateData);
  systems.append(environment, state);
  const flight = el('div', undefined, 'mc-flight-grid');
  flight.append(spacecraft, systems);
  main.append(flight);
  const mini = el('div', undefined, 'mc-mini-grid');
  const charts = {};
  for (const [id, title, metric, unit] of [['battery', 'Battery reserve', 'battery_pct', '%'], ['power', 'Solar generation & demand',
    'solar_w', 'W'], ['thermal', 'Thermal node', 'temperature_k', 'K']]) {
    const p = panel(title, 'mc-mini-card'),
      kpi = identity(el('strong', '—', 'mc-mini-value'), `mc-mini-${id}-value`),
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 330 125');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${title} through the current replay interval`);
    p.querySelector('.mc-card-head').append(kpi);
    p.append(svg);
    if (id === 'power') {
      const key = el('div', undefined, 'mc-chart-key');
      key.append(el('span', '● Solar generation'), el('span', '● Electrical demand'));
      p.append(key);
    }
    mini.append(p);
    charts[id] = {
      svg,
      metric,
      unit
    };
  }
  main.append(mini);
  const lower = el('div', undefined, 'mc-lower-grid'),
    timeline = panel('Mission timeline', 'mc-timeline');
  timeline.id = 'mc-timeline';
  timeline.append(identity(el('div', undefined, 'mc-timeline-body'), 'mc-timeline-body'), el('p', 'Configured fault injections · recorded mode transitions',
    'mc-caption'));
  const matrix = panel('System status history', 'mc-matrix');
  matrix.append(identity(el('div', undefined, 'mc-matrix-body'), 'mc-matrix-body'), el('p', 'Worst observed state per bin · future bins unknown',
    'mc-caption'));
  lower.append(timeline, matrix);
  main.append(lower);
  eventPanel.classList.add('mc-events');
  eventPanel.querySelector('h2').textContent = 'Recorded event log';
  main.append(eventPanel, telemetry);
  stats.classList.add('mc-original-stats');
  main.prepend(stats);
  const agentPanel = panel('Agents & decisions', 'mc-agents');
  agentPanel.querySelector('.mc-card-head').append(button('Full audit', 'shield', () => jump('assurance'),
    'mc-small-link'));
  agentPanel.append(identity(el('p', 'Recorded deterministic control', 'mc-caption'), 'mc-agent-note'), identity(el('div',
    undefined, 'mc-agent-list'), 'mc-agent-list'));
  const findings = panel('Decision inspector', 'mc-findings');
  const findingsTabs = el('div', undefined, 'mc-findings-tabs');
  let findingTab = 'findings';
  for (const [tab, title] of [['findings', 'Findings'], ['safety', 'Safety checks'], ['actions', 'Actions']]) {
    const b = el('button', title);
    b.dataset.tab = tab;
    b.setAttribute('aria-pressed', String(tab === findingTab));
    b.addEventListener('click', () => {
      findingTab = tab;
      findingsTabs.querySelectorAll('button').forEach(n => {
        n.classList.toggle('active', n === b);
        n.setAttribute('aria-pressed', String(n === b));
      });
      if (last) renderFindings(last.snapshot, last.report);
    });
    if (tab === findingTab) b.classList.add('active');
    findingsTabs.append(b);
  }
  findings.append(findingsTabs, identity(el('div', undefined, 'mc-findings-body'), 'mc-findings-body'), button('Open assurance workspace →',
    'shield', () => jump('assurance'), 'button secondary mc-audit-button'));
  const alertPanel = panel('Current alarms', 'mc-alerts');
  alertPanel.append(identity(el('div', undefined, 'mc-alert-list'), 'mc-alert-list'));
  rail.append(health, agentPanel, findings, alertPanel);
  deck.append(main, rail);
  overview.append(deck);
  const context = el('div', undefined, 'mc-replay-context');
  context.append(identity(el('span', 'RECORDED STATE'), 'mc-replay-context'), el('span', 'Geometry is illustrative · all values are synthetic simulation outputs'));
  overview.prepend(context);
  const transport = document.querySelector('.replay-top');
  const recordedSelection = identity(el('div', undefined, 'mc-recorded-selection'), 'mc-recorded-selection');
  recordedSelection.hidden = true;
  transport.prepend(recordedSelection);
  byId('policy').setAttribute('aria-label', 'Standard experiment strategy');
  let last = null,
    activated = false;
  const set = (id, text) => {
    byId(id).textContent = text;
  };

  function drawMini(svg, series, colors) {
    svg.replaceChildren();
    const ns = svg.namespaceURI,
      add = (tag, attrs) => {
      const n = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      svg.append(n);
      return n;
    },
      all = series.flatMap(s => s.points),
      end = Math.max(1, ...all.map(p => p.time_seconds)),
      low = Math.min(...series.map(s => s.min ?? 0)),
      high = Math.max(low + 1, ...series.map(s => s.max ?? 1)),
      x = t => 25 + t / end * 292,
      y = v => 94 - (v - low) / (high - low) * 76;
    for (let i = 0;i < 4;i++) {
      const v = low + (high - low) * i / 3;
      add('line', {
        x1: 25,
        x2: 318,
        y1: y(v),
        y2: y(v),
        stroke: '#183140'
      });
      const t = add('text', {
        x: 20,
        y: y(v) + 3,
        'text-anchor': 'end'
      });
      t.textContent = value(v, 0);
    }
    series.forEach((s, i) => {
      if (!s.points.length) return;
      const p = s.points.map(p => `${x(p.time_seconds) },${y(p.value) }`).join(' ');
      if (i === 0 && s.points.length > 1) add('polygon', {
        points: `${x(s.points[0].time_seconds) },94 ${p} ${x(s.points.at(-1).time_seconds) },94`,
        fill: colors[i],
        opacity: .09
      });
      add('polyline', {
        points: p,
        fill: 'none',
        stroke: colors[i],
        'stroke-width': 1.8
      });
      for (const point of s.points.filter((_, j) => j % Math.max(1, Math.floor(s.points.length / 8)) === 0)) add('circle',
        {
        cx: x(point.time_seconds),
        cy: y(point.value),
        r: 2,
        fill: colors[i]
      });
    });
    const a = add('text', {
      x: 25,
      y: 117
    }),
      b = add('text', {
      x: 318,
      y: 117,
      'text-anchor': 'end'
    });
    a.textContent = 'T+ 00:00';
    b.textContent = `T+ ${stamp(end) }`;
  }

  function renderAgents(s, report) {
    const list = byId('mc-agent-list');
    list.replaceChildren();
    const records = s.agents.length ? s.agents : [{
      id: 'power',
      label: 'Electrical power monitor',
      status: 'recorded',
      detail: s.subsystems[0].detail
    }, {
      id: 'thermal',
      label: 'Thermal monitor',
      status: 'recorded',
      detail: s.subsystems[1].detail
    }, {
      id: 'diagnostic',
      label: 'Fault diagnostics',
      status: 'recorded',
      detail: `Confirmed alarms: ${s.alarms.map(words).join(', ') || 'none'}.`
    }, {
      id: 'safety',
      label: 'Hard safety supervisor',
      status: 'recorded',
      detail: `Plant mode: ${words(s.mode) }. Existing protection remains active.`
    }];
    for (const a of records) {
      const c = el('article', undefined, `mc-agent mc-agent-${a.id}`),
        mark = el('span', undefined, 'mc-agent-icon');
      mark.append(icon(a.id === 'thermal' ? 'thermal' : a.id === 'power' ? 'bolt' : a.id === 'safety' ? 'shield' : a.id === 'recovery' ? 'gear' : 'cube'));
      const body = el('div'),
        heading = el('div', undefined, 'mc-agent-title');
      heading.append(el('strong', a.label), el('span', a.status, 'mc-tag ' + a.status));
      body.append(heading, el('p', a.detail));
      c.append(mark, body);
      list.append(c);
    }
    set('mc-agent-note', s.agents.length ? 'Seven deterministic roles · recorded audit replay' : 'Reference controllers · open Agent operations for an approved seven-role audit.');
  }

  function renderFindings(s, report) {
    const target = byId('mc-findings-body');
    target.replaceChildren();
    if (findingTab === 'safety') {
      for (const item of s.subsystems) {
        const p = el('article', undefined, 'mc-finding');
        p.append(el('strong', `${item.label} · ${item.status}`), el('p', item.criterion));
        target.append(p);
      }
      return;
    }
    const decisions = s.safety.latest;
    if (decisions.length) {
      for (const d of decisions) {
        const p = el('article', undefined, 'mc-finding ' + (d.safety_check_result.approved ? 'approved' : 'rejected'));
        p.append(el('small', `T+ ${stamp(d.time_seconds) } · ${d.source_agent}`), el('strong', words(d.action)),
          el('p', findingTab === 'actions' ? `${d.execution_status}${d.observed_outcome ? ' · ' + d.observed_outcome.status : ' · outcome not yet observed'}` : d.safety_check_result.reasons.map(words).join(' · ')));
        target.append(p);
      }
    } else {
      const events = MissionData.events(report, s.index, 3);
      for (const e of events) {
        const p = el('article', undefined, 'mc-finding');
        p.append(el('small', `T+ ${stamp(e.time_seconds) }`), el('strong', e.label), el('p', e.note));
        target.append(p);
      }
      if (!events.length) target.append(el('p', 'No controller events by this replay interval. Seek along the recorded timeline to inspect the response.',
        'mc-empty'));
    }
  }

  function renderTimeline(report, idx) {
    const data = MissionData.timeline(report, idx),
      target = byId('mc-timeline-body');
    target.replaceChildren();
    if (!data.faults.length) target.append(el('p', 'No injected fault episodes in this configuration.', 'mc-empty'));
    for (const fault of data.faults.slice(0, 5)) {
      const row = el('div', undefined, 'mc-timeline-row'),
        track = el('div', undefined, 'mc-timeline-track'),
        bar = el('i');
      row.append(el('span', words(fault.kind)));
      bar.style.left = `${100 * fault.start_seconds / data.duration_seconds}%`;
      bar.style.width = `${100 * Math.max(0, fault.end_seconds - fault.start_seconds) / data.duration_seconds}%`;
      bar.title = `${fault.label}: ${fault.start_seconds}–${fault.end_seconds} s`;
      track.append(bar);
      const cursor = el('b');
      cursor.style.left = `${100 * (data.progress || 0) }%`;
      track.append(cursor);
      row.append(track);
      target.append(row);
    }
    const modes = el('div', undefined, 'mc-mode-transitions');
    for (const transition of data.transitions.slice(-3)) modes.append(el('span', `${stamp(transition.time_seconds) } ${words(transition.mode) }`));
    target.append(modes);
  }

  function renderMatrix(report, idx) {
    const data = MissionData.healthMatrix(report, idx, 12),
      target = byId('mc-matrix-body');
    target.replaceChildren();
    for (const row of data.rows) {
      const line = el('div', undefined, 'mc-matrix-row');
      line.append(el('span', row.id.toUpperCase()));
      for (const cell of row.cells) {
        const n = el('i', undefined, cell.status);
        n.title = `${row.label}: ${cell.status}, ${stamp(cell.start_seconds) }–${stamp(cell.end_seconds) }, ${cell.samples} observed samples`;
        line.append(n);
      }
      target.append(line);
    }
  }

  function update(report, idx, options = {}) {
    const s = MissionData.snapshot(report, idx);
    syncView();
    const selectedName = String(options.label || report.strategy || report.policy || 'Recorded run');
    const hasSeed = selectedName.split('·').some(part => part.trim().toLowerCase() === `seed ${report.config.seed}`);
    const identityLabel = hasSeed ? selectedName : `${selectedName} · seed ${report.config.seed}`;
    const savedReplay = byId('policy').disabled === true;
    byId('policy').parentNode.hidden = savedReplay;
    recordedSelection.hidden = !savedReplay;
    recordedSelection.textContent = `${identityLabel} · saved replay`;
    last = {
      report,
      snapshot: s,
      idx,
      options
    };
    set('mc-state', words(s.operating_mode).toUpperCase());
    set('mc-autonomy', report.assurance ? 'Safety-gated rules' : 'Reference rules');
    set('mc-time', `T+ ${stamp(s.sample_time_seconds) }`);
    set('mc-mission-context', `${identityLabel} · ${stamp(s.horizon_seconds) } horizon`);
    set('mc-rail-context', `${words(s.operating_mode) } · ${options.label || report.strategy || report.policy}`);
    set('mc-rail-time', `T+ ${stamp(s.sample_time_seconds) } / ${stamp(s.horizon_seconds) }`);
    byId('mc-rail-progress').style.width = `${100 * (s.progress || 0) }%`;
    byId('mc-alert-button').lastChild.textContent = `${s.alerts.total} alarm${s.alerts.total === 1 ? '' : 's'}`;
    byId('mc-alert-button').classList.toggle('has-alerts', s.alerts.total > 0);
    set('mc-replay-context', `${options.playing ? '▶ REPLAYING' : 'Ⅱ PAUSED'} · ${String(options.label || report.strategy || report.policy).toUpperCase() } · RECORDED DATA`);
    set('mc-hud-mode', words(s.mode));
    set('mc-hud-pointing', `${value(s.pointing_error_deg) }°`);
    set('mc-hud-sun', s.sunlit === null ? 'Unknown' : s.sunlit ? 'Sunlit' : 'Eclipse');
    set('mc-callout-solar', `${value(s.solar_w) } W`);
    set('mc-callout-battery', `${value(s.battery_pct) }% SOC`);
    set('mc-callout-thermal', `${value(s.temperature_k) } K`);
    set('mc-callout-link', s.comms_up === null ? 'Unknown' : s.comms_up ? 'Link up' : 'Link down');
    const nominal = s.subsystems.filter(n => n.status === 'nominal').length;
    set('mc-health-count', `${nominal} / 4`);
    byId('mc-health-ring').style.setProperty('--health-angle', `${nominal * 90}deg`);
    const healthList = byId('mc-health-list');
    healthList.replaceChildren();
    for (const sub of s.subsystems) {
      const r = el('div', undefined, 'mc-health-status ' + sub.status);
      r.title = sub.criterion;
      r.append(el('span', sub.label), el('strong', sub.status));
      healthList.append(r);
    }
    set('mc-env-light', s.sunlit === null ? 'Unknown' : s.sunlit ? 'Sunlit' : 'Eclipse');
    set('mc-env-solar', `${value(s.solar_w) } W`);
    set('mc-env-demand', `${value(report.telemetry[idx].demand_w) } W`);
    set('mc-env-cycle', `${report.config.orbit_period_seconds} / ${report.config.eclipse_seconds} s`);
    set('mc-pointing-value', `${value(s.pointing_error_deg) }°`);
    set('mc-link-value', s.comms_up === null ? 'Unknown' : s.comms_up ? 'UP' : 'DOWN');
    set('mc-actuator-value', typeof report.telemetry[idx].redundant_adcs !== 'boolean' ? 'Unknown' : report.telemetry[idx].redundant_adcs ? 'Redundant' : 'Primary');
    set('mc-thermal-value', `${value(s.temperature_k) } K`);
    set('mc-mini-battery-value', `${value(s.battery_pct) }%`);
    set('mc-mini-power-value', `${value(s.solar_w, 0) } W`);
    set('mc-mini-thermal-value', `${value(s.temperature_k) } K`);
    drawMini(charts.battery.svg, [MissionData.miniSeries(report, idx, 'battery_pct')], ['#54dca4']);
    drawMini(charts.power.svg, [MissionData.miniSeries(report, idx, 'solar_w'), MissionData.miniSeries(report,
      idx, 'demand_w')], ['#62b7ff', '#f1b561']);
    drawMini(charts.thermal.svg, [MissionData.miniSeries(report, idx, 'temperature_k')], ['#ab8df3']);
    renderAgents(s, report);
    renderFindings(s, report);
    renderTimeline(report, idx);
    renderMatrix(report, idx);
    const alarms = byId('mc-alert-list');
    alarms.replaceChildren();
    if (!s.alerts.items.length) alarms.append(el('p', 'No confirmed alarms or temperature/power violations at this interval.',
      'mc-empty'));
    for (const a of s.alerts.items) {
      const n = el('div', a.label, 'mc-alert ' + a.severity);
      alarms.append(n);
    }
    if (!activated) {
      activated = true;
      byId('view-3d').click();
    }
  }
  window.MissionControl = Object.freeze({update, syncView});
  if (typeof current === 'function' && current()) update(current(), index, {
    playing,
    view3d,
    label: assuredReplay ? recordedReplayLabel : strategyName[byId('policy').value]
  });
})();
