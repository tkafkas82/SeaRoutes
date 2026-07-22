'use strict';

const $ = s => document.querySelector(s);
const state = { data: null, from: '', to: '', ops: new Set(), day: '', sort: 'dep' };

/* ---------- Greek → Latin port labels ---------- */
// Common ports get their usual English name; the rest are transliterated so a
// non-Greek reader still gets a hint. Purely cosmetic (a subtitle).
const EN_NAME = {
  'ΠΕΙΡΑΙΑΣ': 'Piraeus', 'ΘΗΡΑ': 'Santorini', 'ΗΡΑΚΛΕΙΟ': 'Heraklion', 'ΧΑΝΙΑ': 'Chania',
  'ΡΟΔΟΣ': 'Rhodes', 'ΚΕΡΚΥΡΑ': 'Corfu', 'ΜΥΚΟΝΟΣ': 'Mykonos', 'ΝΑΞΟΣ': 'Naxos',
  'ΠΑΡΟΣ': 'Paros', 'ΣΕΡΙΦΟΣ': 'Serifos', 'ΣΙΦΝΟΣ': 'Sifnos', 'ΜΗΛΟΣ': 'Milos',
  'ΚΥΘΝΟΣ': 'Kythnos', 'ΚΙΜΩΛΟΣ': 'Kimolos', 'ΦΟΛΕΓΑΝΔΡΟΣ': 'Folegandros', 'ΙΟΣ': 'Ios',
  'ΣΙΚΙΝΟΣ': 'Sikinos', 'ΑΝΑΦΗ': 'Anafi', 'ΒΟΛΟΣ': 'Volos', 'ΑΛΕΞΑΝΔΡΟΥΠΟΛΗ': 'Alexandroupoli',
  'ΛΑΥΡΙΟ': 'Lavrio', 'ΡΑΦΗΝΑ': 'Rafina', 'ΑΙΓΙΝΑ': 'Aegina', 'ΚΑΡΠΑΘΟΣ': 'Karpathos',
  'ΚΑΣΟΣ': 'Kasos', 'ΧΑΛΚΗ': 'Halki', 'ΣΗΤΕΙΑ': 'Sitia', 'ΣΑΜΟΘΡΑΚΗ': 'Samothraki'
};
const GR2LAT = { Α:'A',Β:'V',Γ:'G',Δ:'D',Ε:'E',Ζ:'Z',Η:'I',Θ:'Th',Ι:'I',Κ:'K',Λ:'L',Μ:'M',
  Ν:'N',Ξ:'X',Ο:'O',Π:'P',Ρ:'R',Σ:'S',Τ:'T',Υ:'Y',Φ:'F',Χ:'Ch',Ψ:'Ps',Ω:'O' };
function translit(gr) {
  const base = gr.replace(/\([^)]*\)/g, '').trim();
  let out = base.replace(/ΟΥ/g, 'OU').replace(/ΜΠ/g, 'B').replace(/ΝΤ/g, 'D');
  out = [...out].map(ch => GR2LAT[ch] != null ? GR2LAT[ch] : ch).join('');
  return out.charAt(0) + out.slice(1).toLowerCase();
}
function enLabel(gr) {
  if (EN_NAME[gr]) return EN_NAME[gr];
  const m = gr.match(/\(([^)]+)\)/);              // ΑΓΚΙΣΤΡΙ(ΜΥΛΟΙ)
  const isl = gr.replace(/\([^)]*\)/g, '').trim();
  const base = EN_NAME[isl] || translit(isl);
  return m ? `${base} (${translit(m[1])})` : base;
}

const DAYS = [['ΔΕΥ','Mon'],['ΤΡΙ','Tue'],['ΤΕΤ','Wed'],['ΠΕΜ','Thu'],['ΠΑΡ','Fri'],['ΣΑΒ','Sat'],['ΚΥΡ','Sun']];
const dayEn = gr => (DAYS.find(d => d[0] === gr) || [,''])[1];

