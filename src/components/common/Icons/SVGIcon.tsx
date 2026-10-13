import type { CSSProperties, ReactNode, SVGProps } from "react";

import styles from "./SVGIcon.module.css";

// The one <svg> every icon renders through. It owns default size, colour, variants and accessibility; an icon is just
// `<SVGIcon viewBox="…">…shapes…</SVGIcon>`.
export interface SVGIconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  children?: ReactNode;
  /** Width and height: a number is px, a string is any CSS length ("1.25em"). Default 1em, so it scales with text. */
  size?: number | string;
  /** "accent": the theme's accent colour. Default: the text colour. */
  variant?: "accent";
}

// Decorative by default (hidden from screen readers). Give it an aria-label and it becomes an image with that name.
export default function SVGIcon({ children, size, variant, className, style, ...props }: SVGIconProps) {
  const labelled = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined;
  const dimension = size === undefined ? undefined : typeof size === "number" ? `${size}px` : size;
  const merged: CSSProperties = { ...(dimension && { width: dimension, height: dimension }), ...style };

  return (
    <svg
      focusable="false"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? "img" : undefined}
      {...props}
      className={[styles.SVGIcon, className].filter(Boolean).join(" ")}
      data-variant={variant}
      style={Object.keys(merged).length ? merged : undefined}
    >
      {children}
    </svg>
  );
}
