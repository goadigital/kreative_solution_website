/* =========================================================
   KREATIVE SOLUTION — ISO 9001:2026 Gap Assessment app
   Three sections: Organisation details, Check points, History.
   Reports are saved on this device (localStorage).
   Needs ISO_CLAUSES (js/iso9001-clauses.js) and a #ga-app element.
   Optional window.GA_CONFIG overrides the defaults below.
   ========================================================= */

(() => {
  'use strict';

  const CFG = Object.assign({
    canPrint: true,
    canDownload: true,
    seedExamples: false,
    storageKey: 'ks-iso9001-2026-reports-v2',
    legacyKey: 'ks-iso9001-2026-gap-v1'
  }, window.GA_CONFIG || {});

  const STATUS = { C: 'Compliant', NC: 'Non-compliant', NA: 'Not applicable' };

  const MODES = {
    full: {
      label: 'Complete gap assessment',
      desc: 'Every ISO 9001:2026 requirement, clauses 4 to 10.'
    },
    changes: {
      label: 'Gap assessment – new 2026 requirements only',
      desc: 'Only what is new or changed since ISO 9001:2015. For organisations already certified to the 2015 version.'
    },
    internal: {
      label: 'Internal audit',
      desc: 'Audit one process, such as Production or Purchasing, against the clauses that apply to it.'
    }
  };

  const GROUP_TITLES = {
    '4.1': 'Organization and its context', '4.2': 'Interested parties', '4.3': 'Scope of the QMS',
    '4.4': 'QMS and its processes', '5.1.1': 'Leadership and commitment', '5.1.2': 'Customer focus',
    '5.2': 'Quality policy', '5.3': 'Roles and responsibilities', '6.1.1': 'Determining risks and opportunities',
    '6.1.2': 'Actions to address risks', '6.1.3': 'Actions to address opportunities', '6.2': 'Quality objectives',
    '6.3': 'Planning of changes', '7.1.1': 'Resources', '7.1.2': 'People', '7.1.3': 'Infrastructure',
    '7.1.4': 'Work environment', '7.1.5': 'Measuring equipment and calibration', '7.1.6': 'Organizational knowledge',
    '7.2': 'Competence', '7.3': 'Awareness', '7.4': 'Communication', '7.5': 'Documented information',
    '8.1': 'Operational planning and control', '8.2.1': 'Customer communication', '8.2.2': 'Determining requirements',
    '8.2.3': 'Review of requirements', '8.3': 'Design and development', '8.4': 'External providers',
    '8.5.1': 'Control of production', '8.5.2': 'Identification and traceability', '8.5.3': 'Customer and supplier property',
    '8.5.4': 'Preservation', '8.5.5': 'Post-delivery activities', '8.5.6': 'Control of changes',
    '8.6': 'Release of products', '8.7': 'Nonconforming outputs', '9.1.1': 'Monitoring and measurement',
    '9.1.2': 'Customer satisfaction', '9.1.3': 'Analysis and evaluation', '9.2': 'Internal audit',
    '9.3': 'Management review', '10.1': 'Continual improvement', '10.2': 'Nonconformity and corrective action'
  };

  // Suggested clauses for common manufacturing processes (internal audit).
  const PRESETS = {
    'Top management': ['4.1', '4.2', '4.3', '4.4', '5.1.1', '5.1.2', '5.2', '5.3', '6.1.1', '6.1.2', '6.1.3', '6.2', '6.3', '7.1.1', '9.3', '10.1'],
    'Sales and customer service': ['5.1.2', '8.2.1', '8.2.2', '8.2.3', '8.5.5', '9.1.2', '7.2', '7.3', '7.5', '10.2'],
    'Design and development': ['8.3', '7.1.6', '6.1.2', '7.2', '7.5', '10.2'],
    'Purchasing': ['8.4', '6.1.2', '6.2', '7.2', '7.3', '7.5', '9.1.3', '10.2'],
    'Stores': ['8.5.2', '8.5.3', '8.5.4', '7.1.3', '7.2', '7.5'],
    'Production': ['8.1', '8.5.1', '8.5.2', '8.5.4', '8.5.6', '8.7', '7.1.3', '7.1.4', '7.2', '7.3', '6.2', '10.2'],
    'Quality control and inspection': ['7.1.5', '8.5.2', '8.6', '8.7', '9.1.1', '9.1.3', '7.2', '10.2'],
    'Maintenance': ['7.1.3', '7.1.4', '6.2', '7.2', '7.5'],
    'HR and training': ['5.3', '7.1.2', '7.2', '7.3', '7.4'],
    'Dispatch and logistics': ['8.5.2', '8.5.4', '8.5.5', '8.6', '7.5'],
    'Quality system (QMS)': ['4.4', '6.3', '7.5', '9.1.1', '9.2', '9.3', '10.1', '10.2']
  };

  const META_FIELDS = ['orgName', 'site', 'scope', 'employees', 'auditor', 'auditee', 'date', 'ref'];

  const ITEMS = ISO_CLAUSES.flatMap(c => c.items.map(i => ({ ...i, clause: c.num, group: i.id.split('-')[0] })));
  const GROUPS = [...new Set(ITEMS.map(i => i.group))];
  const CHANGE_COUNT = ITEMS.filter(i => i.change).length;

  const ICONS = {
    org: '<path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 9h5a1 1 0 0 1 1 1v11M3 21h18M8 8h2M8 12h2M8 16h2M17 13h0M17 17h0"/>',
    check: '<path d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 3"/>'
  };

  /* ---------- Helpers ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  function el(tag, attrs = {}, kids = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    [].concat(kids).forEach(k => k != null && k !== false && n.append(k));
    return n;
  }

  const badge = type => el('span', { class: `ga-badge ${type === 'New' ? 'ga-badge-new' : 'ga-badge-mod'}`, text: type });
  const uid = () => `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const today = () => new Date().toISOString().slice(0, 10);

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtTime(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  /* ---------- Data ---------- */
  let db = { reports: [], currentId: null };
  let view = 'org';
  let reportId = null;

  function blankReport() {
    const now = new Date().toISOString();
    return { id: uid(), createdAt: now, updatedAt: now, mode: 'full', process: '', clauses: [], meta: { date: today() }, answers: {} };
  }

  const current = () => db.reports.find(r => r.id === db.currentId) || null;
  const byId = id => db.reports.find(r => r.id === id) || null;
  const isEmpty = r => !(r.meta.orgName || '').trim() && !Object.keys(r.answers).length;

  function itemsFor(r) {
    if (r.mode === 'changes') return ITEMS.filter(i => i.change);
    if (r.mode === 'internal') return ITEMS.filter(i => r.clauses.includes(i.group));
    return ITEMS;
  }

  function counts(r, items = itemsFor(r)) {
    const c = { C: 0, NC: 0, NA: 0, open: 0, total: items.length };
    items.forEach(i => {
      const s = (r.answers[i.id] || {}).status;
      if (s in STATUS) c[s]++; else c.open++;
    });
    return c;
  }

  function typeLabel(r) {
    return r.mode === 'internal' && r.process ? `Internal audit – ${r.process}` : MODES[r.mode].label;
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(CFG.storageKey); } catch (e) { /* storage blocked */ }
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (Array.isArray(d.reports)) db = { reports: d.reports.filter(validReport), currentId: d.currentId || null };
      } catch (e) { /* corrupt — start fresh */ }
    } else {
      migrateLegacy();
      if (!db.reports.length && CFG.seedExamples) seedExamples();
    }
    if (!current()) newReport();
  }

  function validReport(r) {
    return r && typeof r.id === 'string' && r.meta && typeof r.meta === 'object' && r.answers && typeof r.answers === 'object' && MODES[r.mode];
  }

  function migrateLegacy() {
    try {
      const old = JSON.parse(localStorage.getItem(CFG.legacyKey) || 'null');
      if (!old || !(old.answers || old.meta)) return;
      const r = blankReport();
      r.meta = { ...r.meta, ...(old.meta || {}) };
      r.answers = old.answers || {};
      if (!isEmpty(r)) { db.reports.push(r); db.currentId = r.id; }
    } catch (e) { /* nothing to migrate */ }
  }

  function seedExamples() {
    const a = blankReport();
    a.createdAt = a.updatedAt = '2026-10-07T10:30:00.000Z';
    a.meta = { orgName: 'Example: Acme Precision Components Pvt Ltd', site: 'Verna Industrial Estate, Goa', scope: 'Machined and fabricated steel components', employees: '120', auditor: 'Example auditor', auditee: 'Quality Manager', date: '2026-10-07', ref: 'GAP-2026-01' };
    a.answers = {
      '4.1-a': { status: 'C', notes: 'Context register reviewed in last management review.' },
      '4.1-b': { status: 'NC', notes: 'Climate change not considered in the context register.' },
      '4.2-a': { status: 'C', notes: 'Interested party register available.' },
      '5.1.1-c': { status: 'NC', notes: 'No code of conduct or way to raise quality concerns safely.' },
      '6.1.3-a': { status: 'NC', notes: 'Risk register lists only risks; opportunities not evaluated.' },
      '7.1.5-b': { status: 'C', notes: 'All gauges calibrated by NABL lab; labels current.' },
      '8.3-a': { status: 'NA', notes: 'Build-to-print supplier; all designs supplied by customer.' }
    };
    const b = blankReport();
    b.createdAt = b.updatedAt = '2026-09-15T09:00:00.000Z';
    b.mode = 'internal';
    b.process = 'Purchasing';
    b.clauses = PRESETS.Purchasing.slice();
    b.meta = { orgName: 'Example: Acme Precision Components Pvt Ltd', site: 'Verna Industrial Estate, Goa', auditor: 'Example auditor', auditee: 'Purchase Manager', date: '2026-09-15', ref: 'IA-2026-07' };
    itemsFor(b).forEach((i, n) => { b.answers[i.id] = { status: n === 3 ? 'NC' : 'C', notes: n === 3 ? 'Two suppliers not re-evaluated this year.' : '' }; });
    db.reports.push(a, b);
    db.currentId = a.id;
  }

  let saveTimer;
  function save(touch = true) {
    const r = current();
    if (touch && r) r.updatedAt = new Date().toISOString();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(CFG.storageKey, JSON.stringify(db));
        if (touch) toast('Saved on this device');
      } catch (e) {
        toast('Could not save: this browser is blocking storage');
      }
    }, 250);
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#ga-toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function newReport() {
    const keep = db.reports.filter(r => !isEmpty(r));
    const r = blankReport();
    db.reports = [r, ...keep];
    db.currentId = r.id;
    save(false);
    return r;
  }

  /* ---------- Shell ---------- */
  function shell() {
    const tab = (v, label) => `<button type="button" class="ga-tab" data-view="${v}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[v]}</svg><span>${label}</span></button>`;
    const modeCard = (key) => `
      <label class="ga-mode">
        <input type="radio" name="mode" value="${key}" id="mode-${key}">
        <span class="ga-mode-title">${MODES[key].label}</span>
        <span class="ga-mode-desc">${MODES[key].desc}</span>
        <span class="ga-mode-count">${key === 'full' ? `${ITEMS.length} check points` : key === 'changes' ? `${CHANGE_COUNT} check points` : 'You choose the process'}</span>
      </label>`;

    return `
      <nav class="ga-tabs" aria-label="Sections">
        ${tab('org', 'Organisation details')}${tab('check', 'Check points')}${tab('history', 'History')}
      </nav>
      <div id="ga-toast" class="ga-toast" role="status" aria-live="polite"></div>

      <section class="ga-panel" data-panel="org" aria-labelledby="ga-org-h">
        <div class="ga-head">
          <div><h1 class="ga-h1" id="ga-org-h">Organisation details</h1><p class="ga-sub" id="ga-org-sub"></p></div>
          <button type="button" class="ga-btn" data-action="new">+ New report</button>
        </div>

        <form id="ga-org-form" class="ga-card" autocomplete="off" novalidate>
          <h2 class="ga-h2">Organisation</h2>
          <div class="ga-grid">
            <label class="ga-field ga-span-2"><span>Organisation name <b class="ga-req">required</b></span><input id="f-orgName" name="orgName" autocomplete="organization"></label>
            <label class="ga-field"><span>Site / address</span><input id="f-site" name="site"></label>
            <label class="ga-field"><span>Number of employees</span><input id="f-employees" name="employees" inputmode="numeric"></label>
            <label class="ga-field ga-span-2"><span>Products / scope</span><input id="f-scope" name="scope" placeholder="e.g. Machined and fabricated steel components"></label>
          </div>
          <h2 class="ga-h2">Audit</h2>
          <div class="ga-grid">
            <label class="ga-field"><span>Auditor name <b class="ga-req">required</b></span><input id="f-auditor" name="auditor" autocomplete="name"></label>
            <label class="ga-field"><span>Auditee / contact person</span><input id="f-auditee" name="auditee"></label>
            <label class="ga-field"><span>Audit date</span><input id="f-date" name="date" type="date"></label>
            <label class="ga-field"><span>Reference no.</span><input id="f-ref" name="ref"></label>
          </div>
        </form>

        <section class="ga-card" aria-labelledby="ga-mode-h">
          <h2 class="ga-h2" id="ga-mode-h">What do you want to do?</h2>
          <div class="ga-modes" role="radiogroup" aria-labelledby="ga-mode-h">
            ${modeCard('full')}${modeCard('changes')}${modeCard('internal')}
          </div>

          <div id="ga-internal" class="ga-internal" hidden>
            <label class="ga-field"><span>Process being audited <b class="ga-req">required</b></span>
              <input id="f-process" placeholder="Choose below or type your own process name"></label>
            <div class="ga-presets" id="ga-presets" aria-label="Common processes"></div>
            <div class="ga-chip-head">
              <strong>Clauses to audit</strong>
              <span id="ga-clause-count" class="ga-muted"></span>
              <span class="ga-chip-actions">
                <button type="button" class="ga-link" id="ga-all">Select all</button>
                <button type="button" class="ga-link" id="ga-none">Clear</button>
              </span>
            </div>
            <div id="ga-chips"></div>
          </div>
        </section>

        <div class="ga-cta">
          <p id="ga-org-error" class="ga-error" role="alert" hidden></p>
          <button type="button" class="ga-btn ga-primary ga-big" id="ga-go-check">Continue to check points →</button>
        </div>
      </section>

      <section class="ga-panel" data-panel="check" aria-labelledby="ga-check-h" hidden>
        <div id="ga-check-empty" class="ga-empty" hidden>
          <h1 class="ga-h1">No report open</h1>
          <p>Fill in the organisation details and choose what you want to do. The check points appear here.</p>
          <button type="button" class="ga-btn ga-primary ga-big" data-goto="org">Fill in organisation details</button>
        </div>
        <div id="ga-check-main">
          <div class="ga-head">
            <div><h1 class="ga-h1" id="ga-check-h"></h1><p class="ga-sub" id="ga-check-sub"></p></div>
            <button type="button" class="ga-btn" data-goto="org">Edit details</button>
          </div>
          <div class="ga-bar">
            <div class="ga-progress">
              <div class="ga-track"><span id="ga-fill"></span></div>
              <span id="ga-progress-text"></span>
            </div>
            <label class="ga-filter"><span class="ga-sr">Show</span>
              <select id="ga-filter">
                <option value="all">Show all</option>
                <option value="open">Not answered yet</option>
                <option value="nc">Non-compliant only</option>
                <option value="changes">New 2026 requirements</option>
              </select>
            </label>
          </div>
          <div id="ga-checklist"></div>
          <p id="ga-filter-empty" class="ga-empty-inline" hidden>Nothing to show for this filter.</p>
          <div class="ga-cta">
            <button type="button" class="ga-btn ga-primary ga-big" id="ga-view-current">View report</button>
          </div>
        </div>
      </section>

      <section class="ga-panel" data-panel="history" aria-labelledby="ga-history-h" hidden>
        <div class="ga-head">
          <div><h1 class="ga-h1" id="ga-history-h">History</h1><p class="ga-sub">Reports saved on this device, newest first.</p></div>
          <button type="button" class="ga-btn ga-primary" data-action="new">+ New report</button>
        </div>
        <div id="ga-history-list" class="ga-history"></div>
        <div id="ga-history-empty" class="ga-empty" hidden>
          <h2 class="ga-h2">No reports yet</h2>
          <p>Reports you start are saved here automatically.</p>
          <button type="button" class="ga-btn ga-primary ga-big" data-action="new">Start a new report</button>
        </div>
        <div class="ga-backup">
          <p class="ga-muted">Reports are kept in this browser only. Clearing browser data deletes them.</p>
          <div class="ga-backup-actions">
            ${CFG.canDownload ? '<button type="button" class="ga-btn" id="ga-backup">Save a backup file</button>' : ''}
            <button type="button" class="ga-btn" id="ga-restore">Restore from backup file</button>
            <input type="file" id="ga-restore-file" accept="application/json,.json" hidden>
          </div>
        </div>
      </section>

      <section class="ga-panel" data-panel="report" aria-label="Report" hidden>
        <div class="ga-head ga-noprint">
          <button type="button" class="ga-btn" data-goto="history">← History</button>
          <div class="ga-report-actions">
            <button type="button" class="ga-btn" id="ga-report-edit">Edit report</button>
            ${CFG.canPrint ? '<button type="button" class="ga-btn ga-primary" id="ga-print">Print / Save PDF</button>' : ''}
          </div>
        </div>
        <article id="ga-report" class="ga-report"></article>
      </section>`;
  }

  /* ---------- Navigation ---------- */
  function show(v) {
    view = v;
    $$('.ga-panel').forEach(p => { p.hidden = p.dataset.panel !== v; });
    $$('.ga-tab').forEach(t => {
      const active = t.dataset.view === v || (v === 'report' && t.dataset.view === 'history');
      t.classList.toggle('active', active);
      if (active) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    if (v === 'org') renderOrg();
    if (v === 'check') renderCheck();
    if (v === 'history') renderHistory();
    if (v === 'report') renderReport();
    const top = $('#ga-app').getBoundingClientRect().top + window.scrollY - (parseInt(getComputedStyle($('#ga-app')).getPropertyValue('--ga-sticky-top')) || 0);
    if (window.scrollY > top) window.scrollTo({ top, behavior: 'auto' });
  }

  /* ---------- Organisation details ---------- */
  function renderOrg() {
    const r = current();
    const started = Object.keys(r.answers).length || r.meta.orgName;
    $('#ga-org-sub').textContent = started
      ? `Editing ${r.meta.orgName ? `the report for ${r.meta.orgName}` : 'this report'}. Changes save automatically.`
      : 'New report. Fill in the details, choose what you want to do, then continue.';
    $('[data-panel="org"] [data-action="new"]').hidden = isEmpty(r);
    META_FIELDS.forEach(f => { $(`#f-${f}`).value = r.meta[f] || ''; });
    $(`#mode-${r.mode}`).checked = true;
    $('#f-process').value = r.process || '';
    $('#ga-org-error').hidden = true;
    $$('.ga-invalid').forEach(n => n.classList.remove('ga-invalid'));
    renderInternal();
  }

  function renderInternal() {
    const r = current();
    $('#ga-internal').hidden = r.mode !== 'internal';
    if (r.mode !== 'internal') return;

    $('#ga-presets').replaceChildren(...Object.keys(PRESETS).map(name =>
      el('button', { type: 'button', class: `ga-preset${r.process === name ? ' on' : ''}`, 'data-preset': name, text: name })));

    const chips = $('#ga-chips');
    chips.replaceChildren(...ISO_CLAUSES.map(c => {
      const groups = GROUPS.filter(g => ITEMS.find(i => i.group === g).clause === c.num);
      return el('div', { class: 'ga-chip-group' }, [
        el('span', { class: 'ga-chip-label', text: `${c.num} ${c.title}` }),
        el('div', { class: 'ga-chips' }, groups.map(g => el('button', {
          type: 'button', class: 'ga-chip', 'data-group': g, 'aria-pressed': String(r.clauses.includes(g))
        }, [el('b', { text: g }), ` ${GROUP_TITLES[g]}`])))
      ]);
    }));
    updateClauseCount();
  }

  function updateClauseCount() {
    const r = current();
    const n = itemsFor(r).length;
    $('#ga-clause-count').textContent = `${r.clauses.length} clause${r.clauses.length === 1 ? '' : 's'}, ${n} check point${n === 1 ? '' : 's'}`;
  }

  function bindOrg() {
    $('#ga-org-form').addEventListener('input', e => {
      const f = e.target.name;
      if (!META_FIELDS.includes(f)) return;
      current().meta[f] = e.target.value;
      e.target.closest('.ga-field').classList.remove('ga-invalid');
      save();
    });

    $$('input[name="mode"]').forEach(inp => inp.addEventListener('change', () => {
      current().mode = inp.value;
      save();
      renderInternal();
    }));

    $('#f-process').addEventListener('input', e => {
      const r = current();
      r.process = e.target.value;
      const preset = Object.keys(PRESETS).find(p => p.toLowerCase() === r.process.trim().toLowerCase());
      if (preset && !r.clauses.length) r.clauses = PRESETS[preset].slice();
      e.target.closest('.ga-field').classList.remove('ga-invalid');
      save();
      $$('.ga-preset').forEach(b => b.classList.toggle('on', b.dataset.preset === r.process));
      $$('.ga-chip').forEach(c => c.setAttribute('aria-pressed', String(r.clauses.includes(c.dataset.group))));
      updateClauseCount();
    });

    $('#ga-presets').addEventListener('click', e => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      const r = current();
      r.process = b.dataset.preset;
      r.clauses = PRESETS[r.process].slice();
      save();
      renderInternal();
      $('#f-process').value = r.process;
      $('#f-process').closest('.ga-field').classList.remove('ga-invalid');
      toast(`Suggested clauses for ${r.process} selected`);
    });

    $('#ga-chips').addEventListener('click', e => {
      const c = e.target.closest('.ga-chip');
      if (!c) return;
      const r = current();
      const g = c.dataset.group;
      r.clauses = r.clauses.includes(g) ? r.clauses.filter(x => x !== g) : GROUPS.filter(x => x === g || r.clauses.includes(x));
      c.setAttribute('aria-pressed', String(r.clauses.includes(g)));
      save();
      updateClauseCount();
    });
    $('#ga-all').addEventListener('click', () => { current().clauses = GROUPS.slice(); save(); renderInternal(); });
    $('#ga-none').addEventListener('click', () => { current().clauses = []; save(); renderInternal(); });

    $('#ga-go-check').addEventListener('click', () => {
      const r = current();
      const problems = [];
      const mark = (id, msg) => { $(`#${id}`).closest('.ga-field').classList.add('ga-invalid'); problems.push([id, msg]); };
      if (!(r.meta.orgName || '').trim()) mark('f-orgName', 'organisation name');
      if (!(r.meta.auditor || '').trim()) mark('f-auditor', 'auditor name');
      if (r.mode === 'internal' && !r.process.trim()) mark('f-process', 'process being audited');
      const err = $('#ga-org-error');
      if (r.mode === 'internal' && !r.clauses.length) problems.push(['ga-chips', 'at least one clause']);
      if (problems.length) {
        err.textContent = `Please add the ${problems.map(p => p[1]).join(', ')}.`;
        err.hidden = false;
        const first = $(`#${problems[0][0]}`);
        first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (first.focus) first.focus({ preventScroll: true });
        return;
      }
      err.hidden = true;
      show('check');
    });
  }

  /* ---------- Check points ---------- */
  function renderCheck() {
    const r = current();
    const ready = r && (r.meta.orgName || '').trim();
    $('#ga-check-empty').hidden = !!ready;
    $('#ga-check-main').hidden = !ready;
    if (!ready) return;

    $('#ga-check-h').textContent = r.meta.orgName;
    $('#ga-check-sub').textContent = [typeLabel(r), fmtDate(r.meta.date), r.meta.auditor && `Auditor: ${r.meta.auditor}`].filter(Boolean).join(' · ');
    $('#ga-filter').querySelector('[value="changes"]').hidden = r.mode === 'changes';
    if (r.mode === 'changes' && $('#ga-filter').value === 'changes') $('#ga-filter').value = 'all';

    const items = itemsFor(r);
    const root = $('#ga-checklist');
    root.replaceChildren(...ISO_CLAUSES.map(c => {
      const rows = items.filter(i => i.clause === c.num);
      if (!rows.length) return null;
      const d = el('details', { class: 'ga-clause', open: true, 'data-clause': c.num }, [
        el('summary', {}, [el('span', { text: `${c.num}  ${c.title}` }), el('span', { class: 'ga-clause-count' })])
      ]);
      rows.forEach(i => d.append(renderRow(r, i)));
      return d;
    }).filter(Boolean));

    if (!items.length) root.replaceChildren(el('p', { class: 'ga-empty-inline', text: 'No clauses selected. Go to Organisation details to choose clauses for this audit.' }));
    refreshProgress();
    applyFilter();
  }

  function renderRow(r, item) {
    const row = el('div', { class: `ga-row${item.change ? (item.change.type === 'New' ? ' is-new' : ' is-mod') : ''}`, id: `row-${item.id}`, 'data-id': item.id });
    const main = el('div', { class: 'ga-row-main' }, [
      el('div', { class: 'ga-row-head' }, [
        el('span', { class: 'ga-ref', text: item.ref }),
        el('span', { class: 'ga-row-title', text: item.title }),
        item.change ? badge(item.change.type) : null
      ]),
      el('p', { class: 'ga-q', text: item.q }),
      el('details', { class: 'ga-more' }, [
        el('summary', { text: item.change ? 'Evidence to look for · What changed' : 'Evidence to look for' }),
        el('p', { class: 'ga-ev', text: item.ev }),
        item.change ? el('p', { class: 'ga-change' }, [el('b', { text: `${item.change.type} vs ISO 9001:2015: ` }), item.change.text]) : null
      ])
    ]);

    const name = `st-${item.id}`;
    const fs = el('fieldset', { class: 'ga-status' }, [el('legend', { class: 'ga-sr', text: `Result for ${item.ref}` })]);
    Object.entries(STATUS).forEach(([v, label]) => {
      fs.append(el('input', { type: 'radio', name, id: `${name}-${v}`, value: v }), el('label', { for: `${name}-${v}`, text: label }));
    });
    const notes = el('textarea', { id: `notes-${item.id}`, rows: '2', 'aria-label': `Notes for ${item.ref}`, placeholder: 'Notes / evidence seen' });
    const warn = el('span', { class: 'ga-warn', text: 'Please write why this is not applicable.' });
    row.append(main, el('div', { class: 'ga-answer' }, [fs, notes, warn]));

    const a = r.answers[item.id] || {};
    if (a.status) $(`#${CSS.escape(`${name}-${a.status}`)}`, fs).checked = true;
    notes.value = a.notes || '';

    fs.addEventListener('change', e => {
      setAnswer(item.id, { status: e.target.value });
      row.classList.toggle('needs-note', e.target.value === 'NA' && !notes.value.trim());
      if (e.target.value === 'NA' || e.target.value === 'NC') notes.focus({ preventScroll: true });
      refreshProgress();
    });
    // A second tap on the selected result clears it.
    fs.addEventListener('click', e => {
      const lab = e.target.closest('label');
      if (!lab) return;
      const inp = $(`#${CSS.escape(lab.htmlFor)}`, fs);
      if (inp.checked) {
        e.preventDefault();
        inp.checked = false;
        setAnswer(item.id, { status: '' });
        row.classList.remove('needs-note');
        refreshProgress();
      }
    });
    notes.addEventListener('input', () => {
      setAnswer(item.id, { notes: notes.value });
      row.classList.toggle('needs-note', (current().answers[item.id] || {}).status === 'NA' && !notes.value.trim());
    });
    row.classList.toggle('needs-note', a.status === 'NA' && !(a.notes || '').trim());
    return row;
  }

  function setAnswer(id, patch) {
    const r = current();
    const next = { ...(r.answers[id] || {}), ...patch };
    if (!next.status && !(next.notes || '').trim()) delete r.answers[id]; else r.answers[id] = next;
    save();
  }

  function refreshProgress() {
    const r = current();
    const c = counts(r);
    const done = c.total - c.open;
    $('#ga-fill').style.width = c.total ? `${(done / c.total) * 100}%` : '0';
    $('#ga-progress-text').textContent = `${done} of ${c.total} answered${c.NC ? ` · ${c.NC} non-compliant` : ''}`;
    $$('.ga-clause').forEach(d => {
      const k = counts(r, itemsFor(r).filter(i => i.clause === d.dataset.clause));
      $('.ga-clause-count', d).textContent = `${k.total - k.open}/${k.total}`;
    });
  }

  function applyFilter() {
    const r = current();
    const mode = $('#ga-filter').value;
    let any = false;
    $$('.ga-clause').forEach(d => {
      let vis = 0;
      $$('.ga-row', d).forEach(row => {
        const item = ITEMS.find(i => i.id === row.dataset.id);
        const s = (r.answers[item.id] || {}).status;
        const showRow = mode === 'all' || (mode === 'open' && !s) || (mode === 'nc' && s === 'NC') || (mode === 'changes' && item.change);
        row.hidden = !showRow;
        if (showRow) vis++;
      });
      d.hidden = !vis;
      any = any || vis > 0;
    });
    $('#ga-filter-empty').hidden = any || !itemsFor(r).length;
  }

  /* ---------- History ---------- */
  function sortedReports() {
    return db.reports
      .filter(r => !isEmpty(r))
      .sort((a, b) => (b.meta.date || '').localeCompare(a.meta.date || '') || b.createdAt.localeCompare(a.createdAt));
  }

  function renderHistory() {
    const list = sortedReports();
    $('#ga-history-empty').hidden = list.length > 0;
    $('#ga-history-list').replaceChildren(...list.map(r => {
      const c = counts(r);
      const done = c.total - c.open;
      const complete = c.total > 0 && !c.open;
      const delBtn = el('button', { type: 'button', class: 'ga-btn ga-danger', 'data-del': r.id, text: 'Delete' });
      return el('article', { class: `ga-hcard${r.id === db.currentId ? ' is-current' : ''}` }, [
        el('div', { class: 'ga-hmain' }, [
          el('div', { class: 'ga-htop' }, [
            el('span', { class: 'ga-hdate', text: fmtDate(r.meta.date) || fmtDate(r.createdAt) }),
            el('span', { class: `ga-pill ${complete ? 'done' : 'prog'}`, text: complete ? 'Completed' : 'In progress' }),
            r.id === db.currentId ? el('span', { class: 'ga-pill open', text: 'Open now' }) : null
          ]),
          el('h2', { class: 'ga-hname', text: r.meta.orgName || 'Untitled report' }),
          el('p', { class: 'ga-htype', text: [typeLabel(r), r.meta.auditor && `Auditor: ${r.meta.auditor}`].filter(Boolean).join(' · ') }),
          el('div', { class: 'ga-track ga-track-sm' }, el('span', { style: `width:${c.total ? (done / c.total) * 100 : 0}%` })),
          el('p', { class: 'ga-hcounts' }, [
            `${done} of ${c.total} answered`,
            c.NC ? el('span', { class: 'ga-nc-text', text: ` · ${c.NC} non-compliant` }) : null,
            ` · saved ${fmtDate(r.updatedAt)} ${fmtTime(r.updatedAt)}`
          ])
        ]),
        el('div', { class: 'ga-hactions' }, [
          el('button', { type: 'button', class: 'ga-btn ga-primary', 'data-edit': r.id, text: 'Edit' }),
          el('button', { type: 'button', class: 'ga-btn', 'data-view-report': r.id, text: 'View report' }),
          delBtn
        ])
      ]);
    }));
  }

  function bindHistory() {
    $('#ga-history-list').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.edit) {
        db.currentId = b.dataset.edit;
        save(false);
        show('check');
      } else if (b.dataset.viewReport) {
        reportId = b.dataset.viewReport;
        show('report');
      } else if (b.dataset.del) {
        if (!b.classList.contains('armed')) {
          b.classList.add('armed');
          b.textContent = 'Tap again to delete';
          setTimeout(() => { if (b.isConnected) { b.classList.remove('armed'); b.textContent = 'Delete'; } }, 4000);
          return;
        }
        db.reports = db.reports.filter(r => r.id !== b.dataset.del);
        if (!current()) newReport();
        save(false);
        toast('Report deleted');
        renderHistory();
      }
    });

    const backup = $('#ga-backup');
    if (backup) backup.addEventListener('click', () => {
      const data = JSON.stringify({ tool: 'ISO 9001:2026 gap assessment', version: 2, exported: new Date().toISOString(), reports: sortedReports() }, null, 2);
      const a = el('a', { href: URL.createObjectURL(new Blob([data], { type: 'application/json' })), download: `iso9001-reports-backup-${today()}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    $('#ga-restore').addEventListener('click', () => $('#ga-restore-file').click());
    $('#ga-restore-file').addEventListener('change', e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const d = JSON.parse(reader.result);
          let incoming = Array.isArray(d.reports) ? d.reports : null;
          // Single-assessment files exported by the first version of this tool.
          if (!incoming && d.answers && d.meta) incoming = [{ ...blankReport(), meta: d.meta, answers: d.answers }];
          incoming = (incoming || []).filter(validReport);
          if (!incoming.length) throw new Error('empty');
          incoming.forEach(r => {
            const i = db.reports.findIndex(x => x.id === r.id);
            if (i < 0) db.reports.push(r);
            else if ((r.updatedAt || '') > (db.reports[i].updatedAt || '')) db.reports[i] = r;
          });
          save(false);
          renderHistory();
          toast(`${incoming.length} report${incoming.length > 1 ? 's' : ''} restored`);
        } catch (err) {
          toast('That file is not a backup from this tool');
        }
      };
      reader.readAsText(f);
    });
  }

  /* ---------- Report ---------- */
  function renderReport() {
    const r = byId(reportId) || current();
    reportId = r.id;
    const items = itemsFor(r);
    const c = counts(r);
    const applicable = c.C + c.NC;
    const pct = applicable ? `${Math.round((c.C / applicable) * 100)}%` : '–';

    const detail = (label, value) => value ? el('div', {}, [el('dt', { text: label }), el('dd', { text: value })]) : null;
    const stat = (cls, v, label) => el('div', { class: `ga-stat ${cls}` }, [el('strong', { text: String(v) }), el('span', { text: label })]);

    const sections = ISO_CLAUSES.map(cl => {
      const rows = items.filter(i => i.clause === cl.num);
      if (!rows.length) return null;
      return el('section', { class: 'ga-rp-clause' }, [
        el('h3', { text: `${cl.num} ${cl.title}` }),
        ...rows.map(i => {
          const a = r.answers[i.id] || {};
          return el('div', { class: 'ga-rp-row' }, [
            el('div', { class: 'ga-rp-ref' }, [el('b', { text: i.ref }), i.change ? badge(i.change.type) : null]),
            el('div', { class: 'ga-rp-q' }, [el('b', { text: i.title }), el('span', { text: i.q })]),
            el('div', { class: `ga-rp-status s-${a.status || 'open'}`, text: STATUS[a.status] || 'Not answered' }),
            el('div', { class: 'ga-rp-notes', text: a.notes || '' })
          ]);
        })
      ]);
    }).filter(Boolean);

    const gaps = items.filter(i => (r.answers[i.id] || {}).status === 'NC');

    $('#ga-report').replaceChildren(
      el('header', { class: 'ga-rp-head' }, [
        el('p', { class: 'ga-eyebrow', text: typeLabel(r) }),
        el('h1', { class: 'ga-h1', text: r.meta.orgName || 'Untitled report' }),
        el('p', { class: 'ga-sub', text: 'Against ISO 9001:2026' })
      ]),
      el('dl', { class: 'ga-rp-details' }, [
        detail('Site', r.meta.site), detail('Products / scope', r.meta.scope), detail('Employees', r.meta.employees),
        detail('Process audited', r.mode === 'internal' ? r.process : ''),
        detail('Auditor', r.meta.auditor), detail('Auditee', r.meta.auditee),
        detail('Audit date', fmtDate(r.meta.date)), detail('Reference', r.meta.ref)
      ]),
      el('div', { class: 'ga-stats' }, [
        stat('', pct, 'Compliance of applicable'), stat('ok', c.C, 'Compliant'), stat('nc', c.NC, 'Non-compliant'),
        stat('na', c.NA, 'Not applicable'), stat('', c.open, 'Not answered')
      ]),
      el('section', { class: 'ga-rp-gaps' }, [
        el('h2', { class: 'ga-h2', text: `Gaps found (${gaps.length})` }),
        gaps.length
          ? el('ol', {}, gaps.map(i => el('li', {}, [el('b', { text: `${i.ref} ${i.title}` }), i.change ? badge(i.change.type) : null, el('span', { text: (r.answers[i.id].notes || '').trim() || 'No notes recorded.' })])))
          : el('p', { class: 'ga-muted', text: 'No non-compliances recorded.' })
      ]),
      el('h2', { class: 'ga-h2', text: 'All check points' }),
      ...sections,
      el('div', { class: 'ga-signoff' }, [el('div', { text: 'Auditor signature' }), el('div', { text: 'Auditee signature' }), el('div', { text: 'Date' })])
    );
  }

  /* ---------- Init ---------- */
  function init() {
    const app = $('#ga-app');
    if (!app || typeof ISO_CLAUSES === 'undefined') return;
    load();
    app.innerHTML = shell();

    $$('.ga-tab').forEach(t => t.addEventListener('click', () => show(t.dataset.view)));
    app.addEventListener('click', e => {
      const go = e.target.closest('[data-goto]');
      if (go) show(go.dataset.goto);
      if (e.target.closest('[data-action="new"]')) {
        newReport();
        show('org');
        toast('New report started');
        $('#f-orgName').focus({ preventScroll: true });
      }
    });
    bindOrg();
    bindHistory();
    $('#ga-filter').addEventListener('change', applyFilter);
    $('#ga-view-current').addEventListener('click', () => { reportId = db.currentId; show('report'); });
    $('#ga-report-edit').addEventListener('click', () => { db.currentId = reportId; save(false); show('check'); });
    const print = $('#ga-print');
    if (print) print.addEventListener('click', () => window.print());

    const r = current();
    show((r.meta.orgName || '').trim() ? 'check' : 'org');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
