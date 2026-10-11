import { useEffect, useState } from "react";

import { DEFAULT_THEME, POWER_COLORS, THEME_STORAGE_KEY, themeFor } from "@/data/powers";

// The colour theme (a Powerplay power's name): purely client-side. Choosing one sets the CSS variables on <html> and remembers the
// choice in localStorage; the saved one is read after mount. (The layout also applies the saved theme before first paint.)
export function useTheme(): [string, (name: string) => void] {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved && POWER_COLORS[saved]) setTheme(saved); // eslint-disable-line react-hooks/set-state-in-effect -- sync from storage after mount
    } catch {
      // storage unavailable: stay on the default
    }
  }, []);

  const choose = (name: string) => {
    setTheme(name);
    const t = themeFor(name);
    document.documentElement.style.setProperty("--hue", String(t.hue));
    document.documentElement.style.setProperty("--accent", t.accent);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, name);
    } catch {
      // the choice just won't persist
    }
  };

  return [theme, choose];
}
