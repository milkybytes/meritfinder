// The colour of each state, as a hex code. To recolour a state, change its line. Badges draw their text in the colour, so use ones that
// read on the dark page. A state not listed here is shown in the muted default.

// A system's controlling faction's state: the label under a system's name, and the "System state" filter.
export const FACTION_STATE_COLORS: Record<string, string> = {
  // economy up
  Boom: "#4ade80",
  Investment: "#4ade80",
  "Public Holiday": "#4ade80",
  "Civil Liberty": "#4ade80",
  Expansion: "#22d3ee",
  // economy down
  Bust: "#f87171",
  Famine: "#f87171",
  Drought: "#f87171",
  Blight: "#f87171",
  "Infrastructure Failure": "#f87171",
  "Natural Disaster": "#f87171",
  Retreat: "#f87171",
  // conflict
  War: "#fbbf24",
  "Civil War": "#fbbf24",
  Election: "#fbbf24",
  // unrest
  "Civil Unrest": "#f472b6",
  Lockdown: "#f472b6",
  Outbreak: "#f472b6",
  "Pirate Attack": "#f472b6",
  "Terrorist Attack": "#f472b6",
  // Thargoid
  Incursion: "#fb923c",
  "Thargoid Alert": "#a3e635",
  "Thargoid Invasion": "#84cc16",
  "Thargoid Controlled": "#65a30d",
  "Thargoid Titan": "#ef4444",
  "Post-Thargoid Recovery": "#2dd4bf",
  Counterstrike: "#38bdf8",
};

// A system's Powerplay state, as shown beside its power (the symbol for each is in components/common/StateTag.tsx).
export const POWERPLAY_STATE_COLORS: Record<string, string> = {
  Stronghold: "#c084fc", // purple
  Fortified: "#4ade80", // green
  Exploited: "#f87171", // red
  Contested: "#facc15", // yellow
  Unoccupied: "#9ca3af", // grey
  Expansion: "#60a5fa", // blue
};
