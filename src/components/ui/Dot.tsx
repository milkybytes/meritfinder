// A diamond marker in a colour: beside a power's name, in a menu, and for the live-updates light. `pulse` makes it breathe.
export function Dot({ color, pulse = false, className = "" }: { color: string; pulse?: boolean; className?: string }) {
  return (
    <span
      data-dot
      className={`inline-block size-[0.62rem] flex-none [clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)] ${pulse ? "animate-breathe motion-reduce:animate-none" : ""} ${className}`.trim()}
      style={{ background: color }}
    />
  );
}
