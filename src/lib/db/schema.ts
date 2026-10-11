// The schema: migration 1 (migrations.ts). Once a database built from it is in use, change it with a new migration, not by editing this.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS systems (
  id64          INTEGER PRIMARY KEY,
  name          TEXT NOT NULL,
  x REAL, y REAL, z REAL,
  controlling_power TEXT,
  power_state   TEXT,            -- Fortified / Stronghold / Exploited / Unoccupied / ...
  powers        TEXT,            -- JSON array of powers present
  control_progress REAL,
  reinforcement REAL,
  undermining   REAL,
  updated_at    TEXT,            -- when this state was observed (ISO); a live update only applies if it is newer
  faction_state TEXT,            -- controlling faction's BGS state: Boom, Bust, War, Expansion...
  conflict      TEXT             -- JSON [{power, progress}] (powerConflictProgress)
);
CREATE INDEX IF NOT EXISTS systems_name ON systems(name COLLATE NOCASE);

-- Landable planets only.
-- Keyed by (system, bodyId): Spansh body id64s exceed 2^53 and would collide as JS numbers.
CREATE TABLE IF NOT EXISTS bodies (
  system_id64     INTEGER NOT NULL REFERENCES systems(id64),
  body_id         INTEGER NOT NULL,
  name            TEXT NOT NULL,
  subtype         TEXT,        -- Spansh subType, e.g. "Rocky body"
  volcanism       TEXT,        -- Spansh volcanismType
  body_class      TEXT,        -- BodyClass from src/data/body-resources.ts
  gravity         REAL,
  distance_ls     REAL,
  -- NULL = Spansh has no mining signal for this body. That means UNKNOWN, not none:
  -- bodies scanned before the feature existed never report it. See NOTES/PLAN.md.
  mining_signals  INTEGER,
  PRIMARY KEY (system_id64, body_id)
);
CREATE INDEX IF NOT EXISTS bodies_system ON bodies(system_id64);

-- Every ring, and the hotspots of those that have any (ring mining). Databases built before rings without
-- hotspots were stored hold only the rings that have them.
CREATE TABLE IF NOT EXISTS rings (
  system_id64     INTEGER NOT NULL REFERENCES systems(id64),
  name            TEXT NOT NULL,
  type            TEXT,        -- Metallic / Rocky / Icy / Metal Rich
  reserve         TEXT,        -- parent body's reserveLevel: Pristine / Major / Common / Low / Depleted
  PRIMARY KEY (system_id64, name)
);
CREATE TABLE IF NOT EXISTS ring_hotspots (
  system_id64 INTEGER NOT NULL,
  ring_name   TEXT NOT NULL,
  material    TEXT NOT NULL,   -- market name, e.g. "Monazite"
  count       INTEGER NOT NULL,
  PRIMARY KEY (system_id64, ring_name, material)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS ring_hotspots_material ON ring_hotspots(material);

-- Non-carrier stations that have a market.
CREATE TABLE IF NOT EXISTS stations (
  id          INTEGER PRIMARY KEY,   -- market id
  system_id64 INTEGER NOT NULL REFERENCES systems(id64),
  name        TEXT NOT NULL,
  type        TEXT,
  has_large   INTEGER NOT NULL DEFAULT 0,
  has_medium  INTEGER NOT NULL DEFAULT 0,
  distance_ls REAL,
  market_updated TEXT,         -- never older than MAX_MARKET_AGE_DAYS
  best_price    INTEGER        -- highest sell price of any commodity here: an upper bound used to rank systems cheaply
);
CREATE INDEX IF NOT EXISTS stations_system ON stations(system_id64);

-- Only commodities that currently have demand.
CREATE TABLE IF NOT EXISTS market (
  station_id INTEGER NOT NULL REFERENCES stations(id),
  commodity  TEXT NOT NULL,          -- display name, e.g. "Monazite"
  demand     INTEGER NOT NULL,
  sell_price INTEGER NOT NULL,
  PRIMARY KEY (station_id, commodity)
) WITHOUT ROWID;

-- EDDN names commodities by internal symbol ("powergridassembly"); the market shows "Energy Grid Assembly". Recorded by the ingest.
CREATE TABLE IF NOT EXISTS commodity_symbols (
  symbol TEXT PRIMARY KEY,           -- lower case
  name   TEXT NOT NULL
) WITHOUT ROWID;
`;
