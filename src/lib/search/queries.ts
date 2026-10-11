// The fixed per-system lookups the search runs for every candidate, kept here so the database check can verify each is answered from an index.
// A few names are shared by different systems (16 of 127,000); the lowest id64 wins so the answer is stable.
export const REF_SYSTEM = "SELECT name,x,y,z FROM systems WHERE name = ? COLLATE NOCASE ORDER BY id64 LIMIT 1";
export const BODIES_OF_SYSTEM =
  "SELECT body_id,name,subtype,volcanism,body_class,gravity,distance_ls,mining_signals FROM bodies WHERE system_id64=? ORDER BY distance_ls";
export const RINGS_OF_SYSTEM =
  "SELECT r.name, r.type, r.reserve, h.material, h.count FROM rings r LEFT JOIN ring_hotspots h ON h.system_id64=r.system_id64 AND h.ring_name=r.name WHERE r.system_id64=? ORDER BY r.name";

// Systems whose name starts with the typed text, for the reference-system suggestions. A range on the case-insensitive
// index (not LIKE, so "%" and "_" in the text are just characters).
export const SUGGEST_SYSTEMS =
  "SELECT name, controlling_power power FROM systems WHERE name COLLATE NOCASE >= @lo AND name COLLATE NOCASE < @hi ORDER BY name COLLATE NOCASE, id64 LIMIT @n";
