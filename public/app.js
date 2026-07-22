'use strict';

const $ = s => document.querySelector(s);

/* ---------- splash ---------- */
const SPLASH_T0 = (typeof performance !== 'undefined' ? performance.now() : 0);
let splashGone = false;
function hideSplash() {
  if (splashGone) return; splashGone = true;
  const wait = Math.max(0, 700 - ((typeof performance !== 'undefined' ? performance.now() : 700) - SPLASH_T0));
  setTimeout(() => {
    const sp = document.getElementById('splash');
    if (sp) { sp.classList.add('hide'); setTimeout(() => sp.remove(), 550); }
  }, wait);
}
// Safety net: never let the splash stick, even if init stalls.
setTimeout(hideSplash, 4000);
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

/* ---------- select population (only ports Ferryhopper can search) ---------- */
function codedPorts() { return state.data.ports.filter(p => state.data.portCodes[p]); }
function fillPortSelect(sel, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>` +
    codedPorts().map(p => `<option value="${p}">${p} · ${enLabel(p)}</option>`).join('');
}
const opColor = name => (state.data.operators.find(o => o.name === name) || {}).color || 'var(--accent)';

/* ---------- matching (for the 2023 reference hint) ---------- */
// Returns null if no match, else { fi, ti } boarding/alighting indices in seq.
function match(r) {
  let fi = -1, ti = -1;
  if (state.from) { fi = r.seq.indexOf(state.from); if (fi < 0) return null; }
  if (state.to) { ti = r.seq.indexOf(state.to, fi >= 0 ? fi + 1 : 0); if (ti < 0) return null; }
  return { fi, ti };
}

/* ---------- URL sync (shareable links) ---------- */
function readUrl() {
  const q = new URLSearchParams(location.search);
  state.from = q.get('from') || '';
  state.to = q.get('to') || '';
}
function writeUrl() {
  const q = new URLSearchParams();
  if (state.from) q.set('from', state.from);
  if (state.to) q.set('to', state.to);
  const qs = q.toString();
  history.replaceState(null, '', qs ? '?' + qs : location.pathname);
}

/* ---------- Ferryhopper live-search deep link ---------- */
function todayISO() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function updateFhButton() {
  const btn = $('#fhBtn');
  if (!btn) return;
  const codes = state.data.portCodes;
  const ready = state.from && state.to && state.from !== state.to && codes[state.from] && codes[state.to];
  if (ready) {
    const dv = ($('#dateSel') && $('#dateSel').value) || '';
    const dates = dv ? dv.replace(/-/g, '') : '';   // YYYY-MM-DD -> YYYYMMDD
    btn.href = `https://www.ferryhopper.com/en/booking/results?itinerary=${codes[state.from]},${codes[state.to]}`
      + (dates ? `&dates=${dates}` : '');
    btn.classList.remove('disabled'); btn.removeAttribute('aria-disabled');
    btn.textContent = `Search ${enLabel(state.from)} → ${enLabel(state.to)} on Ferryhopper →`;
  } else {
    btn.removeAttribute('href');
    btn.classList.add('disabled'); btn.setAttribute('aria-disabled', 'true');
    btn.textContent = state.from === state.to && state.from ? 'Choose two different ports' : 'Pick a From and To port';
  }
}

/* ---------- render (routes launcher + 2023 reference) ---------- */
function render() {
  writeUrl();
  updateFhButton();
  const box = $('#results');
  if (!box) return;
  if (!(state.from && state.to)) {
    box.innerHTML = `<div class="empty"><span class="big">⛴</span>Pick your departure and arrival port, then open Ferryhopper for live 2026 schedules &amp; prices.</div>`;
    return;
  }
  const rows = [];
  for (const r of state.data.routes) { const m = match(r); if (m) rows.push({ r, m }); }
  if (!rows.length) {
    box.innerHTML = `<div class="ref-head">No 2023 reference for this pair — check Ferryhopper above for current sailings.</div>`;
    return;
  }
  const ops = [...new Set(rows.map(x => x.r.op))];
  box.innerHTML =
    `<div class="ref-head">2023 reference · ${rows.length} line${rows.length > 1 ? 's' : ''} connected these ports · ${ops.join(', ')}</div>` +
    rows.slice(0, 12).map(refLine).join('') +
    (rows.length > 12 ? `<div class="ref-head">…and ${rows.length - 12} more</div>` : '');
}

