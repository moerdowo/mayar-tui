export function formatCurrency(value?: number | string | null, currency = "IDR"): string {
  if (value === null || value === undefined || value === "") return "-";
  const num = typeof value === "string" ? Number(value) : value;
  if (typeof num !== "number" || Number.isNaN(num)) return String(value);
  if (currency === "IDR") {
    return "Rp " + Math.round(num).toLocaleString("id-ID");
  }
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(num);
  } catch {
    return num.toLocaleString();
  }
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

const pad = (n: number) => String(n).padStart(2, "0");

/** Compact human date, e.g. "12 May 14:30" (current year) or "12 May 2025 14:30". */
export function formatDateShort(input?: string | null, now: Date = new Date()): string {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const day = d.getDate();
  const month = MONTHS_SHORT[d.getMonth()]!;
  const year = d.getFullYear();
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (year === now.getFullYear()) return `${day} ${month} ${time}`;
  return `${day} ${month} ${year} ${time}`;
}

/** Long human date, e.g. "12 May 2026, 14:30". */
export function formatDate(input?: string | null): string {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const day = d.getDate();
  const month = MONTHS_SHORT[d.getMonth()]!;
  const year = d.getFullYear();
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${day} ${month} ${year}, ${time}`;
}

/** Long, locale-aware relative time: "5 minutes ago", "yesterday", "in 3 days". */
export function formatRelative(input?: string | null, now: Date = new Date()): string {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const diffMs = d.getTime() - now.getTime();
  const abs = Math.abs(diffMs);

  if (abs < 5 * SECOND) return "just now";

  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  } catch {
    return formatDate(input);
  }

  if (abs < MINUTE) return rtf.format(Math.round(diffMs / SECOND), "second");
  if (abs < HOUR) return rtf.format(Math.round(diffMs / MINUTE), "minute");
  if (abs < DAY) return rtf.format(Math.round(diffMs / HOUR), "hour");
  if (abs < WEEK) return rtf.format(Math.round(diffMs / DAY), "day");
  if (abs < MONTH) return rtf.format(Math.round(diffMs / WEEK), "week");
  if (abs < YEAR) return rtf.format(Math.round(diffMs / MONTH), "month");
  return rtf.format(Math.round(diffMs / YEAR), "year");
}

/**
 * Best of both worlds for table cells:
 *  - Recent (< 7 days): show relative ("5m ago", "2h ago", "yesterday")
 *  - Older: show absolute ("12 May 14:30")
 */
export function formatWhenShort(input?: string | null, now: Date = new Date()): string {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const abs = Math.abs(now.getTime() - d.getTime());
  if (abs < WEEK) return formatRelative(input, now);
  return formatDateShort(input, now);
}

/** Long form for the detail panel: "12 May 2026, 14:30 · 5 minutes ago". */
export function formatWhen(input?: string | null, now: Date = new Date()): string {
  if (!input) return "-";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  const absStr = formatDate(input);
  const rel = formatRelative(input, now);
  if (rel === absStr || rel === input) return absStr;
  return `${absStr}  ·  ${rel}`;
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  if (max <= 1) return value.slice(0, max);
  return value.slice(0, Math.max(0, max - 1)) + "…";
}

/** Walk a dotted path (`customer.name`) safely. */
export function getDeep(obj: unknown, path: string): unknown {
  if (obj == null || typeof obj !== "object") return undefined;
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Return the first candidate path that resolves to a non-empty value. */
export function pick(obj: unknown, ...candidates: string[]): unknown {
  for (const c of candidates) {
    const v = getDeep(obj, c);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

export function pickString(obj: unknown, ...candidates: string[]): string | undefined {
  for (const c of candidates) {
    const v = getDeep(obj, c);
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    // Skip objects/arrays — fall through to the next candidate so we don't
    // render placeholder strings like "[object Object]".
  }
  return undefined;
}

export function pickNumber(obj: unknown, ...candidates: string[]): number | undefined {
  for (const c of candidates) {
    const v = getDeep(obj, c);
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "number" && typeof v !== "string") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export interface FlatField {
  path: string;
  value: string;
}

/**
 * Walk a value and emit every leaf primitive as a flat path -> string entry.
 * Skips empty strings, null, undefined, empty objects, and very deep structures.
 */
export function flattenForDisplay(
  value: unknown,
  opts: { maxDepth?: number; skipKeys?: ReadonlySet<string> } = {},
): FlatField[] {
  const out: FlatField[] = [];
  const maxDepth = opts.maxDepth ?? 3;
  const skipKeys = opts.skipKeys ?? new Set<string>();

  const walk = (val: unknown, path: string, depth: number) => {
    if (val === null || val === undefined || val === "") return;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      out.push({ path, value: String(val) });
      return;
    }
    if (depth >= maxDepth) {
      out.push({ path, value: "[…]" });
      return;
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return;
      // For short primitive arrays, join. Otherwise, expand.
      if (val.every((v) => typeof v !== "object" || v === null)) {
        out.push({ path, value: val.map((v) => String(v ?? "")).join(", ") });
        return;
      }
      val.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    if (typeof val === "object") {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (skipKeys.has(k)) continue;
        const next = path ? `${path}.${k}` : k;
        walk(v, next, depth + 1);
      }
    }
  };

  walk(value, "", 0);
  return out;
}
