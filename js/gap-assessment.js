/* =========================================================
   KREATIVE SOLUTION — ISO 9001:2026 Gap Assessment tool
   Renders the checklist from ISO_CLAUSES, autosaves to
   localStorage, and supports JSON export/import and printing.
   ========================================================= */

(() => {
  const STORAGE_KEY = 'ks-iso9001-2026-gap-v1';
  const STATUS = { C: 'Compliant', NC: 'Non-compliant', NA: 'Not applicable' };

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const allItems = ISO_CLAUSES.flatMap(c => c.items.map(i => ({ ...i, clause: c.num })));

  let state = { meta: {}, answers: {} };

  /* ---------- Storage ---------- */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = { meta: parsed.meta || {}, answers: parsed.answers || {} };
      }
    } catch (e) { /* storage unavailable — start empty */ }
  }

  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        flashSaved('Saved');
      } catch (e) {
        flashSaved('Not saved: browser storage unavailable. Use Export file.');
      }
    }, 300);
  }

  function flashSaved(msg) {
    const el = $('#save-status');
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.textContent = ''; }, 2500);
  }

  /* ---------- Rendering ---------- */
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    });
    [].concat(children).forEach(c => c && node.append(c));
    return node;
  }

  function badge(type) {
    return el('span', { class: type === 'New' ? 'badge badge-new' : 'badge badge-mod', text: type });
  }

  function renderChecklist() {
    const root = $('#checklist');
    ISO_CLAUSES.forEach(clause => {
      const details = el('details', { class: 'ga-clause', open: '', 'data-clause': clause.num });
      const changes = clause.items.filter(i => i.change).length;
      details.append(el('summary', {}, [
        el('span', { text: `${clause.num}  ${clause.title}` }),
        el('span', { class: 'ga-clause-count', text: changes ? `${changes} change${changes > 1 ? 's' : ''} in 2026` : '' })
      ]));

      clause.items.forEach(item => details.append(renderRow(item)));
      root.append(details);
    });
  }

  function renderRow(item) {
    const row = el('div', { class: 'ga-row', id: `row-${item.id}`, 'data-id': item.id });
    if (item.change) row.classList.add(item.change.type === 'New' ? 'is-new' : 'is-mod');

    const head = el('div', { class: 'ga-row-head' }, [
      el('span', { class: 'ga-ref', text: item.ref }),
      el('span', { class: 'ga-row-title', text: item.title }),
      item.change ? badge(item.change.type) : null
    ]);

    const left = el('div', { class: 'ga-row-main' }, [
      head,
      el('p', { class: 'ga-q', text: item.q }),
      el('p', { class: 'ga-ev' }, [el('b', { text: 'Evidence to look for: ' }), item.ev])
    ]);
    if (item.change) {
      left.append(el('div', { class: 'ga-change' }, [
        el('b', { text: `${item.change.type} vs ISO 9001:2015: ` }), item.change.text
      ]));
    }

    const name = `status-${item.id}`;
    const fieldset = el('fieldset', { class: 'ga-status' }, [el('legend', { class: 'sr-only', text: `Status for ${item.ref}` })]);
    Object.entries(STATUS).forEach(([val, label]) => {
      const id = `${name}-${val}`;
      fieldset.append(
        el('input', { type: 'radio', name, id, value: val }),
        el('label', { for: id, text: label })
      );
    });

    const notes = el('textarea', { 'aria-label': `Notes for ${item.ref}`, placeholder: 'Notes / objective evidence seen' });
    const notesPrint = el('div', { class: 'ga-notes-print' });
    const warn = el('span', { class: 'ga-warn', text: 'Add a justification for "Not applicable".' });

    const right = el('div', { class: 'ga-answer' }, [fieldset, notes, notesPrint, warn]);
    row.append(left, right);

    const saved = state.answers[item.id] || {};
    if (saved.status) $(`input[value="${saved.status}"]`, fieldset).checked = true;
    notes.value = saved.notes || '';
    notesPrint.textContent = notes.value;

    fieldset.addEventListener('change', e => {
      setAnswer(item.id, { status: e.target.value });
      refreshRow(row);
      refreshSummary();
    });
    notes.addEventListener('input', () => {
      notesPrint.textContent = notes.value;
      setAnswer(item.id, { notes: notes.value });
      refreshRow(row);
      refreshGaps();
    });

    refreshRow(row);
    return row;
  }

  function refreshRow(row) {
    const a = state.answers[row.dataset.id] || {};
    row.classList.toggle('needs-note', a.status === 'NA' && !(a.notes || '').trim());
  }

  function renderChanges() {
    const list = $('#changes-list');
    allItems.filter(i => i.change).forEach(item => {
      const link = el('a', { href: `#row-${item.id}` }, [
        el('span', { class: 'ref', text: item.ref }),
        badge(item.change.type),
        el('span', { text: item.title })
      ]);
      link.addEventListener('click', e => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const row = $(`#row-${item.id}`);
        row.closest('details').open = true;
        if (row.hidden) { $('#filter').value = 'all'; applyFilter(); }
        row.scrollIntoView({ behavior: 'smooth', block: 'start' });
        row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
      });
      list.append(el('li', {}, link));
    });
  }

  /* ---------- State updates ---------- */
  function setAnswer(id, patch) {
    state.answers[id] = { ...(state.answers[id] || {}), ...patch };
    save();
  }

  function counts(items) {
    const c = { C: 0, NC: 0, NA: 0, open: 0 };
    items.forEach(i => {
      const s = (state.answers[i.id] || {}).status;
      if (s && c[s] !== undefined) c[s]++; else c.open++;
    });
    return c;
  }

  function refreshSummary() {
    const total = allItems.length;
    const c = counts(allItems);
    const answered = total - c.open;
    const applicable = c.C + c.NC;
    const pct = applicable ? Math.round((c.C / applicable) * 100) : 0;

    $('#progress-fill').style.width = `${(answered / total) * 100}%`;
    $('#progress-text').textContent = `${answered} of ${total} answered`;

    const stats = $('#stats');
    stats.replaceChildren(
      stat('', `${pct}%`, 'Compliance (of applicable)'),
      stat('ok', c.C, 'Compliant'),
      stat('nc', c.NC, 'Non-compliant'),
      stat('na', c.NA, 'Not applicable'),
      stat('', c.open, 'Not assessed')
    );

    const tbody = $('#clause-summary tbody');
    tbody.replaceChildren(...ISO_CLAUSES.map(cl => {
      const k = counts(cl.items);
      return el('tr', {}, [
        el('td', { text: `${cl.num} ${cl.title}` }),
        el('td', { text: k.C }), el('td', { text: k.NC }), el('td', { text: k.NA }), el('td', { text: k.open })
      ]);
    }));

    refreshGaps();
    if ($('#filter').value !== 'all') applyFilter();
  }

  function stat(cls, value, label) {
    return el('div', { class: `ga-stat ${cls}` }, [el('strong', { text: String(value) }), el('span', { text: label })]);
  }

  function refreshGaps() {
    const gaps = allItems.filter(i => (state.answers[i.id] || {}).status === 'NC');
    $('#gaps-list').replaceChildren(...gaps.map(i => {
      const notes = (state.answers[i.id].notes || '').trim();
      return el('li', {}, [
        el('b', { text: `${i.ref} ${i.title}` }),
        i.change ? ' ' : null, i.change ? badge(i.change.type) : null,
        el('span', { class: 'note', text: notes || 'No notes recorded.' })
      ]);
    }));
    $('#gaps-empty').hidden = gaps.length > 0;
  }

  /* ---------- Filter ---------- */
  function applyFilter() {
    const mode = $('#filter').value;
    $$('.ga-clause').forEach(details => {
      let visible = 0;
      $$('.ga-row', details).forEach(row => {
        const item = allItems.find(i => i.id === row.dataset.id);
        const s = (state.answers[item.id] || {}).status;
        const show = mode === 'all'
          || (mode === 'changes' && item.change)
          || (mode === 'nc' && s === 'NC')
          || (mode === 'open' && !s);
        row.hidden = !show;
        if (show) visible++;
      });
      details.hidden = visible === 0;
    });
  }

  /* ---------- Meta form ---------- */
  function initMeta() {
    const form = $('#meta-form');
    $$('input, select', form).forEach(input => {
      input.value = state.meta[input.name] || '';
      input.addEventListener('input', () => {
        state.meta[input.name] = input.value;
        save();
      });
    });
  }

  /* ---------- Actions ---------- */
  function exportFile() {
    const data = { tool: 'ISO 9001:2026 gap assessment', version: 1, exported: new Date().toISOString(), ...state };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const org = (state.meta.orgName || 'assessment').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    const a = el('a', { href: URL.createObjectURL(blob), download: `iso9001-2026-gap-${org || 'assessment'}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data.answers !== 'object' || typeof data.meta !== 'object') throw new Error('format');
        if (!confirm('Replace the current assessment with the imported file?')) return;
        state = { meta: data.meta, answers: data.answers };
        save();
        rerender();
      } catch (e) {
        alert('This file is not a valid gap assessment export.');
      }
    };
    reader.readAsText(file);
  }

  function newAssessment() {
    if (!confirm('Start a new assessment? All current answers will be cleared. Export a file first if you want to keep them.')) return;
    state = { meta: {}, answers: {} };
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    rerender();
  }

  function rerender() {
    $('#checklist').replaceChildren();
    renderChecklist();
    initMeta();
    refreshSummary();
    applyFilter();
  }

  // Print every requirement regardless of filter or collapsed sections.
  let printState = null;
  window.addEventListener('beforeprint', () => {
    printState = $$('.ga-clause').map(d => d.open);
    $$('.ga-clause').forEach(d => { d.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (printState) $$('.ga-clause').forEach((d, i) => { d.open = printState[i]; });
    printState = null;
  });

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    load();
    renderChecklist();
    renderChanges();
    initMeta();
    refreshSummary();

    $('#filter').addEventListener('change', applyFilter);
    $('#btn-print').addEventListener('click', () => window.print());
    $('#btn-export').addEventListener('click', exportFile);
    $('#btn-import').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', e => {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = '';
    });
    $('#btn-new').addEventListener('click', newAssessment);
  });
})();
