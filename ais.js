'use strict';
/*
 * Live AIS vessel feed for the "Live map" view.
 *
 * aisstream.io explicitly says API keys must NOT be exposed in the browser, so
 * this runs server-side: we hold one WebSocket to aisstream, keep the latest
 * position per vessel in memory, and the PWA polls GET /api/vessels.
 *
 * Key resolution (first hit wins):
 *   1. env AISSTREAM_API_KEY
 *   2. ./config.json  ->  { "aisstreamKey": "..." }   (gitignored)
 * With no key we serve a small set of DEMO vessels so the map still works, and
 * flag the response source as "demo" so the UI can say so.
 */
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Western Cyclades + approaches (Piraeus/Lavrio down to Milos/Santorini).
// [south, west] .. [north, east]
const BBOX = { s: 36.3, w: 23.4, n: 38.15, e: 25.6 };
const STALE_MS = 15 * 60 * 1000;   // drop vessels silent for 15 min
const WS_URL = 'wss://stream.aisstream.io/v0/stream';

function loadKey() {
  if (process.env.AISSTREAM_API_KEY) return process.env.AISSTREAM_API_KEY.trim();
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    if (cfg.aisstreamKey && cfg.aisstreamKey !== 'PASTE_YOUR_AISSTREAM_KEY_HERE') return cfg.aisstreamKey.trim();
  } catch { /* no config file */ }
  return null;
}

const vessels = new Map();   // mmsi -> { mmsi, name, type, lat, lon, sog, cog, heading, nav, ts }
let connected = false;
let ws = null;
let backoff = 2000;

function classify(type) {
  if (type == null) return 'other';
  if (type >= 60 && type <= 69) return 'passenger';   // passenger ships
  if (type >= 40 && type <= 49) return 'hsc';         // high-speed craft (many Cyclades ferries)
  if (type >= 70 && type <= 79) return 'cargo';
  if (type >= 80 && type <= 89) return 'tanker';
  return 'other';
}

function upsert(mmsi, patch) {
  const v = vessels.get(mmsi) || { mmsi, name: null, type: null, kind: 'other' };
  Object.assign(v, patch);
  vessels.set(mmsi, v);
}

function connect() {
  const key = loadKey();
  if (!key) return; // demo mode — no socket
  ws = new WebSocket(WS_URL);
  ws.on('open', () => {
    backoff = 2000;
    ws.send(JSON.stringify({
      APIKey: key,
      BoundingBoxes: [[[BBOX.s, BBOX.w], [BBOX.n, BBOX.e]]],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData']
    }));
    connected = true;
    console.log('[ais] connected to aisstream, subscribed to Western Cyclades bbox');
  });
  ws.on('message', buf => {
    let msg; try { msg = JSON.parse(buf); } catch { return; }
    const meta = msg.Metadata || msg.MetaData || {};
    const mmsi = meta.MMSI;
    if (!mmsi) return;
    if (msg.MessageType === 'PositionReport') {
      const p = msg.Message.PositionReport;
      upsert(mmsi, {
        lat: p.Latitude, lon: p.Longitude,
        sog: p.Sog, cog: p.Cog,
        heading: (p.TrueHeading != null && p.TrueHeading !== 511) ? p.TrueHeading : null,
        nav: p.NavigationalStatus,
        name: vessels.get(mmsi)?.name || (meta.ShipName || '').trim() || null,
        ts: Date.now()
      });
    } else if (msg.MessageType === 'ShipStaticData') {
      const s = msg.Message.ShipStaticData;
      const type = s.Type;
      upsert(mmsi, {
        name: (s.Name || meta.ShipName || '').trim() || null,
        type, kind: classify(type),
        dest: (s.Destination || '').trim() || null
      });
    }
  });
  ws.on('close', () => { connected = false; scheduleReconnect(); });
  ws.on('error', e => { connected = false; console.warn('[ais] ws error:', e.message); try { ws.close(); } catch {} });
}
function scheduleReconnect() {
  backoff = Math.min(backoff * 1.6, 60000);
  setTimeout(connect, backoff);
}

/* ---- demo vessels (no key) ---- */
const DEMO = [
  { mmsi: 1, name: 'BLUE STAR NAXOS', kind: 'passenger', lat: 37.55, lon: 24.30, cog: 135, sog: 18 },
  { mmsi: 2, name: 'WORLDCHAMPION JET', kind: 'hsc', lat: 37.20, lon: 24.55, cog: 150, sog: 32 },
  { mmsi: 3, name: 'ADAMANTIOS KORAIS', kind: 'passenger', lat: 36.95, lon: 24.45, cog: 320, sog: 15 },
  { mmsi: 4, name: 'DIONISIOS SOLOMOS', kind: 'passenger', lat: 37.40, lon: 24.10, cog: 95, sog: 12 },
  { mmsi: 5, name: 'SIFNOS JET', kind: 'hsc', lat: 36.75, lon: 24.70, cog: 340, sog: 28 },
  { mmsi: 6, name: 'CARGO EXPRESS', kind: 'cargo', lat: 37.75, lon: 24.85, cog: 210, sog: 11 },
  { mmsi: 7, name: 'AQUA BLUE', kind: 'passenger', lat: 36.68, lon: 24.42, cog: 20, sog: 16 }
];
function demoVessels() {
  // gently drift along course so successive polls look alive
  const t = Date.now() / 1000;
  return DEMO.map(d => {
    const rad = (d.cog * Math.PI) / 180;
    const drift = ((t / 30) % 20 - 10) * (d.sog / 30) * 0.01; // small oscillation
    return {
      mmsi: d.mmsi, name: d.name, kind: d.kind, type: null,
      lat: +(d.lat + Math.cos(rad) * drift).toFixed(4),
      lon: +(d.lon + Math.sin(rad) * drift).toFixed(4),
      sog: d.sog, cog: d.cog, heading: d.cog, nav: 0, dest: null, ts: Date.now()
    };
  });
}

function getVessels() {
  const key = loadKey();
  if (!key) return { source: 'demo', updated: Date.now(), bbox: BBOX, vessels: demoVessels() };
  const now = Date.now();
  const list = [];
  for (const v of vessels.values()) {
    if (v.lat == null || v.lon == null) continue;
    if (now - v.ts > STALE_MS) { vessels.delete(v.mmsi); continue; }
    list.push(v);
  }
  return { source: connected ? 'live' : 'connecting', updated: now, bbox: BBOX, vessels: list };
}

function start() { connect(); }

module.exports = { start, getVessels, BBOX };
