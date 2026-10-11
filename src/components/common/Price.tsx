import { formatNumber } from "@/lib/format";

// A credit amount with the credits symbol in front of it.
export function Price({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`font-mono tabular-nums inline-flex items-center gap-1.5 whitespace-nowrap ${className}`}>
      {formatNumber(amount)}
      <span className="text-xs">CR</span>
    </span>
  );
}
