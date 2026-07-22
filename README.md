# SeaRoutes ⛴

A **Greek ferry routes & fares explorer** — search a departure and/or arrival
port and see scheduled sailings, times, days of operation, durations and fares
across the major operators. Built as a static, installable PWA on top of open
data from **[data.gov.gr](https://data.gov.gr)**.

## Data

Source: *Information about Maritime Transport in Greece* — the Greek **National
Access Point** (Hellenic Institute of Transport), published on data.gov.gr.

- Operators covered: **Blue Star / Hellenic Seaways, ANEK Lines, Zante Ferries, Minoan Lines**.
- It is a **static 2023 snapshot** (the dataset is distributed as yearly XLSX
  files, not a live API). **Always verify schedules & fares with the operator
  before travelling.**
- No real-time vessel tracking exists in this dataset — this app is about
  routes, timetables and fares, not live positions.

### Rebuilding the data

The app reads `public/data/routes.json`, generated from the source spreadsheet:

```bash
npm install        # installs xlsx (build-time only)
npm run build      # build/parse.js  ->  public/data/routes.json
```

Drop a newer `source-YYYY.xlsx` into `build/` and adjust `build/parse.js` to
regenerate.

## Running

Fully static — deployable to any static host (e.g. Vercel) by serving `public/`.
For local dev there's a tiny zero-dependency server:

```bash
npm start          # http://localhost:4900
```

or just double-click `start.bat` on Windows.

## Features

- **From / To port pickers** with Greek + Latin labels and a swap button.
- **Connections through intermediate stops** — picking two ports also finds
  sailings where you board mid-route (shown under "Along the way"), with the
  boarding→alighting segment highlighted along the full call sequence.
- Filter by **operator** and **day of week**; sort by departure, duration or fare.
- One-way / return fares, days-of-week pips, multiple daily departures.
- Dark/light theme, offline-capable (service worker), installable.