// Compact, honest reference: operator + call sequence, no (stale) times/fares.
function refLine({ r, m }) {
  const path = r.seq.map((p, i) => {
    const end = i === m.fi || i === m.ti;
    const seg = m.fi >= 0 && m.ti >= 0 && i > m.fi && i < m.ti;
    const cls = end ? 'stop end' : (seg ? 'stop seg' : 'stop');
    const chip = `<span class="${cls}">${p}</span>`;
    if (i === r.seq.length - 1) return chip;
    const aSeg = m.fi >= 0 && m.ti >= 0 && i >= m.fi && i < m.ti;
    return chip + `<span class="arrow${aSeg ? ' seg' : ''}">→</span>`;
  }).join('');
  const days = r.days.length ? `<span class="ref-days">${r.days.map(dayEn).join(' ')}</span>` : '';
  return `<article class="ref-card" style="--op:${opColor(r.op)}">
    <div class="op-tag"><span class="dot" style="background:${opColor(r.op)}"></span>${r.op}${days}</div>
    <div class="path">${path}</div>
  </article>`;
}

/* ================= LIVE MAP ================= */
const live = { proj: null, drawn: false, sel: null, timer: null, vessels: [] };
const KIND = {
  passenger: { color: '#3ba0e8', label: 'Ferry / passenger' },
  hsc:       { color: '#2fd0a6', label: 'High-speed craft' },
  cargo:     { color: '#e8a53b', label: 'Cargo' },
  tanker:    { color: '#b98be0', label: 'Tanker' },
  other:     { color: '#8593b5', label: 'Other' }
};
const SVGNS = 'http://www.w3.org/2000/svg';
const MAPW = 760, MAPH = 800;

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + 's ago';
  const m = Math.round(s / 60);
  return m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago';
}

function buildProj(bbox) {
  const pad = 16;
  const kx = Math.cos(((bbox.n + bbox.s) / 2) * Math.PI / 180);
  const gw = (bbox.e - bbox.w) * kx, gh = (bbox.n - bbox.s);
  const scale = Math.min((MAPW - 2 * pad) / gw, (MAPH - 2 * pad) / gh);
  const offX = (MAPW - gw * scale) / 2, offY = (MAPH - gh * scale) / 2;
  return (lon, lat) => [offX + (lon - bbox.w) * kx * scale, offY + (bbox.n - lat) * scale];
}

async function drawCoast(bbox) {
  let rings;
  try { rings = await fetch('data/coastline.json').then(r => r.json()); } catch { rings = []; }
  const svg = $('#seamap');
  const overlaps = ring => {
    let minLon = 1e9, maxLon = -1e9, minLat = 1e9, maxLat = -1e9;
    for (const [lon, lat] of ring) { if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon; if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat; }
    return !(maxLon < bbox.w - .2 || minLon > bbox.e + .2 || maxLat < bbox.s - .2 || minLat > bbox.n + .2);
  };
  let d = '';
  for (const ring of rings) {
    if (!overlaps(ring)) continue;
    ring.forEach((p, i) => { const [x, y] = live.proj(p[0], p[1]); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); });
    d += 'Z';
  }
  const path = document.createElementNS(SVGNS, 'path');
  path.setAttribute('d', d); path.setAttribute('class', 'coast');
  svg.appendChild(path);
}

function renderLegend() {
  $('#mapLegend').innerHTML = Object.values(KIND)
    .map(k => `<span><i style="background:${k.color}"></i>${k.label}</span>`).join('');
}

