import type { ReactNode } from "react";

// A small label in `color`: its outline, its text, and a faint wash behind. `color` is any CSS colour (a hex code, or a variable
// such as "var(--warn)"), and should be one that reads on the dark page. Children (a symbol and a name, say) sit on one centred line.
export function Badge({ color = "var(--muted)", className = "", title, children }: { color?: string; className?: string; title?: string; children: ReactNode }) {
  return (
    <span
      className={`relative inline-flex h-[1.3rem] items-center whitespace-nowrap border px-2 font-display text-[0.75rem] uppercase leading-none tracking-[0.06em] ${className}`.trim()}
      style={{ borderColor: color, color }}
      title={title}
    >
      <span aria-hidden className="absolute inset-0 opacity-[0.12]" style={{ background: color }} />
      <span className="relative inline-flex items-center gap-1.5">{children}</span>
    </span>
  );
}
