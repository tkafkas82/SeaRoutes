# SeaRoutes ⛴

Two things in one installable PWA:

1. **Live map** — real-time ferry/vessel positions in the **Western Cyclades**
   (Serifos, Sifnos, Milos, Kythnos, Kimolos… and the Piraeus/Lavrio approaches),
   from **AIS** via [aisstream.io](https://aisstream.io). Boats are drawn on an
   inline SVG of the region, colored by type and oriented to their course; click
   one for name, speed, course, destination and last-seen.
2. **Routes** — pick From / To / date and jump to **[Ferryhopper](https://www.ferryhopper.com)**
   for **live 2026 schedules & prices** (there's no free API for those, so the app
   deep-links into Ferryhopper's search: `booking/results?itinerary=A,B&dates=YYYYMMDD`
   using a Greek-name → Ferryhopper-code map). Below the button, a compact **2023
   reference** from **[data.gov.gr](https://data.gov.gr)** shows *which operators/lines
   connect the two ports* (call sequence + days only — no stale times/prices).

## Live map setup (aisstream key)

The live feed needs a **free** API key, and per aisstream's rules the key must
stay server-side — so the live map only works when the Node server is running
(`npm start`), not on pure static hosting.

1. Sign up at **https://aisstream.io** → create an API key.
2. `cp config.example.json config.json` and paste the key into `aisstreamKey`
   (or set the `AISSTREAM_API_KEY` env var). `config.json` is gitignored.
3. `npm start` → open the **Live map** tab.

Without a key the map still runs on a few **demo** vessels (clearly flagged).

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

```bash
npm install        # xlsx (build), ws (live AIS)
npm start          # http://localhost:4900
```

or double-click `start.bat` on Windows. The **Routes** tab is fully static (the
`public/` folder is Vercel-deployable on its own); the **Live map** tab needs
this Node server for the server-side aisstream connection.

## Features

- **Live map** — AIS vessel positions on an SVG of the Western Cyclades, colored
  by type (ferry/HSC/cargo/tanker), oriented to course; click for details. Polls
  every 8 s; server prunes vessels silent for 15 min.
- **From / To port pickers** (Greek + Latin labels, swap button) limited to ports
  Ferryhopper can search, plus a date field, feeding a live **Search on Ferryhopper** link.
- **2023 reference** below the search: which operators connect the two ports and the
  call sequence, with the boarding→alighting segment highlighted (no stale times/fares).
- **Custom ferry icon** + animated **splash screen**.
- Dark/light theme, shareable `?from=..&to=..` links, offline-capable, installable.
