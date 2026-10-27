/* TIME Assessment — UI layer. Scoring logic lives in scoring.js (window.TimeScoring). */
(function () {
  'use strict';

  var S = window.TimeScoring;
  var CATS = S.CATEGORIES;
  var CAT_ORDER = ['invest', 'migrate', 'tolerate', 'eliminate'];
  var STORAGE_KEY = 'time-assessment-v1';

  var state = load() || { settings: S.defaultSettings(), apps: [] };
  var ui = { view: 'dashboard', assessId: null, sort: { key: 'name', dir: 1 }, search: '' };

  // ---------- helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmtScore(v) { return v == null ? '—' : v.toFixed(2); }
  function fmtMoney(v) {
    if (v == null || v === '' || isNaN(v)) return '—';
    return Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  function fmtCompact(v) {
    return Number(v || 0).toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 });
  }
  function badge(cat, extra) {
    if (!cat) return '<span class="badge none">Not assessed</span>';
    return '<span class="badge ' + cat + '">' + CATS[cat].label + (extra || '') + '</span>';
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  function readFile(input, cb) {
    var f = input.files && input.files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { cb(String(r.result)); input.value = ''; };
    r.readAsText(f);
  }

  // ---------- persistence ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalise(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }
  function normalise(data) {
    if (!data || !Array.isArray(data.apps)) throw new Error('Invalid file: missing "apps" list');
    var settings = data.settings && data.settings.criteria ? data.settings : S.defaultSettings();
    if (typeof settings.threshold !== 'number') settings.threshold = 3;
    return {
      settings: settings,
      apps: data.apps.map(function (a) {
        return {
          id: a.id || uid(), name: String(a.name || 'Untitled'), owner: a.owner || '', domain: a.domain || '',
          annualCost: a.annualCost === '' || a.annualCost == null ? null : Number(a.annualCost),
          users: a.users === '' || a.users == null ? null : Number(a.users),
          lifecycle: a.lifecycle || '', notes: a.notes || '',
          scores: a.scores || {}, override: a.override || { category: '', reason: '' },
          updatedAt: a.updatedAt || null,
        };
      }),
    };
  }
  function commit() { save(); renderAll(); }

  function assessed() {
    return state.apps.map(function (a) { return { app: a, r: S.assess(a, state.settings) }; });
  }

  // ---------- navigation ----------
  function show(view) {
    ui.view = view;
    $all('.tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === view); });
    $all('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
    if (view === 'assess') renderAssess();
    window.scrollTo(0, 0);
  }
  function openAssess(id) { ui.assessId = id; show('assess'); }

  // ---------- dashboard ----------
  function renderDashboard() {
    var rows = assessed();
    var scored = rows.filter(function (x) { return x.r.category; });
    var totalCost = rows.reduce(function (s, x) { return s + (x.app.annualCost || 0); }, 0);

    var kpis = '<div class="kpi"><div class="label">Applications</div><div class="value">' + rows.length +
      '</div><div class="meta">' + scored.length + ' assessed · ' + fmtCompact(totalCost) + ' annual cost</div></div>';
    CAT_ORDER.forEach(function (c) {
      var inCat = scored.filter(function (x) { return x.r.category === c; });
      var cost = inCat.reduce(function (s, x) { return s + (x.app.annualCost || 0); }, 0);
      var pct = totalCost ? Math.round(cost / totalCost * 100) : 0;
      kpis += '<div class="kpi ' + c + '"><div class="label">' + CATS[c].label + '</div><div class="value">' +
        inCat.length + '</div><div class="meta">' + fmtCompact(cost) + ' cost · ' + pct + '% of spend</div></div>';
    });
    $('#kpis').innerHTML = kpis;

    $('#matrix').innerHTML = rows.length ? matrixSVG(scored) :
      '<div class="empty">No applications yet.<br><br><button class="btn" data-action="sample">Load sample portfolio</button> ' +
      '<button class="btn ghost" data-action="goto-inventory">Add applications</button></div>';

    var rec = '';
    CAT_ORDER.forEach(function (c) {
      var inCat = scored.filter(function (x) { return x.r.category === c; });
      rec += '<div class="rec ' + c + '"><h3><span>' + CATS[c].label + '</span><span class="muted small">' +
        inCat.length + ' app' + (inCat.length === 1 ? '' : 's') + '</span></h3><p>' + esc(CATS[c].summary) + '</p><ul>' +
        CATS[c].actions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
        (inCat.length ? '<div class="apps"><b>Apps:</b> ' + inCat.map(function (x) { return esc(x.app.name); }).join(', ') + '</div>' : '') +
        '</div>';
    });
    var unscored = rows.length - scored.length;
    if (unscored) rec += '<p class="muted small">' + unscored + ' application(s) still need scoring.</p>';
    $('#recommendations').innerHTML = rec;

    renderReport(rows);
  }

  function matrixSVG(rows) {
    var W = 640, H = 540, L = 56, R = 18, T = 18, B = 52;
    var pw = W - L - R, ph = H - T - B;
    var t = state.settings.threshold;
    function x(v) { return L + (v - 1) / 4 * pw; }
    function y(v) { return T + (1 - (v - 1) / 4) * ph; }
    var maxCost = rows.reduce(function (m, r) { return Math.max(m, r.app.annualCost || 0); }, 0);

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="TIME matrix scatter plot">';
    // quadrants
    var quads = [
      ['migrate', x(1), y(5), x(t) - x(1), y(t) - y(5)],
      ['invest', x(t), y(5), x(5) - x(t), y(t) - y(5)],
      ['eliminate', x(1), y(t), x(t) - x(1), y(1) - y(t)],
      ['tolerate', x(t), y(t), x(5) - x(t), y(1) - y(t)],
    ];
    quads.forEach(function (q) {
      s += '<rect x="' + q[1] + '" y="' + q[2] + '" width="' + q[3] + '" height="' + q[4] +
        '" style="fill:var(--' + q[0] + '-bg)"/>';
    });
    // grid + ticks
    for (var v = 1; v <= 5; v++) {
      s += '<line x1="' + x(v) + '" y1="' + T + '" x2="' + x(v) + '" y2="' + (T + ph) + '" style="stroke:var(--border)" stroke-dasharray="2 4"/>';
      s += '<line x1="' + L + '" y1="' + y(v) + '" x2="' + (L + pw) + '" y2="' + y(v) + '" style="stroke:var(--border)" stroke-dasharray="2 4"/>';
      s += '<text x="' + x(v) + '" y="' + (T + ph + 18) + '" text-anchor="middle" font-size="12" style="fill:var(--muted)">' + v + '</text>';
      s += '<text x="' + (L - 10) + '" y="' + (y(v) + 4) + '" text-anchor="end" font-size="12" style="fill:var(--muted)">' + v + '</text>';
    }
    // threshold lines
    s += '<line x1="' + x(t) + '" y1="' + T + '" x2="' + x(t) + '" y2="' + (T + ph) + '" style="stroke:var(--muted)" stroke-width="1.5"/>';
    s += '<line x1="' + L + '" y1="' + y(t) + '" x2="' + (L + pw) + '" y2="' + y(t) + '" style="stroke:var(--muted)" stroke-width="1.5"/>';
    // quadrant labels
    var lbl = function (cat, lx, ly, anchor) {
      return '<text x="' + lx + '" y="' + ly + '" text-anchor="' + anchor + '" font-size="15" font-weight="700" style="fill:var(--' + cat + ')">' +
        CATS[cat].label.toUpperCase() + '</text>';
    };
    s += lbl('migrate', L + 10, T + 22, 'start') + lbl('invest', L + pw - 10, T + 22, 'end') +
      lbl('eliminate', L + 10, T + ph - 12, 'start') + lbl('tolerate', L + pw - 10, T + ph - 12, 'end');
    // axes titles
    s += '<text x="' + (L + pw / 2) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="13" font-weight="600">Technical fit →</text>';
    s += '<text transform="translate(16 ' + (T + ph / 2) + ') rotate(-90)" text-anchor="middle" font-size="13" font-weight="600">Business value →</text>';

    // bubbles: largest first so small ones stay clickable on top
    var sorted = rows.slice().sort(function (a, b) { return (b.app.annualCost || 0) - (a.app.annualCost || 0); });
    sorted.forEach(function (row) {
      var a = row.app, r = row.r;
      var rad = 7 + (maxCost ? 20 * Math.sqrt((a.annualCost || 0) / maxCost) : 0);
      var cx = x(r.tf), cy = y(r.bv);
      var labelRight = cx < L + pw - 120;
      s += '<g class="bubble" data-id="' + esc(a.id) + '" tabindex="0">' +
        '<title>' + esc(a.name) + '\nBusiness value: ' + fmtScore(r.bv) + '\nTechnical fit: ' + fmtScore(r.tf) +
        '\nResult: ' + CATS[r.category].label + (r.overridden ? ' (override)' : '') +
        '\nAnnual cost: ' + fmtMoney(a.annualCost) + '</title>' +
        '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad + '" style="fill:var(--' + r.category + ');stroke:var(--surface)" fill-opacity=".72" stroke-width="1.5"' +
        (r.overridden ? ' stroke-dasharray="3 2"' : '') + '/>' +
        '<text x="' + (labelRight ? cx + rad + 4 : cx - rad - 4) + '" y="' + (cy + 4) + '" font-size="11" text-anchor="' +
        (labelRight ? 'start' : 'end') + '">' + esc(a.name.length > 26 ? a.name.slice(0, 25) + '…' : a.name) + '</text></g>';
    });
    s += '</svg>';
    return s;
  }

  function renderReport(rows) {
    var list = rows.slice().sort(function (a, b) {
      var ca = CAT_ORDER.indexOf(a.r.category), cb = CAT_ORDER.indexOf(b.r.category);
      if (ca < 0) ca = 9; if (cb < 0) cb = 9;
      return ca - cb || (b.r.bv || 0) - (a.r.bv || 0);
    });
    if (!list.length) { $('#report').innerHTML = '<p class="muted small">Nothing to report yet.</p>'; return; }
    var h = '<div class="table-wrap"><table class="table"><thead><tr><th>Application</th><th>Domain</th><th class="num">Business value</th>' +
      '<th class="num">Technical fit</th><th>Calculated</th><th>Decision</th><th>Rationale / notes</th><th class="num">Annual cost</th></tr></thead><tbody>';
    list.forEach(function (x) {
      var a = x.app, r = x.r;
      h += '<tr><td><b>' + esc(a.name) + '</b><div class="muted small">' + esc(a.owner) + '</div></td><td>' + esc(a.domain) +
        '</td><td class="num">' + fmtScore(r.bv) + '</td><td class="num">' + fmtScore(r.tf) + '</td><td>' + badge(r.calculated) +
        '</td><td>' + badge(r.category, r.overridden ? ' *' : '') + '</td><td class="small">' +
        esc(r.overridden ? a.override.reason : a.notes) + '</td><td class="num">' + fmtMoney(a.annualCost) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    if (list.some(function (x) { return x.r.overridden; })) h += '<p class="muted small">* Decision overridden by assessor.</p>';
    $('#report').innerHTML = h;
  }

  function exportCSV() {
    var cols = ['Name', 'Owner', 'Domain', 'Lifecycle', 'Annual cost', 'Users', 'Business value', 'Technical fit',
      'Calculated', 'Decision', 'Override reason', 'Completeness %', 'Notes'];
    var crit = state.settings.criteria.bv.concat(state.settings.criteria.tf);
    cols = cols.concat(crit.map(function (c) { return c.name; }));
    var lines = [cols];
    assessed().forEach(function (x) {
      var a = x.app, r = x.r;
      lines.push([a.name, a.owner, a.domain, a.lifecycle, a.annualCost, a.users,
        r.bv == null ? '' : r.bv.toFixed(2), r.tf == null ? '' : r.tf.toFixed(2),
        r.calculated ? CATS[r.calculated].label : '', r.category ? CATS[r.category].label : '',
        r.overridden ? a.override.reason : '', Math.round(r.completeness * 100), a.notes]
        .concat(crit.map(function (c) { return a.scores[c.id] || ''; })));
    });
    var csv = lines.map(function (l) {
      return l.map(function (v) {
        v = v == null ? '' : String(v);
        return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
    download('time-assessment.csv', '﻿' + csv, 'text/csv');
  }

  // ---------- inventory ----------
  function renderInventory() {
    var cols = [
      ['name', 'Application'], ['domain', 'Domain'], ['owner', 'Owner'], ['annualCost', 'Annual cost', 'num'],
      ['bv', 'Value', 'num'], ['tf', 'Tech fit', 'num'], ['category', 'TIME'], ['completeness', 'Done', 'num'],
    ];
    var q = ui.search.toLowerCase();
    var rows = assessed().filter(function (x) {
      return !q || [x.app.name, x.app.owner, x.app.domain, x.app.notes].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var k = ui.sort.key, d = ui.sort.dir;
    rows.sort(function (a, b) {
      var va = k in a.r ? a.r[k] : a.app[k], vb = k in b.r ? b.r[k] : b.app[k];
      if (k === 'category') { va = CAT_ORDER.indexOf(va); vb = CAT_ORDER.indexOf(vb); }
      if (va == null || va === '' || va === -1) return 1;
      if (vb == null || vb === '' || vb === -1) return -1;
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * d;
    });
    var h = '<thead><tr>' + cols.map(function (c) {
      var arrow = ui.sort.key === c[0] ? (ui.sort.dir > 0 ? ' ▲' : ' ▼') : '';
      return '<th class="sortable ' + (c[2] || '') + '" data-sort="' + c[0] + '">' + c[1] + arrow + '</th>';
    }).join('') + '<th></th></tr></thead><tbody>';
    rows.forEach(function (x) {
      var a = x.app, r = x.r;
      h += '<tr><td><b>' + esc(a.name) + '</b>' + (a.lifecycle ? '<div class="muted small">' + esc(a.lifecycle) + '</div>' : '') +
        '</td><td>' + esc(a.domain) + '</td><td>' + esc(a.owner) + '</td><td class="num">' + fmtMoney(a.annualCost) +
        '</td><td class="num">' + fmtScore(r.bv) + '</td><td class="num">' + fmtScore(r.tf) + '</td><td>' +
        badge(r.category, r.overridden ? ' *' : '') + '</td><td class="num">' + Math.round(r.completeness * 100) + '%</td>' +
        '<td class="actions"><button class="btn small" data-assess="' + esc(a.id) + '">Assess</button> ' +
        '<button class="btn small ghost" data-edit="' + esc(a.id) + '">Edit</button> ' +
        '<button class="btn small danger" data-delete="' + esc(a.id) + '" aria-label="Delete ' + esc(a.name) + '">✕</button></td></tr>';
    });
    $('#inv-table').innerHTML = h + '</tbody>';
    $('#inv-empty').hidden = state.apps.length > 0;

    var domains = {};
    state.apps.forEach(function (a) { if (a.domain) domains[a.domain] = 1; });
    $('#domain-list').innerHTML = Object.keys(domains).sort().map(function (d) { return '<option value="' + esc(d) + '">'; }).join('');
  }

  var editingId = null;
  function openAppDialog(id) {
    editingId = id || null;
    var a = id ? findApp(id) : {};
    var form = $('#app-form');
    $('#app-dialog-title').textContent = id ? 'Edit application' : 'Add application';
    ['name', 'owner', 'domain', 'annualCost', 'users', 'lifecycle', 'notes'].forEach(function (f) {
      form.elements[f].value = a[f] == null ? '' : a[f];
    });
    $('#app-dialog').returnValue = '';
    $('#app-dialog').showModal();
    form.elements.name.focus();
  }
  function saveAppDialog() {
    var f = $('#app-form').elements;
    var data = {
      name: f.name.value.trim(), owner: f.owner.value.trim(), domain: f.domain.value.trim(),
      annualCost: f.annualCost.value === '' ? null : Number(f.annualCost.value),
      users: f.users.value === '' ? null : Number(f.users.value),
      lifecycle: f.lifecycle.value, notes: f.notes.value.trim(),
    };
    if (!data.name) return;
    if (editingId) {
      Object.assign(findApp(editingId), data, { updatedAt: new Date().toISOString() });
      toast('Application updated');
    } else {
      var app = Object.assign({ id: uid(), scores: {}, override: { category: '', reason: '' }, updatedAt: new Date().toISOString() }, data);
      state.apps.push(app);
      ui.assessId = app.id;
      toast('Application added — score it on the Assess tab');
    }
    commit();
  }
  function findApp(id) { return state.apps.filter(function (a) { return a.id === id; })[0]; }

  // ---------- assess ----------
  function renderAssess() {
    var sel = $('#assess-select');
    if (!state.apps.length) {
      sel.innerHTML = '';
      $('#assess-body').innerHTML = '<div class="card empty">No applications to assess yet.<br><br>' +
        '<button class="btn" data-action="goto-inventory">Add applications</button></div>';
      return;
    }
    if (!findApp(ui.assessId)) ui.assessId = state.apps[0].id;
    sel.innerHTML = state.apps.map(function (a) {
      var r = S.assess(a, state.settings);
      return '<option value="' + esc(a.id) + '"' + (a.id === ui.assessId ? ' selected' : '') + '>' + esc(a.name) +
        ' — ' + (r.category ? CATS[r.category].label : 'not assessed') + '</option>';
    }).join('');

    var a = findApp(ui.assessId);
    var h = '<div class="card"><div id="assess-summary"></div></div><div class="grid-2 even">' +
      critSection('bv', 'Business value', a) + critSection('tf', 'Technical fit', a) + '</div>';
    var ov = a.override || {};
    h += '<div class="card"><div class="card-head"><h2>Decision override</h2></div>' +
      '<p class="muted small">Use only when context the scores cannot capture changes the decision (e.g. a contract ending, a merger, a regulatory deadline). Always record why.</p>' +
      '<div class="form-grid"><label class="field"><span>Final decision</span><select id="ov-cat"><option value="">Use calculated result</option>' +
      CAT_ORDER.map(function (c) { return '<option value="' + c + '"' + (ov.category === c ? ' selected' : '') + '>' + CATS[c].label + '</option>'; }).join('') +
      '</select></label><label class="field span-2"><span>Rationale</span><textarea id="ov-reason" rows="2">' + esc(ov.reason) + '</textarea></label></div></div>';
    $('#assess-body').innerHTML = h;
    renderAssessSummary();

    var idx = state.apps.indexOf(a);
    $('#assess-prev').disabled = idx <= 0;
    $('#assess-next').disabled = idx >= state.apps.length - 1;
  }

  function critSection(dim, title, app) {
    var h = '<div class="card"><div class="card-head"><h2>' + title + '</h2><span class="muted small" id="sub-' + dim + '"></span></div>';
    state.settings.criteria[dim].forEach(function (c) {
      var cur = app.scores[c.id];
      h += '<div class="criterion"><div class="c-head"><span class="c-name">' + esc(c.name) + '</span>' +
        '<span class="muted small">weight ' + esc(c.weight) + (cur ? ' · <button class="clear-score" data-clear="' + esc(c.id) + '">clear</button>' : '') +
        '</span></div>' + (c.help ? '<div class="c-help">' + esc(c.help) + '</div>' : '') +
        '<div class="scale" role="radiogroup" aria-label="' + esc(c.name) + '">';
      for (var v = 1; v <= 5; v++) {
        h += '<label><input type="radio" name="' + esc(c.id) + '" value="' + v + '"' + (Number(cur) === v ? ' checked' : '') +
          ' aria-label="' + v + '"><span>' + v + '</span></label>';
      }
      h += '</div><div class="scale-anchors"><span>1 · ' + esc(c.low || 'Very poor') + '</span><span>5 · ' + esc(c.high || 'Excellent') + '</span></div></div>';
    });
    return h + '</div>';
  }

  function renderAssessSummary() {
    var a = findApp(ui.assessId);
    if (!a) return;
    var r = S.assess(a, state.settings);
    var bvW = S.weightedScore(state.settings.criteria.bv, a.scores);
    var tfW = S.weightedScore(state.settings.criteria.tf, a.scores);
    $('#sub-bv').textContent = bvW.answered + '/' + bvW.total + ' scored';
    $('#sub-tf').textContent = tfW.answered + '/' + tfW.total + ' scored';
    var cat = r.category;
    $('#assess-summary').innerHTML = '<div class="assess-summary">' +
      '<div><div class="muted small">Application</div><div style="font-weight:700;font-size:1.15rem">' + esc(a.name) + '</div>' +
      '<div class="muted small">' + esc([a.domain, a.owner].filter(Boolean).join(' · ')) + '</div></div>' +
      '<div><div class="muted small">Business value</div><div class="score-big">' + fmtScore(r.bv) + '</div></div>' +
      '<div><div class="muted small">Technical fit</div><div class="score-big">' + fmtScore(r.tf) + '</div></div>' +
      '<div><div class="muted small">TIME result</div><div style="margin-top:6px">' + badge(cat, r.overridden ? ' (override)' : '') + '</div>' +
      (cat ? '<div class="muted small" style="margin-top:4px">' + esc(CATS[cat].summary) + '</div>' : '') +
      (r.overridden ? '<div class="muted small">Calculated: ' + CATS[r.calculated].label + '</div>' : '') + '</div>' +
      '<div><div class="muted small">Completeness ' + Math.round(r.completeness * 100) + '%</div><div class="meter"><i style="width:' +
      Math.round(r.completeness * 100) + '%"></i></div></div></div>';
  }

  function touch(a) { a.updatedAt = new Date().toISOString(); save(); renderDashboard(); renderInventory(); }

  // ---------- settings ----------
  function renderSettings() {
    $('#threshold').value = state.settings.threshold;
    $('#threshold-out').textContent = Number(state.settings.threshold).toFixed(1);
    ['bv', 'tf'].forEach(function (dim) {
      var list = state.settings.criteria[dim];
      var total = list.reduce(function (s, c) { return s + (Number(c.weight) || 0); }, 0);
      var h = '<div class="weight-total">Total weight: <b>' + total + '</b> (weights are relative — they do not need to add up to 100)</div>';
      list.forEach(function (c, i) {
        h += '<div class="crit-edit" style="margin-bottom:14px"><div class="crit-row">' +
          '<input aria-label="Criterion name" data-dim="' + dim + '" data-i="' + i + '" data-f="name" value="' + esc(c.name) + '">' +
          '<input aria-label="Weight" type="number" min="0" step="1" data-dim="' + dim + '" data-i="' + i + '" data-f="weight" value="' + esc(c.weight) + '">' +
          '<button class="btn small danger" data-del-crit="' + dim + ':' + i + '" aria-label="Remove criterion">✕</button></div>' +
          '<input style="width:100%" placeholder="Description / guidance" data-dim="' + dim + '" data-i="' + i + '" data-f="help" value="' + esc(c.help) + '">' +
          '<div class="crit-row" style="grid-template-columns:1fr 1fr;margin-top:6px">' +
          '<input placeholder="What a 1 looks like" data-dim="' + dim + '" data-i="' + i + '" data-f="low" value="' + esc(c.low) + '">' +
          '<input placeholder="What a 5 looks like" data-dim="' + dim + '" data-i="' + i + '" data-f="high" value="' + esc(c.high) + '"></div></div>';
      });
      $('#crit-' + dim).innerHTML = h;
    });
  }

  // ---------- CSV import ----------
  function parseCSV(text) {
    var rows = [], row = [], field = '', q = false;
    text = text.replace(/^﻿/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim(); }); });
  }
  function importCSV(text) {
    var rows = parseCSV(text);
    if (rows.length < 2) throw new Error('CSV needs a header row and at least one data row');
    var head = rows[0].map(function (h) { return h.trim().toLowerCase().replace(/[^a-z]/g, ''); });
    var map = { name: ['name', 'application', 'app', 'applicationname'], owner: ['owner', 'businessowner'],
      domain: ['domain', 'capability', 'businesscapability'], annualCost: ['annualcost', 'cost'],
      users: ['users', 'numberofusers'], lifecycle: ['lifecycle', 'lifecyclestage'], notes: ['notes', 'description'] };
    var idx = {};
    Object.keys(map).forEach(function (k) {
      idx[k] = head.findIndex(function (h) { return map[k].indexOf(h) >= 0; });
    });
    if (idx.name < 0) throw new Error('CSV must have a "name" column');
    var added = 0;
    rows.slice(1).forEach(function (r) {
      var name = (r[idx.name] || '').trim();
      if (!name) return;
      function get(k) { return idx[k] >= 0 ? (r[idx[k]] || '').trim() : ''; }
      var num = function (v) { v = v.replace(/[^0-9.\-]/g, ''); return v === '' ? null : Number(v); };
      state.apps.push({ id: uid(), name: name, owner: get('owner'), domain: get('domain'), annualCost: num(get('annualCost')),
        users: num(get('users')), lifecycle: get('lifecycle'), notes: get('notes'), scores: {}, override: { category: '', reason: '' } });
      added++;
    });
    return added;
  }

  // ---------- render all ----------
  function renderAll() {
    renderDashboard();
    renderInventory();
    renderSettings();
    if (ui.view === 'assess') renderAssess();
  }

  // ---------- events ----------
  function bind() {
    $all('.tabs button').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.view); }); });

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action],[data-assess],[data-edit],[data-delete],[data-sort],[data-add-crit],[data-del-crit],[data-clear],.bubble');
      if (!t) return;
      if (t.classList.contains('bubble')) return openAssess(t.dataset.id);
      if (t.dataset.action === 'sample') return loadSample();
      if (t.dataset.action === 'goto-inventory') return show('inventory');
      if (t.dataset.assess) return openAssess(t.dataset.assess);
      if (t.dataset.edit) return openAppDialog(t.dataset.edit);
      if (t.dataset.delete) {
        var a = findApp(t.dataset.delete);
        if (a && confirm('Delete "' + a.name + '" and its assessment?')) {
          state.apps = state.apps.filter(function (x) { return x !== a; });
          commit(); toast('Deleted');
        }
        return;
      }
      if (t.dataset.sort) {
        ui.sort = { key: t.dataset.sort, dir: ui.sort.key === t.dataset.sort ? -ui.sort.dir : 1 };
        return renderInventory();
      }
      if (t.dataset.addCrit) {
        var dim = t.dataset.addCrit;
        state.settings.criteria[dim].push({ id: dim + '_' + uid(), name: 'New criterion', weight: 10, help: '', low: '', high: '' });
        return commit();
      }
      if (t.dataset.delCrit) {
        var p = t.dataset.delCrit.split(':');
        var list = state.settings.criteria[p[0]];
        if (list.length <= 1) return toast('Each dimension needs at least one criterion');
        if (confirm('Remove criterion "' + list[p[1]].name + '"? Existing scores for it will be ignored.')) {
          list.splice(Number(p[1]), 1); commit();
        }
        return;
      }
      if (t.dataset.clear) {
        var app = findApp(ui.assessId);
        delete app.scores[t.dataset.clear];
        touch(app); renderAssess();
      }
    });

    document.addEventListener('keydown', function (e) {
      var b = e.target.closest && e.target.closest('.bubble');
      if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openAssess(b.dataset.id); }
    });

    // Assess view
    $('#assess-select').addEventListener('change', function (e) { ui.assessId = e.target.value; renderAssess(); });
    $('#assess-prev').addEventListener('click', function () { step(-1); });
    $('#assess-next').addEventListener('click', function () { step(1); });
    $('#assess-body').addEventListener('change', function (e) {
      var a = findApp(ui.assessId);
      if (!a) return;
      if (e.target.type === 'radio') {
        a.scores[e.target.name] = Number(e.target.value);
        touch(a);
        renderAssessSummary();
        // update the dropdown label without re-rendering the form (keeps keyboard focus)
        var opt = $('#assess-select option[value="' + CSS.escape(a.id) + '"]');
        var r = S.assess(a, state.settings);
        if (opt) opt.textContent = a.name + ' — ' + (r.category ? CATS[r.category].label : 'not assessed');
      } else if (e.target.id === 'ov-cat') {
        a.override = a.override || {};
        a.override.category = e.target.value;
        touch(a); renderAssessSummary();
      }
    });
    $('#assess-body').addEventListener('input', function (e) {
      if (e.target.id !== 'ov-reason') return;
      var a = findApp(ui.assessId);
      a.override = a.override || {};
      a.override.reason = e.target.value;
      save();
      clearTimeout(renderDashboard._t);
      renderDashboard._t = setTimeout(renderDashboard, 400);
    });

    // Inventory
    $('#btn-add-app').addEventListener('click', function () { openAppDialog(); });
    $('#inv-search').addEventListener('input', function (e) { ui.search = e.target.value; renderInventory(); });
    $('#app-dialog').addEventListener('close', function () {
      if ($('#app-dialog').returnValue === 'save') saveAppDialog();
    });
    $('#btn-sample').addEventListener('click', loadSample);
    $('#btn-clear').addEventListener('click', function () {
      if (confirm('Delete ALL applications and assessments? Export a backup first if you need one.')) {
        state.apps = []; commit(); toast('All applications cleared');
      }
    });
    $('#btn-export-json').addEventListener('click', function () {
      download('time-assessment-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(state, null, 2), 'application/json');
    });
    $('#file-import-json').addEventListener('change', function (e) {
      readFile(e.target, function (text) {
        try {
          var data = normalise(JSON.parse(text));
          if (state.apps.length && !confirm('Replace your current ' + state.apps.length + ' application(s) with the imported file?')) return;
          state = data; ui.assessId = null; commit(); toast('Imported ' + state.apps.length + ' applications');
        } catch (err) { alert('Could not import: ' + err.message); }
      });
    });
    $('#file-import-csv').addEventListener('change', function (e) {
      readFile(e.target, function (text) {
        try { var n = importCSV(text); commit(); toast('Added ' + n + ' applications from CSV'); }
        catch (err) { alert('Could not import: ' + err.message); }
      });
    });

    // Dashboard
    $('#btn-export-csv').addEventListener('click', exportCSV);
    $('#btn-print').addEventListener('click', function () { show('dashboard'); window.print(); });

    // Settings
    $('#threshold').addEventListener('input', function (e) {
      state.settings.threshold = Number(e.target.value);
      $('#threshold-out').textContent = state.settings.threshold.toFixed(1);
      save(); renderDashboard(); renderInventory();
    });
    $('#view-settings').addEventListener('change', function (e) {
      var d = e.target.dataset;
      if (!d.dim) return;
      var c = state.settings.criteria[d.dim][Number(d.i)];
      c[d.f] = d.f === 'weight' ? Math.max(0, Number(e.target.value) || 0) : e.target.value.trim();
      commit();
    });
    $('#btn-reset-criteria').addEventListener('click', function () {
      if (confirm('Reset criteria, weights and threshold to the defaults? Scores for removed custom criteria will be ignored.')) {
        state.settings = S.defaultSettings(); commit(); toast('Criteria reset');
      }
    });
  }

  function step(dir) {
    var idx = state.apps.indexOf(findApp(ui.assessId)) + dir;
    if (idx >= 0 && idx < state.apps.length) { ui.assessId = state.apps[idx].id; renderAssess(); }
  }

  function loadSample() {
    if (state.apps.length && !confirm('Add the 12 sample applications to your current portfolio?')) return;
    window.TIME_SAMPLE_APPS.forEach(function (a) {
      state.apps.push(Object.assign({ id: uid(), override: { category: '', reason: '' } }, JSON.parse(JSON.stringify(a))));
    });
    commit();
    toast('Sample portfolio loaded');
  }

  bind();
  renderAll();
})();