/* ---------- select population ---------- */
function fillPortSelect(sel, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    state.data.ports.map(p => `<option value="${p}">${p} · ${enLabel(p)}</option>`).join('');
}
function fillDaySelect(sel) {
  sel.innerHTML = `<option value="">Any day</option>` +
    DAYS.map(d => `<option value="${d[0]}">${d[1]}</option>`).join('');
}
function renderOpChips() {
  const wrap = $('#opChips');
  wrap.innerHTML = '';
  for (const op of state.data.operators) {
    const chip = document.createElement('button');
    chip.className = 'op-chip' + (state.ops.has(op.name) ? ' on' : '');
    chip.innerHTML = `<span class="dot" style="background:${op.color}"></span>${op.name}`;
    chip.onclick = () => { state.ops.has(op.name) ? state.ops.delete(op.name) : state.ops.add(op.name); renderOpChips(); render(); };
    wrap.appendChild(chip);
  }
}
const opColor = name => (state.data.operators.find(o => o.name === name) || {}).color || 'var(--accent)';

/* ---------- matching ---------- */
// Returns null if no match, else { fi, ti } boarding/alighting indices in seq.
function match(r) {
  if (state.ops.size && !state.ops.has(r.op)) return null;
  if (state.day && !r.days.includes(state.day)) return null;
  let fi = -1, ti = -1;
  if (state.from) {
    fi = r.seq.indexOf(state.from);
    if (fi < 0) return null;
  }
  if (state.to) {
    ti = r.seq.indexOf(state.to, fi >= 0 ? fi + 1 : 0);
    if (ti < 0) return null;
  }
  return { fi, ti };
}
function sortKey(r) {
  if (state.sort === 'dur') return r.durMin == null ? 1e9 : r.durMin;
  if (state.sort === 'fare') return r.fareOneWay == null ? 1e9 : r.fareOneWay;
  return r.firstDep ? +r.firstDep.replace(':', '') : 1e9;
}

