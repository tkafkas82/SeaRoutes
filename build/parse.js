'use strict';
/*
 * Build step: read the National Access Point maritime XLSX (2023) and emit a
 * clean routes.json the static PWA consumes. Not a runtime dependency — run
 * `npm run build` whenever a newer source spreadsheet is dropped in build/.
 *
 * Each sheet = one operator. Layout is several tables laid out side by side:
 *   [ Δρομολόγια + fares ] [ Λιμάνια / agencies ] [ Γενικές πληροφορίες ]
 * Row 0 = section titles, row 1 = column headers, data below. Fare columns
 * differ per operator (Zante has no return; Minoan has 20/30/50% tiers), so we
 * map columns by their header text rather than by position.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'source-2023.xlsx');
const OUT = path.join(__dirname, '..', 'public', 'data', 'routes.json');
const SOURCE_YEAR = 2023;

const OPERATORS = {
  'BLUE STAR-HELLENIC SEAWAYS': { name: 'Blue Star / Hellenic Seaways', color: '#1f6fd6' },
  'ΑΝΕΚ':    { name: 'ANEK Lines',    color: '#e23b3b' },
  'ΖΑΝΤΕ':   { name: 'Zante Ferries', color: '#2fa66b' },
  'ΜΙΝΟΑΝ':  { name: 'Minoan Lines',  color: '#e88a1a' }
};

const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// Ports arrive inconsistently: Minoan uses Title-case accented Greek
// (Μήλος), the others ALL-CAPS (ΜΗΛΟΣ), plus a few slash-abbreviations and
// typos. Canonicalize to accent-free uppercase and map the known aliases so
// the same port is one entry everywhere.
const ALIAS = {
  'ΑΛΕΞ/ΠΟΛΗ': 'ΑΛΕΞΑΝΔΡΟΥΠΟΛΗ',
  'ΦΟΛ/ΡΟΣ': 'ΦΟΛΕΓΑΝΔΡΟΣ',
  'ΦΟΛ/ΛΟΣ': 'ΦΟΛΕΓΑΝΔΡΟΣ',
  'ΔΙΑΦΙΑΝΙ': 'ΔΙΑΦΑΝΙ',
  'ΣΑΝΤΟΡΙΝΗ': 'ΘΗΡΑ',   // same island/port — operators name it both ways
  // source duplicates / typos → canonical
  'ΑΓ.ΚΗΡΥΚΟΣ': 'ΑΓΙΟΣ ΚΗΡΥΚΟΣ',
  'ΑΓΙΟΣ ΚΥΡΗΚΟΣ': 'ΑΓΙΟΣ ΚΗΡΥΚΟΣ',
  'ΚΟΥΓΟΝΗΣΙΑ': 'ΚΟΥΦΟΝΗΣΙΑ',
  'ΝΙΣΗΡΟΣ': 'ΝΙΣΥΡΟΣ',
  'ΒΑΘΥ ΣΑΜΟΥ': 'ΒΑΘΥ'
};

// Canonical Greek port → Ferryhopper 3-letter code, for live deep-links into
// ferryhopper.com/en/booking/results?itinerary=A,B&dates=YYYYMMDD. Harvested
// from Ferryhopper's own booking links. Ports without a code (mostly Sporades/
// mainland, outside this app's Cyclades focus) are simply omitted from the picker.
const FH_CODE = {
  'ΠΕΙΡΑΙΑΣ': 'PIR', 'ΛΑΥΡΙΟ': 'LAV', 'ΡΑΦΗΝΑ': 'RAF',
  'ΚΥΘΝΟΣ': 'KYT', 'ΚΕΑ': 'KEA', 'ΣΕΡΙΦΟΣ': 'SER', 'ΣΙΦΝΟΣ': 'SIF',
  'ΜΗΛΟΣ': 'MLO', 'ΚΙΜΩΛΟΣ': 'KMS', 'ΦΟΛΕΓΑΝΔΡΟΣ': 'FOL', 'ΣΙΚΙΝΟΣ': 'SIK',
  'ΙΟΣ': 'IOS', 'ΘΗΡΑ': 'JTR', 'ΑΝΑΦΗ': 'ANA',
  'ΠΑΡΟΣ': 'PAS', 'ΝΑΞΟΣ': 'JNX', 'ΣΥΡΟΣ': 'JSY', 'ΜΥΚΟΝΟΣ': 'JMK', 'ΤΗΝΟΣ': 'TIN',
  'ΚΑΤΑΠΟΛΑ': 'AMO', 'ΑΙΓΙΑΛΗ': 'AIG', 'ΚΟΥΦΟΝΗΣΙΑ': 'KOU', 'ΔΟΝΟΥΣΑ': 'DON',
  'ΣΧΟΙΝΟΥΣΑ': 'SXI', 'ΗΡΑΚΛΕΙΑ': 'IRK',
  'ΗΡΑΚΛΕΙΟ': 'HER', 'ΧΑΝΙΑ': 'CHA', 'ΡΕΘΥΜΝΟ': 'RNO', 'ΣΗΤΕΙΑ': 'JSH', 'ΚΙΣΣΑΜΟΣ': 'KIS',
  'ΡΟΔΟΣ': 'RHO', 'ΚΩΣ': 'KGS', 'ΚΑΛΥΜΝΟΣ': 'KAL', 'ΛΕΡΟΣ': 'LER', 'ΛΕΙΨΟΙ': 'LIP',
  'ΠΑΤΜΟΣ': 'PMS', 'ΑΣΤΥΠΑΛΑΙΑ': 'JTY', 'ΝΙΣΥΡΟΣ': 'NIS', 'ΤΗΛΟΣ': 'THL', 'ΣΥΜΗ': 'SYM',
  'ΚΑΡΠΑΘΟΣ': 'AOK', 'ΚΑΣΟΣ': 'KSJ', 'ΧΑΛΚΗ': 'CHL', 'ΔΙΑΦΑΝΙ': 'DFN', 'ΚΑΣΤΕΛΛΟΡΙΖΟ': 'KAZ',
  'ΧΙΟΣ': 'CHI', 'ΜΥΤΙΛΗΝΗ': 'LES', 'ΨΑΡΑ': 'PHA', 'ΦΟΥΡΝΟΙ': 'FOU',
  'ΑΓΙΟΣ ΚΗΡΥΚΟΣ': 'AGK', 'ΕΥΔΗΛΟΣ': 'EYD', 'ΚΑΡΛΟΒΑΣΙ': 'KAR', 'ΒΑΘΥ': 'BTH', 'ΣΑΜΟΣ': 'BTH',
  'ΜΕΣΤΑ ΧΙΟΥ': 'MHI', 'ΣΙΓΡΙ ΛΕΣΒΟΥ': 'SIG',
  'ΑΛΕΞΑΝΔΡΟΥΠΟΛΗ': 'AXL', 'ΣΑΜΟΘΡΑΚΗ': 'SAM', 'ΚΑΒΑΛΑ': 'KAV', 'ΛΗΜΝΟΣ': 'LMN',
  'ΑΙΓΙΝΑ': 'AEG', 'ΥΔΡΑ': 'HYD', 'ΠΟΡΟΣ': 'POR', 'ΣΠΕΤΣΕΣ': 'SPE',
  'ΕΡΜΙΟΝΗ': 'ERM', 'ΠΟΡΤΟ ΧΕΛΙ': 'PHE', 'ΑΓΚΙΣΤΡΙ(ΜΥΛΟΙ)': 'AGG'
};
function canon(raw) {
  let s = norm(raw);
  if (!s) return '';
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); // strip Greek accents
  s = s.toUpperCase().replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')');
  return ALIAS[s] || s;
}

// Duration comes as "1h", "0:40", "4:55", "8h50m", "5:00" — unify to minutes.
function parseDuration(v) {
  const s = norm(v);
  if (!s) return { min: null, disp: null };
  let h = 0, m = 0, ok = false;
  let mm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (mm) { h = +mm[1]; m = +mm[2]; ok = true; }
  else {
    mm = s.match(/(\d+)\s*h/i); if (mm) { h = +mm[1]; ok = true; }
    mm = s.match(/(\d+)\s*m/i); if (mm) { m = +mm[1]; ok = true; }
  }
  if (!ok) return { min: null, disp: s };
  const min = h * 60 + m;
  const disp = (h ? h + 'h' : '') + (m ? ' ' + m + 'm' : '');
  return { min, disp: disp.trim() || '0m' };
}

// Locate the header row (the one carrying "Από" & "Προς") and return a
// { headerText -> columnIndex } map plus that row's index.
function headerMap(grid) {
  for (let r = 0; r < Math.min(6, grid.length); r++) {
    const row = grid[r].map(norm);
    if (row.includes('Από') && row.includes('Προς')) {
      const map = {};
      row.forEach((h, i) => { if (h && !(h in map)) map[h] = i; });
      return { map, row: r };
    }
  }
  return null;
}

function splitTimes(v) {
  return norm(v).split(/[,\s]+/).map(t => t.trim())
    .filter(t => /^\d{1,2}:\d{2}$/.test(t))
    .map(t => t.length === 4 ? '0' + t : t); // 8:00 -> 08:00
}
function splitList(v) {
  return norm(v).split(',').map(x => x.trim()).filter(Boolean);
}
function toNum(v) {
  const s = norm(v).replace(',', '.').replace(/[^\d.]/g, '');
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
// Greek weekday codes -> {order, en}
const DAY = {
  'ΔΕΥ': { i: 0, en: 'Mon' }, 'ΤΡΙ': { i: 1, en: 'Tue' }, 'ΤΕΤ': { i: 2, en: 'Wed' },
  'ΠΕΜ': { i: 3, en: 'Thu' }, 'ΠΑΡ': { i: 4, en: 'Fri' }, 'ΣΑΒ': { i: 5, en: 'Sat' },
  'ΚΥΡ': { i: 6, en: 'Sun' }
};
function parseDays(v) {
  const out = [];
  splitList(v.replace(/\s/g, '')).forEach(tok => {
    // tokens may look like ΔΕΥ or Δευ; uppercase & strip accents-ish
    const key = tok.toUpperCase().slice(0, 3);
    if (DAY[key] && !out.includes(key)) out.push(key);
  });
  return out.sort((a, b) => DAY[a].i - DAY[b].i);
}

const wb = XLSX.readFile(SRC);
const routes = [];
const ports = new Set();

for (const sheet of wb.SheetNames) {
  const op = OPERATORS[sheet.trim()];
  if (!op) continue;
  const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: false, defval: '' });
  const hm = headerMap(grid);
  if (!hm) { console.warn('No header row in sheet', sheet); continue; }
  const c = hm.map;
  const col = (row, name) => (c[name] != null ? norm(row[c[name]]) : '');

  for (let r = hm.row + 1; r < grid.length; r++) {
    const row = grid[r];
    const from = canon(col(row, 'Από')), to = canon(col(row, 'Προς'));
    if (!from || !to) continue;
    const depTimes = splitTimes(col(row, 'Ώρα αναχώρησης'));
    const arrTimes = splitTimes(col(row, 'Ώρα άφιξης'));
    const days = parseDays(col(row, 'Ημέρες'));
    const stops = splitList(col(row, 'Ενδιάμεσες στάσεις')).map(canon);
    const seq = [from, ...stops, to];       // full ordered call sequence
    seq.forEach(p => ports.add(p));
    const dur = parseDuration(col(row, 'Διάρκεια'));
    routes.push({
      op: op.name,
      from, to,
      dep: depTimes,
      arr: arrTimes,
      firstDep: depTimes[0] || null,        // for sorting
      durMin: dur.min,
      dur: dur.disp,
      days,
      stops,
      seq,
      fareOneWay: toNum(col(row, 'ΑΠΛΟ')),
      fareReturn: toNum(col(row, 'ΜΕ ΕΠΙΣΤΡΟΦΗ')),
      fareReduced: toNum(col(row, '50% ΑΠΛΟ'))
    });
  }
}

const operators = Object.values(OPERATORS).map(o => ({ name: o.name, color: o.color }));
const portCodes = {};
for (const p of ports) if (FH_CODE[p]) portCodes[p] = FH_CODE[p];
const missing = [...ports].filter(p => !FH_CODE[p]);
if (missing.length) console.log('No Ferryhopper code (omitted from picker):', missing.join(', '));
const out = {
  sourceYear: SOURCE_YEAR,
  source: 'National Access Point (data.gov.gr) — Information about Maritime Transport in Greece',
  builtRoutes: routes.length,
  operators,
  ports: [...ports].sort((a, b) => a.localeCompare(b, 'el')),
  portCodes,   // canonical Greek name -> Ferryhopper code (for live search links)
  routes
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log(`Wrote ${routes.length} routes, ${out.ports.length} ports across ${operators.length} operators -> ${path.relative(process.cwd(), OUT)}`);
