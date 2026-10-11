import { FIELD, FIELD_LABEL, NO_SPINNER } from "./styles";

// A labelled number box, the label above it (and wrapping it, so clicking the label focuses the box). A value of 0 (or none) is
// shown blank, since for these filters 0 means "no limit".
export function NumberField({
  label,
  name,
  defaultValue,
  min = 0,
  max,
}: {
  label: string;
  name: string;
  defaultValue?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      <input name={name} type="number" min={min} max={max} defaultValue={defaultValue || ""} className={`${FIELD} font-mono tabular-nums ${NO_SPINNER}`} />
    </label>
  );
}
