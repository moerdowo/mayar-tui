import type { MayarClient, PageQuery } from "../api/client.js";
import type {
  CustomerData,
  InvoiceData,
  PaymentData,
  ProductData,
  ReviewData,
  TransactionData,
} from "../api/types.js";
import {
  flattenForDisplay,
  formatCurrency,
  formatWhen,
  formatWhenShort,
  pickNumber,
  pickString,
  truncate,
} from "../api/format.js";

export interface ResourceRow {
  id: string;
  primary: string;
  secondary: string;
  meta: string;
  raw: unknown;
}

export interface ResourceDef {
  id: string;
  name: string;
  description: string;
  hotkey: string;
  fetch: (client: MayarClient, q: PageQuery) => Promise<{ rows: ResourceRow[]; total?: number }>;
  detail: (row: ResourceRow) => DetailField[];
  columns: ResourceColumn[];
}

export interface DetailField {
  label: string;
  value: string;
  tone?: "default" | "muted" | "positive" | "warning" | "negative" | "accent";
}

export type CellTone = NonNullable<DetailField["tone"]>;

export interface ResourceColumn {
  key: string;
  label: string;
  /** Fixed width (chars) or `"flex"` to fill remaining space. */
  width: number | "flex";
  align?: "left" | "right";
  get: (raw: unknown) => string;
  tone?: (raw: unknown) => CellTone | undefined;
}

function asArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["data", "items", "rows", "results"]) {
      const v = obj[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}

const COMMON_SKIP = new Set<string>([
  // these are usually internal / repetitive and add visual noise.
  "merchantId",
  "merchantName",
  "userId",
]);

function rawFields(raw: unknown, alreadyShown: ReadonlySet<string>): DetailField[] {
  const flat = flattenForDisplay(raw, { maxDepth: 3, skipKeys: COMMON_SKIP });
  const fields: DetailField[] = [];
  const shownLower = new Set([...alreadyShown].map((s) => s.toLowerCase()));
  for (const { path, value } of flat) {
    // skip ones whose leaf key matches a label we already showed
    const leaf = path.split(".").pop()!.split("[")[0]!.toLowerCase();
    if (shownLower.has(leaf)) continue;
    fields.push({ label: path, value: truncate(value, 220), tone: "muted" });
  }
  return fields;
}

function buildDetail(curated: DetailField[], raw: unknown): DetailField[] {
  const labels = new Set(curated.map((f) => f.label.toLowerCase()));
  const extras = rawFields(raw, labels);
  if (extras.length === 0) return curated;
  return [
    ...curated,
    { label: "─── all fields ───", value: "", tone: "muted" },
    ...extras,
  ];
}

// ── Transactions ──────────────────────────────────────────────────────────

const TX_NAME_KEYS = [
  "customerName",
  "customer_name",
  "customer.name",
  "name",
  "customerInformation.name",
  "buyer.name",
];
const TX_EMAIL_KEYS = [
  "customerEmail",
  "customer_email",
  "customer.email",
  "email",
  "customerInformation.email",
  "buyer.email",
];
const TX_MOBILE_KEYS = [
  "customerMobile",
  "customer_mobile",
  "customer.mobile",
  "mobile",
  "customerInformation.mobile",
  "buyer.mobile",
];
// Mayar transactions usually reference the originating payment link rather
// than carrying a top-level "productName" field — try the payment-link name
// first, then fall back to other plausible product-name shapes.
const TX_PRODUCT_NAME_KEYS = [
  "paymentLinkName",
  "payment_link_name",
  "paymentLink.name",
  "payment_link.name",
  "paymentLink.title",
  "payment_link.title",
  "paymentLink",
  "payment_link",
  "link.name",
  "link.title",
  "productName",
  "product_name",
  "product.name",
  "product.title",
  "productTitle",
];
const TX_PRODUCT_TYPE_KEYS = [
  "paymentLinkType",
  "payment_link_type",
  "paymentLink.type",
  "payment_link.type",
  "productType",
  "product_type",
  "product.type",
  "type",
];
// Mayar's transaction payload reports the merchant-facing amount under
// "credit" (in some shapes a `credit` number, in others a nested object).
// Try those first, then fall back to the broader set of plausible keys.
const TX_AMOUNT_KEYS = [
  "credit",
  "creditAmount",
  "credit_amount",
  "credit.amount",
  "credit.value",
  "credit.nominal",
  "amount",
  "total",
  "totalAmount",
  "grossAmount",
  "gross_amount",
  "nominal",
  "value",
  "price",
  "transactionAmount",
  "transaction_amount",
  "paymentAmount",
  "payment_amount",
  "subTotal",
  "sub_total",
  "subtotal",
  "transaction.amount",
  "payment.amount",
  "paymentLink.amount",
  "payment_link.amount",
];
const TX_PAID_AT_KEYS = ["paidAt", "paid_at", "paymentDate", "payment.paidAt"];
const TX_CREATED_KEYS = ["createdAt", "created_at", "createdDate"];
const TX_STATUS_KEYS = ["status", "transactionStatus"];
const TX_CHANNEL_KEYS = ["paymentChannel", "payment_channel", "channel", "payment.channel"];
const TX_ID_KEYS = ["id", "transactionId", "transaction_id", "_id"];

function txRow(t: TransactionData, i: number): ResourceRow {
  const name =
    pickString(t, ...TX_NAME_KEYS) ??
    pickString(t, ...TX_EMAIL_KEYS) ??
    pickString(t, ...TX_PRODUCT_NAME_KEYS) ??
    "(no name)";
  const amount = pickNumber(t, ...TX_AMOUNT_KEYS);
  const when =
    pickString(t, ...TX_PAID_AT_KEYS) ?? pickString(t, ...TX_CREATED_KEYS) ?? null;
  const id = pickString(t, ...TX_ID_KEYS) ?? String(i);
  return {
    id,
    primary: name,
    secondary: formatCurrency(amount),
    meta: formatWhenShort(when),
    raw: t,
  };
}

function txDetail(row: ResourceRow): DetailField[] {
  const t = row.raw;
  const status = pickString(t, ...TX_STATUS_KEYS);
  const amount = pickNumber(t, ...TX_AMOUNT_KEYS);
  const curated: DetailField[] = [
    { label: "ID", value: pickString(t, ...TX_ID_KEYS) ?? "-", tone: "muted" },
    {
      label: "Status",
      value: status ?? "-",
      tone: status && /success|paid|completed/i.test(status) ? "positive" : "warning",
    },
    { label: "Amount", value: formatCurrency(amount), tone: "accent" },
    { label: "Customer", value: pickString(t, ...TX_NAME_KEYS) ?? "-" },
    { label: "Email", value: pickString(t, ...TX_EMAIL_KEYS) ?? "-" },
    { label: "Mobile", value: pickString(t, ...TX_MOBILE_KEYS) ?? "-" },
    { label: "Product", value: pickString(t, ...TX_PRODUCT_NAME_KEYS) ?? "-" },
    { label: "Type", value: pickString(t, ...TX_PRODUCT_TYPE_KEYS) ?? "-", tone: "muted" },
    { label: "Channel", value: pickString(t, ...TX_CHANNEL_KEYS) ?? "-", tone: "muted" },
    {
      label: "Paid At",
      value: formatWhen(pickString(t, ...TX_PAID_AT_KEYS) ?? null),
      tone: pickString(t, ...TX_PAID_AT_KEYS) ? "positive" : "muted",
    },
    {
      label: "Created",
      value: formatWhen(pickString(t, ...TX_CREATED_KEYS) ?? null),
      tone: "muted",
    },
  ];
  return buildDetail(curated, t);
}

// ── Invoices ──────────────────────────────────────────────────────────────

const INV_DESC_KEYS = ["description", "memo", "note"];
const INV_LINK_KEYS = ["link", "url", "invoiceUrl", "redirectUrl"];

function invoiceRow(inv: InvoiceData, i: number): ResourceRow {
  const name =
    pickString(inv, ...TX_NAME_KEYS) ??
    pickString(inv, ...TX_EMAIL_KEYS) ??
    "(no name)";
  const amount = pickNumber(inv, ...TX_AMOUNT_KEYS);
  const status = pickString(inv, ...TX_STATUS_KEYS) ?? "-";
  const id = pickString(inv, ...TX_ID_KEYS) ?? String(i);
  return {
    id,
    primary: name,
    secondary: formatCurrency(amount),
    meta: status,
    raw: inv,
  };
}

function invoiceDetail(row: ResourceRow): DetailField[] {
  const inv = row.raw;
  const status = pickString(inv, ...TX_STATUS_KEYS);
  const amount = pickNumber(inv, ...TX_AMOUNT_KEYS);
  const curated: DetailField[] = [
    { label: "ID", value: pickString(inv, ...TX_ID_KEYS) ?? "-", tone: "muted" },
    {
      label: "Tx ID",
      value: pickString(inv, "transactionId", "transaction_id") ?? "-",
      tone: "muted",
    },
    {
      label: "Status",
      value: status ?? "-",
      tone: status && /paid|success|completed/i.test(status) ? "positive" : "warning",
    },
    { label: "Amount", value: formatCurrency(amount), tone: "accent" },
    { label: "Customer", value: pickString(inv, ...TX_NAME_KEYS) ?? "-" },
    { label: "Email", value: pickString(inv, ...TX_EMAIL_KEYS) ?? "-" },
    { label: "Mobile", value: pickString(inv, ...TX_MOBILE_KEYS) ?? "-" },
    {
      label: "Description",
      value: truncate(pickString(inv, ...INV_DESC_KEYS) ?? "-", 200),
    },
    { label: "Link", value: pickString(inv, ...INV_LINK_KEYS) ?? "-", tone: "muted" },
    {
      label: "Created",
      value: formatWhen(pickString(inv, ...TX_CREATED_KEYS) ?? null),
      tone: "muted",
    },
  ];
  return buildDetail(curated, inv);
}

// ── Single payments ───────────────────────────────────────────────────────

function paymentRow(p: PaymentData, i: number): ResourceRow {
  const name = pickString(p, "name", "title", ...TX_PRODUCT_NAME_KEYS) ?? "(no name)";
  const amount = pickNumber(p, ...TX_AMOUNT_KEYS);
  const status = pickString(p, ...TX_STATUS_KEYS) ?? "-";
  const id = pickString(p, ...TX_ID_KEYS) ?? String(i);
  return {
    id,
    primary: name,
    secondary: formatCurrency(amount),
    meta: status,
    raw: p,
  };
}

function paymentDetail(row: ResourceRow): DetailField[] {
  const p = row.raw;
  const status = pickString(p, ...TX_STATUS_KEYS);
  const amount = pickNumber(p, ...TX_AMOUNT_KEYS);
  const curated: DetailField[] = [
    { label: "ID", value: pickString(p, ...TX_ID_KEYS) ?? "-", tone: "muted" },
    { label: "Name", value: pickString(p, "name", "title") ?? "-" },
    {
      label: "Status",
      value: status ?? "-",
      tone: status && /active|paid|success/i.test(status) ? "positive" : "warning",
    },
    { label: "Amount", value: formatCurrency(amount), tone: "accent" },
    {
      label: "Description",
      value: truncate(pickString(p, ...INV_DESC_KEYS) ?? "-", 200),
    },
    { label: "Link", value: pickString(p, ...INV_LINK_KEYS) ?? "-", tone: "muted" },
    {
      label: "Created",
      value: formatWhen(pickString(p, ...TX_CREATED_KEYS) ?? null),
      tone: "muted",
    },
  ];
  return buildDetail(curated, p);
}

// ── Products ──────────────────────────────────────────────────────────────

function productRow(p: ProductData, i: number): ResourceRow {
  const name = pickString(p, "name", "title", ...TX_PRODUCT_NAME_KEYS) ?? "(no name)";
  const amount = pickNumber(p, ...TX_AMOUNT_KEYS, "price");
  const type = pickString(p, ...TX_PRODUCT_TYPE_KEYS, "category") ?? "-";
  const id = pickString(p, ...TX_ID_KEYS) ?? String(i);
  return {
    id,
    primary: name,
    secondary: formatCurrency(amount),
    meta: type,
    raw: p,
  };
}

function productDetail(row: ResourceRow): DetailField[] {
  const p = row.raw;
  const status = pickString(p, ...TX_STATUS_KEYS);
  const amount = pickNumber(p, ...TX_AMOUNT_KEYS, "price");
  const curated: DetailField[] = [
    { label: "ID", value: pickString(p, ...TX_ID_KEYS) ?? "-", tone: "muted" },
    { label: "Name", value: pickString(p, "name", "title") ?? "-" },
    {
      label: "Type",
      value: pickString(p, ...TX_PRODUCT_TYPE_KEYS, "category") ?? "-",
      tone: "accent",
    },
    {
      label: "Status",
      value: status ?? "-",
      tone: status && /active/i.test(status) ? "positive" : "warning",
    },
    { label: "Amount", value: formatCurrency(amount), tone: "accent" },
    {
      label: "Description",
      value: truncate(pickString(p, ...INV_DESC_KEYS) ?? "-", 200),
    },
    { label: "Link", value: pickString(p, ...INV_LINK_KEYS) ?? "-", tone: "muted" },
    {
      label: "Created",
      value: formatWhen(pickString(p, ...TX_CREATED_KEYS) ?? null),
      tone: "muted",
    },
  ];
  return buildDetail(curated, p);
}

// ── Customers ─────────────────────────────────────────────────────────────

function customerRow(cu: CustomerData, i: number): ResourceRow {
  const name =
    pickString(cu, "name", "fullName", "customerName") ??
    pickString(cu, "email", "customerEmail") ??
    "(no name)";
  const email = pickString(cu, "email", "customerEmail") ?? "-";
  const mobile = pickString(cu, "mobile", "phone", "customerMobile") ?? "-";
  const id = pickString(cu, ...TX_ID_KEYS) ?? String(i);
  return {
    id,
    primary: name,
    secondary: email,
    meta: mobile,
    raw: cu,
  };
}

function customerDetail(row: ResourceRow): DetailField[] {
  const cu = row.raw;
  const curated: DetailField[] = [
    { label: "ID", value: pickString(cu, ...TX_ID_KEYS) ?? "-", tone: "muted" },
    { label: "Name", value: pickString(cu, "name", "fullName") ?? "-" },
    {
      label: "Email",
      value: pickString(cu, "email", "customerEmail") ?? "-",
      tone: "accent",
    },
    { label: "Mobile", value: pickString(cu, "mobile", "phone") ?? "-" },
    {
      label: "Created",
      value: formatWhen(pickString(cu, ...TX_CREATED_KEYS) ?? null),
      tone: "muted",
    },
    {
      label: "Updated",
      value: formatWhen(pickString(cu, "updatedAt", "updated_at") ?? null),
      tone: "muted",
    },
  ];
  return buildDetail(curated, cu);
}

// ── Reviews ───────────────────────────────────────────────────────────────

const REVIEW_NAME_KEYS = ["customer.name", "customerName", "name"];
const REVIEW_PRODUCT_KEYS = [
  "paymentLink.name",
  "payment_link.name",
  "paymentLinkName",
  "payment_link_name",
  "paymentLink.title",
];
const REVIEW_PRODUCT_TYPE_KEYS = [
  "paymentLink.type",
  "payment_link.type",
  "paymentLinkType",
];
const REVIEW_PRODUCT_LINK_KEYS = ["paymentLink.link", "payment_link.link"];
const REVIEW_MSG_KEYS = ["message", "comment", "review", "text"];

/** Render a numeric rating 0..5 as a star bar like "★★★★☆". */
function ratingStars(rating: number | undefined): string {
  if (rating === undefined || Number.isNaN(rating)) return "—";
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

function reviewRow(rev: ReviewData, i: number): ResourceRow {
  const customer =
    pickString(rev, ...REVIEW_NAME_KEYS) ?? "(unknown reviewer)";
  const rating = pickNumber(rev, "rating");
  const message = pickString(rev, ...REVIEW_MSG_KEYS) ?? "";
  const id = pickString(rev, ...TX_ID_KEYS) ?? String(i);
  return {
    id,
    primary: customer,
    secondary: ratingStars(rating),
    meta: truncate(message.replace(/\s+/g, " ").trim(), 60) || "(no message)",
    raw: rev,
  };
}

function reviewDetail(row: ResourceRow): DetailField[] {
  const r = row.raw;
  const rating = pickNumber(r, "rating");
  const status = pickString(r, "status");
  const message = pickString(r, ...REVIEW_MSG_KEYS) ?? "";
  const curated: DetailField[] = [
    { label: "ID", value: pickString(r, ...TX_ID_KEYS) ?? "-", tone: "muted" },
    {
      label: "Rating",
      value:
        rating === undefined
          ? "—"
          : `${ratingStars(rating)}   ${rating} / 5`,
      tone: "accent",
    },
    {
      label: "Status",
      value: status ?? "-",
      tone: status && /active|approved|published/i.test(status) ? "positive" : "muted",
    },
    { label: "Customer", value: pickString(r, ...REVIEW_NAME_KEYS) ?? "-" },
    {
      label: "Customer ID",
      value: pickString(r, "customer.id", "customerId") ?? "-",
      tone: "muted",
    },
    { label: "Product", value: pickString(r, ...REVIEW_PRODUCT_KEYS) ?? "-" },
    {
      label: "Product Type",
      value: pickString(r, ...REVIEW_PRODUCT_TYPE_KEYS) ?? "-",
      tone: "muted",
    },
    {
      label: "Product Link",
      value: pickString(r, ...REVIEW_PRODUCT_LINK_KEYS) ?? "-",
      tone: "muted",
    },
    { label: "Message", value: truncate(message, 800) || "(no message)" },
    {
      label: "Created",
      value: formatWhen(pickString(r, "createdAt", "created_at") ?? null),
      tone: "muted",
    },
    {
      label: "Updated",
      value: formatWhen(pickString(r, "updatedAt", "updated_at") ?? null),
      tone: "muted",
    },
  ];
  return buildDetail(curated, r);
}

// ── Column definitions ────────────────────────────────────────────────────

function statusTone(value: string | undefined, positive: RegExp): CellTone | undefined {
  if (!value) return "muted";
  if (positive.test(value)) return "positive";
  if (/fail|error|cancel|expired|reject/i.test(value)) return "negative";
  return "warning";
}

const TX_COLUMNS: ResourceColumn[] = [
  {
    key: "customer",
    label: "Customer",
    width: "flex",
    get: (r) =>
      pickString(r, ...TX_NAME_KEYS) ??
      pickString(r, ...TX_EMAIL_KEYS) ??
      "(no name)",
  },
  {
    key: "product",
    label: "Product",
    width: 18,
    get: (r) => pickString(r, ...TX_PRODUCT_NAME_KEYS) ?? "-",
    tone: () => "muted",
  },
  {
    key: "amount",
    label: "Amount",
    width: 14,
    align: "right",
    get: (r) => formatCurrency(pickNumber(r, ...TX_AMOUNT_KEYS)),
    tone: () => "accent",
  },
  {
    key: "status",
    label: "Status",
    width: 10,
    get: (r) => pickString(r, ...TX_STATUS_KEYS) ?? "-",
    tone: (r) => statusTone(pickString(r, ...TX_STATUS_KEYS), /success|paid|completed/i),
  },
  {
    key: "date",
    label: "When",
    width: 12,
    get: (r) =>
      formatWhenShort(
        pickString(r, ...TX_PAID_AT_KEYS) ?? pickString(r, ...TX_CREATED_KEYS) ?? null,
      ),
    tone: () => "muted",
  },
];

const INVOICE_COLUMNS: ResourceColumn[] = [
  {
    key: "customer",
    label: "Customer",
    width: "flex",
    get: (r) =>
      pickString(r, ...TX_NAME_KEYS) ??
      pickString(r, ...TX_EMAIL_KEYS) ??
      "(no name)",
  },
  {
    key: "amount",
    label: "Amount",
    width: 14,
    align: "right",
    get: (r) => formatCurrency(pickNumber(r, ...TX_AMOUNT_KEYS)),
    tone: () => "accent",
  },
  {
    key: "status",
    label: "Status",
    width: 12,
    get: (r) => pickString(r, ...TX_STATUS_KEYS) ?? "-",
    tone: (r) => statusTone(pickString(r, ...TX_STATUS_KEYS), /paid|success|completed/i),
  },
  {
    key: "date",
    label: "Created",
    width: 12,
    get: (r) => formatWhenShort(pickString(r, ...TX_CREATED_KEYS) ?? null),
    tone: () => "muted",
  },
];

const PAYMENT_COLUMNS: ResourceColumn[] = [
  {
    key: "name",
    label: "Name",
    width: "flex",
    get: (r) => pickString(r, "name", "title") ?? "(no name)",
  },
  {
    key: "amount",
    label: "Amount",
    width: 14,
    align: "right",
    get: (r) => formatCurrency(pickNumber(r, ...TX_AMOUNT_KEYS)),
    tone: () => "accent",
  },
  {
    key: "status",
    label: "Status",
    width: 12,
    get: (r) => pickString(r, ...TX_STATUS_KEYS) ?? "-",
    tone: (r) => statusTone(pickString(r, ...TX_STATUS_KEYS), /active|paid|success/i),
  },
  {
    key: "date",
    label: "Created",
    width: 12,
    get: (r) => formatWhenShort(pickString(r, ...TX_CREATED_KEYS) ?? null),
    tone: () => "muted",
  },
];

const PRODUCT_COLUMNS: ResourceColumn[] = [
  {
    key: "name",
    label: "Name",
    width: "flex",
    get: (r) => pickString(r, "name", "title") ?? "(no name)",
  },
  {
    key: "type",
    label: "Type",
    width: 14,
    get: (r) => pickString(r, ...TX_PRODUCT_TYPE_KEYS, "category") ?? "-",
    tone: () => "muted",
  },
  {
    key: "amount",
    label: "Price",
    width: 14,
    align: "right",
    get: (r) => formatCurrency(pickNumber(r, ...TX_AMOUNT_KEYS, "price")),
    tone: () => "accent",
  },
  {
    key: "status",
    label: "Status",
    width: 10,
    get: (r) => pickString(r, ...TX_STATUS_KEYS) ?? "-",
    tone: (r) => statusTone(pickString(r, ...TX_STATUS_KEYS), /active/i),
  },
];

const CUSTOMER_COLUMNS: ResourceColumn[] = [
  {
    key: "name",
    label: "Name",
    width: "flex",
    get: (r) =>
      pickString(r, "name", "fullName", "customerName") ??
      pickString(r, "email", "customerEmail") ??
      "(no name)",
  },
  {
    key: "email",
    label: "Email",
    width: 28,
    get: (r) => pickString(r, "email", "customerEmail") ?? "-",
    tone: () => "muted",
  },
  {
    key: "mobile",
    label: "Mobile",
    width: 16,
    get: (r) => pickString(r, "mobile", "phone", "customerMobile") ?? "-",
    tone: () => "muted",
  },
];

const REVIEW_COLUMNS: ResourceColumn[] = [
  {
    key: "rating",
    label: "Rating",
    width: 8,
    get: (r) => ratingStars(pickNumber(r, "rating")),
    tone: (r) => {
      const n = pickNumber(r, "rating") ?? 0;
      if (n >= 4) return "positive";
      if (n >= 3) return "warning";
      if (n > 0) return "negative";
      return "muted";
    },
  },
  {
    key: "customer",
    label: "Customer",
    width: 18,
    get: (r) => pickString(r, ...REVIEW_NAME_KEYS) ?? "-",
  },
  {
    key: "message",
    label: "Message",
    width: "flex",
    get: (r) => {
      const m = pickString(r, ...REVIEW_MSG_KEYS) ?? "";
      return m.replace(/\s+/g, " ").trim() || "(no message)";
    },
  },
  {
    key: "date",
    label: "When",
    width: 12,
    get: (r) => formatWhenShort(pickString(r, "createdAt", "created_at") ?? null),
    tone: () => "muted",
  },
];

// ── Registry ──────────────────────────────────────────────────────────────

export const RESOURCES: ResourceDef[] = [
  {
    id: "transactions-paid",
    name: "Transactions · Paid",
    description: "Successful transactions",
    hotkey: "1",
    fetch: async (c, q) => {
      const res = await c.paidTransactions(q);
      const items = asArray<TransactionData>(res.data);
      return { rows: items.map(txRow), total: res.pagination?.total };
    },
    detail: txDetail,
    columns: TX_COLUMNS,
  },
  {
    id: "transactions-unpaid",
    name: "Transactions · Unpaid",
    description: "Pending transactions",
    hotkey: "2",
    fetch: async (c, q) => {
      const res = await c.unpaidTransactions(q);
      const items = asArray<TransactionData>(res.data);
      return { rows: items.map(txRow), total: res.pagination?.total };
    },
    detail: txDetail,
    columns: TX_COLUMNS,
  },
  {
    id: "invoices",
    name: "Invoices",
    description: "Issued invoices",
    hotkey: "3",
    fetch: async (c, q) => {
      const res = await c.invoices(q);
      const items = asArray<InvoiceData>(res.data);
      return { rows: items.map(invoiceRow), total: res.pagination?.total };
    },
    detail: invoiceDetail,
    columns: INVOICE_COLUMNS,
  },
  {
    id: "payments",
    name: "Single Payments",
    description: "Payment requests",
    hotkey: "4",
    fetch: async (c, q) => {
      const res = await c.singlePayments(q);
      const items = asArray<PaymentData>(res.data);
      return { rows: items.map(paymentRow), total: res.pagination?.total };
    },
    detail: paymentDetail,
    columns: PAYMENT_COLUMNS,
  },
  {
    id: "products",
    name: "Products",
    description: "Product catalog",
    hotkey: "5",
    fetch: async (c, q) => {
      const res = await c.products(q);
      const items = asArray<ProductData>(res.data);
      return { rows: items.map(productRow), total: res.pagination?.total };
    },
    detail: productDetail,
    columns: PRODUCT_COLUMNS,
  },
  {
    id: "customers",
    name: "Customers",
    description: "Customer directory",
    hotkey: "6",
    fetch: async (c, q) => {
      const res = await c.customers(q);
      const items = asArray<CustomerData>(res.data);
      return { rows: items.map(customerRow), total: res.pagination?.total };
    },
    detail: customerDetail,
    columns: CUSTOMER_COLUMNS,
  },
  {
    id: "reviews",
    name: "Reviews",
    description: "Customer reviews & ratings",
    hotkey: "7",
    fetch: async (c, q) => {
      const res = await c.reviews(q);
      const items = asArray<ReviewData>(res.data);
      return { rows: items.map(reviewRow), total: res.pagination?.total };
    },
    detail: reviewDetail,
    columns: REVIEW_COLUMNS,
  },
];
