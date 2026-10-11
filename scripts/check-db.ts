// Checks the database the app would use: schema, data and index use. Read-only; exits 1 on a problem.
//   npm run db:check [-- --full]    --full adds SQLite's integrity check (minutes)
import Database from "better-sqlite3";

import { checkDatabase } from "@/lib/db/check";
import { getDbPath } from "@/lib/db/db";

const file = getDbPath();
const started = Date.now();
const db = new Database(file, { readonly: true, fileMustExist: true });
const result = checkDatabase(db, { full: process.argv.includes("--full") });
db.close();

console.log(`Checked ${file} in ${((Date.now() - started) / 1000).toFixed(1)} s`);
console.log("Rows:", Object.entries(result.counts).map(([t, n]) => `${t} ${n.toLocaleString("en-US")}`).join(", "));
for (const w of result.warnings) console.log(`warning: ${w}`);
if (result.ok) console.log("OK: no problems found.");
else {
  console.log(`${result.problems.length} problem(s):`);
  for (const p of result.problems) console.log(` - ${p}`);
  process.exitCode = 1;
}
