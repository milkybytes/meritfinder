// Looks that several components share, as Tailwind class strings. A component's own, one-off styling is written in its own JSX; only
// what is used in more than one place lives here. (Tailwind finds these classes because they appear here in full.)

// Small caps heading over a control.
export const FIELD_LABEL = "font-display text-[0.75rem] uppercase tracking-[0.1em] text-muted";

// A text box, number box or dropdown button: square, dark, with an accent line along the bottom and a glow when it has focus.
const FIELD_BASE =
  "flex w-full items-center rounded-[2px] border border-line border-b-[color-mix(in_srgb,var(--accent)_45%,var(--line))] bg-surface-2 text-[0.9rem] text-foreground " +
  "focus:border-accent focus:shadow-[0_0_0_1px_var(--accent),0_0_14px_-2px_color-mix(in_srgb,var(--accent)_50%,transparent)] focus:outline-none " +
  "focus-within:border-accent focus-within:shadow-[0_0_0_1px_var(--accent),0_0_14px_-2px_color-mix(in_srgb,var(--accent)_50%,transparent)] focus-within:outline-none";
export const FIELD = `${FIELD_BASE} h-10 px-3`;
export const FIELD_MULTI = `${FIELD_BASE} h-10 gap-2 px-2 py-1 group-focus-within:h-auto group-focus-within:min-h-10`; // the chip fields: one line, until they have focus (inside a `group`)

// A panel with an accent bracket on two corners.
export const PANEL =
  "relative border border-line bg-surface/92 " +
  "before:pointer-events-none before:absolute before:-top-px before:-left-px before:size-3.5 before:border-t-2 before:border-l-2 before:border-accent before:content-[''] " +
  "after:pointer-events-none after:absolute after:-right-px after:-bottom-px after:size-3.5 after:border-r-2 after:border-b-2 after:border-accent after:content-['']";

// A number box that has no spinner arrows (the slider next to it is the stepper).
export const NO_SPINNER = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
