// Quick check that the relative time formatters produce sensible output.
import { formatRelative, formatRelativeShort, formatWhen } from "../src/api/format.js";

const now = new Date("2026-05-02T12:00:00.000Z");

const cases: Array<[string, string]> = [
  ["2026-05-02T11:59:58.000Z", "just now"],
  ["2026-05-02T11:55:00.000Z", "5 minutes ago"],
  ["2026-05-02T09:00:00.000Z", "3 hours ago"],
  ["2026-05-01T12:00:00.000Z", "yesterday"],
  ["2026-04-29T12:00:00.000Z", "3 days ago"],
  ["2026-04-15T12:00:00.000Z", "2 weeks ago"],
  ["2026-02-02T12:00:00.000Z", "3 months ago"],
  ["2024-05-02T12:00:00.000Z", "2 years ago"],
  ["2026-05-02T12:30:00.000Z", "in 30 minutes"],
];

let failures = 0;
for (const [iso, expected] of cases) {
  const actual = formatRelative(iso, now);
  const short = formatRelativeShort(iso, now);
  const when = formatWhen(iso, now);
  const ok = actual === expected || actual.includes(expected.split(" ")[1]!);
  if (!ok) failures++;
  process.stdout.write(
    `${ok ? "✓" : "✗"} ${iso}\n    long  : ${actual}\n    short : ${short}\n    when  : ${when}\n`,
  );
}

process.stdout.write(`\nempty: "${formatRelative(null, now)}" / "${formatRelativeShort("", now)}"\n`);
process.stdout.write(`bad:   "${formatRelative("not-a-date", now)}"\n`);

if (failures > 0) process.exit(1);
