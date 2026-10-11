import type { ButtonHTMLAttributes } from "react";

// The main action: accent-coloured, square, small caps.
export function Button({ className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`h-10 rounded-[3px] bg-accent px-7 font-display text-[0.85rem] font-bold uppercase tracking-[0.14em] text-[#0b0908] hover:brightness-112 ${className}`.trim()}
      {...rest}
    />
  );
}
