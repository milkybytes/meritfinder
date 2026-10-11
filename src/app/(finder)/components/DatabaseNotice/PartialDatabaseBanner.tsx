import { PANEL } from "@/components/ui/styles";
import { formatNumber } from "@/lib/format";

// Below this many systems the database is a sample, not the galaxy (the full dump has about 127,000).
const PARTIAL_DATABASE_SYSTEMS = 50_000;

// A warning that searches may find nothing because only a sample of the galaxy is loaded. Renders nothing for a full one.
export function PartialDatabaseBanner({ systemCount }: { systemCount: number }) {
  if (systemCount >= PARTIAL_DATABASE_SYSTEMS) return null;

  return (
    <p className={`${PANEL} mt-5 px-4 py-3 text-sm text-warn`}>
      Partial database: only {formatNumber(systemCount)} systems are loaded (a sample, not the whole galaxy), so many searches will find
      nothing. Run <code>npm run ingest -- --force</code> to load the full Spansh dump.
    </p>
  );
}
