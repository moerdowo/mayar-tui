// Sanity check the new readable date formats.
import { formatDate, formatDateShort, formatRelative, formatWhen, formatWhenShort } from "../src/api/format.js";

const now = new Date("2026-05-02T12:00:00.000Z");

const cases = [
  "2026-05-02T11:55:00.000Z", // 5 min ago
  "2026-05-02T08:00:00.000Z", // 4 hours ago
  "2026-05-01T12:00:00.000Z", // yesterday
  "2026-04-29T12:00:00.000Z", // 3 days ago
  "2026-04-15T12:00:00.000Z", // 2 weeks ago — should switch to absolute in short form
  "2025-09-15T12:00:00.000Z", // 7 months ago
  "2024-01-15T12:00:00.000Z", // 2 years ago
];

process.stdout.write(
  `${"input".padEnd(28)} ${"formatDate".padEnd(28)} ${"formatDateShort".padEnd(20)} ${"formatRelative".padEnd(20)} ${"formatWhenShort".padEnd(20)}\n`,
);
process.stdout.write("-".repeat(120) + "\n");
for (const iso of cases) {
  process.stdout.write(
    `${iso.padEnd(28)} ${formatDate(iso).padEnd(28)} ${formatDateShort(iso, now).padEnd(20)} ${formatRelative(iso, now).padEnd(20)} ${formatWhenShort(iso, now).padEnd(20)}\n`,
  );
}
process.stdout.write("\nformatWhen (detail):\n");
for (const iso of cases) {
  process.stdout.write(`  ${formatWhen(iso, now)}\n`);
}
