# meritfinder

Find Elite Dangerous Powerplay systems where minerals sell well, with ring hotspots and planets to mine nearby.

## Local Installation & Setup

```
npm install
npm run ingest      # builds data/meritfinder.sqlite from the Spansh dump (~4.5 GB); about 1.5 hours the first time
npm run dev         # http://localhost:3000
npm run eddn-listener   # optional, in another terminal: keeps prices and Powerplay state current from EDDN
```

The ingest reads `data/galaxy_stations.json.gz` if it is there, and otherwise downloads it from Spansh once and keeps it there, so
rebuilding does not download again. To use a copy you already have, drop it in as that file
(<https://downloads.spansh.co.uk/galaxy_stations.json.gz>). `--download` fetches a fresh one; `--no-keep` leaves no copy.

Next.js, TypeScript, SQLite (better-sqlite3), Tailwind, Node 24+

## Layout

```
src/app/            routes, with the meritfinder dashboard under (finder)/
src/components/     ui/ (generic) and common/ (app-specific)
src/hooks/          client hooks
src/lib/            database, search, ingest, EDDN, rate limiting
src/data/           game data: powers, mining methods, ring and planet tables
scripts/            ingest, EDDN listener, database tools
deploy/             Docker Compose and Caddy
```

## Notes

- Planetary mining signals have a count but not a resource, and most planets have no signal data, so "no signal" means
  we don't know what signals a planet has. The material filter for planets is a community survey of likelihoods, not a guarantee. i.e. Monazite will match on any landable Rocky body.

## Credits

Data from Spansh / EDDN. Planetary likelihoods from a community survey (wiknow.pages.dev). Station icons and the loader from edassets.org (MIT). Inspired by meritminer.cc.
Elite Dangerous is copyright Frontier Developments plc. This project is not endorsed by Frontier Developments.
