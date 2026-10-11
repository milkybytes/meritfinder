"use client";

import { Dropdown } from "@/components/ui/Dropdown";
import { FIELD_LABEL } from "@/components/ui/styles";
import { POWER_COLORS, THEME_NAMES } from "@/data/powers";
import { useTheme } from "@/hooks/useTheme";

const OPTIONS = Object.keys(POWER_COLORS).map((power) => ({ value: power, label: THEME_NAMES[power], dot: POWER_COLORS[power] }));

// Colour theme by Powerplay power (see useTheme).
export function ThemePicker() {
  const [theme, choose] = useTheme();

  return (
    <div className="flex items-center gap-2">
      <span className={FIELD_LABEL} aria-hidden="true">
        Theme
      </span>
      <Dropdown label="Colour theme" hideLabel compact options={OPTIONS} value={theme} onChange={choose} />
    </div>
  );
}