/* ---------- URL sync (shareable links) ---------- */
function readUrl() {
  const q = new URLSearchParams(location.search);
  state.from = q.get('from') || '';
  state.to = q.get('to') || '';
  state.day = q.get('day') || '';
  state.sort = q.get('sort') || 'dep';
  state.ops = new Set((q.get('ops') || '').split('|').filter(Boolean));
}
function writeUrl() {
  const q = new URLSearchParams();
  if (state.from) q.set('from', state.from);
  if (state.to) q.set('to', state.to);
  if (state.day) q.set('day', state.day);
  if (state.sort !== 'dep') q.set('sort', state.sort);
  if (state.ops.size) q.set('ops', [...state.ops].join('|'));
  const qs = q.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

/* ---------- render ---------- */
function render() {
  writeUrl();
  const box = $('#results');
  const both = state.from && state.to;
  const rows = [];
  for (const r of state.data.routes) {
    const m = match(r);
    if (m) rows.push({ r, m });
  }
  rows.sort((a, b) => sortKey(a.r) - sortKey(b.r));

  // stat line
  $('#statbar').innerHTML =
    `<b>${rows.length}</b> ${rows.length === 1 ? 'sailing' : 'sailings'}` +
    (state.from || state.to ? ' match' : ` · <b>${state.data.ports.length}</b> ports · <b>${state.data.operators.length}</b> operators`);

  if (!rows.length) {
    box.innerHTML = `<div class="empty"><span class="big">⛴</span>${
      state.from || state.to || state.ops.size || state.day
        ? 'No sailings match. Try clearing a filter or picking different ports.'
        : 'Pick a departure and/or arrival port to see ferry routes, times and fares.'}</div>`;
    return;
  }

  if (both) {
    const direct = rows.filter(x => x.r.from === state.from && x.r.to === state.to);
    const via = rows.filter(x => !(x.r.from === state.from && x.r.to === state.to));
    box.innerHTML =
      (direct.length ? `<div class="group-head">Direct — ${enLabel(state.from)} → ${enLabel(state.to)}</div>` + direct.map(x => card(x, false)).join('') : '') +
      (via.length ? `<div class="group-head">Along the way (board mid-route)</div>` + via.map(x => card(x, true)).join('') : '');
  } else {
    box.innerHTML = rows.map(x => card(x, false)).join('');
  }
}

// via = the user's ports are a sub-segment of this route, so the route's single
// published fare/departure are for its own origin→destination, not the segment.
function card({ r, m }, via) {
  const highlight = m.fi >= 0 || m.ti >= 0;
  const path = r.seq.map((p, i) => {
    const isEnd = (i === m.fi) || (i === m.ti) || (!highlight && (i === 0 || i === r.seq.length - 1));
    const inSeg = highlight && m.fi >= 0 && m.ti >= 0 && i > m.fi && i < m.ti;
    const cls = isEnd ? 'stop end' : (inSeg ? 'stop seg' : 'stop');
    const chip = `<span class="${cls}">${p}${isEnd ? ` <small>${enLabel(p)}</small>` : ''}</span>`;
    if (i === r.seq.length - 1) return chip;
    const aSeg = highlight && m.fi >= 0 && m.ti >= 0 && i >= m.fi && i < m.ti;
    return chip + `<span class="arrow${aSeg ? ' seg' : ''}">→</span>`;
  }).join('');

  const days = DAYS.map(([gr, en]) => {
    const on = r.days.includes(gr);
    const hl = state.day === gr;
    return `<span class="day-pip${on ? ' on' : ''}${hl ? ' hl' : ''}" title="${en}">${en[0]}</span>`;
  }).join('');

  const fares = [];
  if (r.fareOneWay != null) fares.push(`<span class="fare">one-way <b>€${r.fareOneWay}</b></span>`);
  if (r.fareReturn != null) fares.push(`<span class="fare ret">return <b>€${r.fareReturn}</b></span>`);
  // On via cards the fare/time belong to the whole route, so say so.
  const fareLbl = via ? `<span class="fare-note">full route ${r.from} → ${r.to}:</span>` : '';

  const depMain = r.firstDep || '—';
  const depLbl = via ? `<span class="dep-note">dep. ${r.from}</span>` : '';
  const altDeps = r.dep.length > 1
    ? `<div class="alt-deps">Departures${via ? ` from ${r.from}` : ''}: ${r.dep.map(t => `<b>${t}</b>`).join(', ')}</div>` : '';

  return `<article class="card" style="--op:${opColor(r.op)}">
    <div class="card-top">
      <span class="op-tag"><span class="dot" style="background:${opColor(r.op)}"></span>${r.op}</span>
      <span class="times">${depLbl}<span class="dep-main">${depMain}</span>${r.dur ? `<span class="dur-pill">${r.dur}</span>` : ''}</span>
    </div>
    <div class="path">${path}</div>
    ${altDeps}
    <div class="card-bottom">
      <span class="days">${days}</span>
      <span class="fares">${fareLbl}${fares.join('')}</span>
    </div>
  </article>`;
}

/* ---------- wiring ---------- */
function bind() {
  const from = $('#fromSel'), to = $('#toSel'), day = $('#daySel'), sort = $('#sortSel');
  fillPortSelect(from, 'Any port'); fillPortSelect(to, 'Any port'); fillDaySelect(day);
  // reflect any state restored from the URL
  from.value = state.from; to.value = state.to; day.value = state.day; sort.value = state.sort;
  from.onchange = () => { state.from = from.value; render(); };
  to.onchange = () => { state.to = to.value; render(); };
  day.onchange = () => { state.day = day.value; render(); };
  sort.onchange = () => { state.sort = sort.value; render(); };
  $('#swapBtn').onclick = () => {
    [state.from, state.to] = [state.to, state.from];
    from.value = state.from; to.value = state.to; render();
  };
  $('#clearBtn').onclick = () => {
    state.from = state.to = state.day = ''; state.ops.clear(); state.sort = 'dep';
    from.value = to.value = day.value = ''; sort.value = 'dep';
    renderOpChips(); render();
  };
  renderOpChips();
}

async function init() {
  const saved = localStorage.getItem('sr-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  $('#themeBtn').onclick = () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', cur);
    localStorage.setItem('sr-theme', cur);
  };

  try {
    state.data = await fetch('data/routes.json').then(r => r.json());
  } catch (e) {
    $('#results').innerHTML = '<div class="empty">Could not load route data.</div>';
    return;
  }
  $('#dataYear').textContent = state.data.sourceYear;
  $('#footNote').textContent =
    `${state.data.routes.length} scheduled sailings · ${state.data.operators.length} operators · data ${state.data.sourceYear}.`;
  readUrl();
  bind();
  render();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