function drawVessels() {
  const svg = $('#seamap');
  svg.querySelectorAll('.vessel, .vessel-halo').forEach(n => n.remove());
  for (const v of live.vessels) {
    const [x, y] = live.proj(v.lon, v.lat);
    if (x < -20 || x > MAPW + 20 || y < -20 || y > MAPH + 20) continue;
    const dir = v.heading != null ? v.heading : (v.cog != null ? v.cog : 0);
    const col = (KIND[v.kind] || KIND.other).color;
    if (live.sel === v.mmsi) {
      const halo = document.createElementNS(SVGNS, 'circle');
      halo.setAttribute('cx', x.toFixed(1)); halo.setAttribute('cy', y.toFixed(1)); halo.setAttribute('r', '11');
      halo.setAttribute('class', 'vessel-halo'); svg.appendChild(halo);
    }
    const g = document.createElementNS(SVGNS, 'path');
    // arrow pointing north, rotated to course/heading
    g.setAttribute('d', 'M0,-6.5 L4.2,6 L0,3.2 L-4.2,6 Z');
    g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${dir.toFixed(0)})`);
    g.setAttribute('fill', col);
    g.setAttribute('class', 'vessel' + (live.sel === v.mmsi ? ' sel' : ''));
    g.addEventListener('click', () => selectVessel(v.mmsi));
    svg.appendChild(g);
  }
}

function selectVessel(mmsi) {
  live.sel = mmsi; drawVessels();
  const v = live.vessels.find(x => x.mmsi === mmsi);
  const card = $('#vesselCard');
  if (!v) { card.hidden = true; return; }
  const k = KIND[v.kind] || KIND.other;
  card.innerHTML = `<button class="vclose" aria-label="Close">✕</button>
    <div class="vk" style="color:${k.color}">${k.label}</div>
    <h3>${v.name || 'Unknown vessel'}</h3>
    <div class="vrow"><span>Speed</span><b>${v.sog != null ? v.sog.toFixed(1) + ' kn' : '—'}</b></div>
    <div class="vrow"><span>Course</span><b>${v.cog != null ? Math.round(v.cog) + '°' : '—'}</b></div>
    ${v.dest ? `<div class="vrow"><span>Destination</span><b>${v.dest}</b></div>` : ''}
    <div class="vrow"><span>MMSI</span><b>${v.mmsi}</b></div>
    <div class="vrow"><span>Seen</span><b>${ago(v.ts)}</b></div>`;
  card.hidden = false;
  card.querySelector('.vclose').onclick = () => { live.sel = null; card.hidden = true; drawVessels(); };
}

async function refreshVessels() {
  let data;
  try { data = await fetch('/api/vessels').then(r => r.json()); }
  catch {
    $('#liveStatus').className = 'live-status';
    $('#liveStatus').innerHTML = `<span class="dot"></span>Live map needs the local server — run <b>npm start</b>.`;
    return;
  }
  live.vessels = data.vessels || [];
  if (!live.drawn && data.bbox) { live.proj = buildProj(data.bbox); await drawCoast(data.bbox); renderLegend(); live.drawn = true; }
  if (live.sel && !live.vessels.some(v => v.mmsi === live.sel)) { live.sel = null; $('#vesselCard').hidden = true; }
  drawVessels();
  if (live.sel) selectVessel(live.sel);
  const st = $('#liveStatus');
  const src = data.source;
  st.className = 'live-status ' + (src === 'live' ? 'live' : (src === 'demo' ? 'demo' : ''));
  const srcTxt = src === 'live' ? 'live'
    : src === 'demo' ? 'demo data (no API key)'
    : (data.note || (src === 'reconnecting' ? 'reconnecting…' : 'connecting…'));
  st.innerHTML = `<span class="dot"></span><b>${live.vessels.length}</b>&nbsp;vessels · ${srcTxt} · ${ago(data.updated)}`;
}

function startLive() {
  refreshVessels();
  clearInterval(live.timer);
  live.timer = setInterval(refreshVessels, 8000);
}
function stopLive() { clearInterval(live.timer); live.timer = null; }

/* ---------- view switching ---------- */
function showView(v) {
  const liveOn = v === 'live';
  $('#liveView').hidden = !liveOn;
  $('#routesView').hidden = liveOn;
  document.querySelectorAll('#tabs .tab').forEach(t => t.classList.toggle('on', t.dataset.view === v));
  localStorage.setItem('sr-view', v);
  if (liveOn) startLive(); else { stopLive(); render(); }
}

/* ---------- wiring ---------- */
function bind() {
  const from = $('#fromSel'), to = $('#toSel'), date = $('#dateSel');
  fillPortSelect(from, 'From — pick a port'); fillPortSelect(to, 'To — pick a port');
  from.value = state.from; to.value = state.to;          // reflect state restored from URL
  if (date && !date.value) date.value = todayISO();
  from.onchange = () => { state.from = from.value; render(); };
  to.onchange = () => { state.to = to.value; render(); };
  if (date) date.onchange = updateFhButton;
  $('#swapBtn').onclick = () => {
    [state.from, state.to] = [state.to, state.from];
    from.value = state.from; to.value = state.to; render();
  };
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
    hideSplash();
    return;
  }
  $('#footNote').textContent =
    `Live schedules & prices open on Ferryhopper. Routes reference: ${Object.keys(state.data.portCodes).length} ports · ${state.data.operators.length} operators (2023 data).`;
  readUrl();
  bind();

  document.querySelectorAll('#tabs .tab').forEach(t => t.onclick = () => showView(t.dataset.view));
  // A shared route link (?from=..) opens the routes tab; otherwise the live map.
  const wantRoutes = location.search.includes('from=') || location.search.includes('to=');
  showView(wantRoutes ? 'routes' : (localStorage.getItem('sr-view') || 'live'));
  hideSplash();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
