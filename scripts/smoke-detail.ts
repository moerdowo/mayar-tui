// Verify that detail extraction works for several plausible Mayar response shapes.
import { RESOURCES } from "../src/ui/resources.js";

function dumpRow(label: string, row: { primary: string; secondary: string; meta: string; raw: unknown }) {
  process.stdout.write(`\n[${label}] row → ${row.primary} | ${row.secondary} | ${row.meta}\n`);
  const detail = RESOURCES.find((r) => r.id === label.split(":")[0])!.detail(row);
  for (const f of detail) {
    process.stdout.write(`    ${f.label.padEnd(28)} ${f.value}\n`);
  }
}

const flatTx = {
  id: "txn_flat_1",
  status: "SUCCESS",
  amount: 250000,
  customerName: "Andi Setiawan",
  customerEmail: "andi@example.com",
  customerMobile: "+62812",
  productName: "Premium Course",
  productType: "digital_product",
  paymentChannel: "QRIS",
  paidAt: "2025-01-15T08:23:00.000Z",
  createdAt: "2025-01-15T08:20:00.000Z",
  merchantId: "m_x",
};

const nestedTx = {
  id: "txn_nested_1",
  status: "SUCCESS",
  amount: "480000",
  customer: { name: "Putri Hidayat", email: "putri@example.com", mobile: "+62813" },
  product: { name: "Webinar", type: "webinar" },
  payment: { channel: "BCA_VA", paidAt: "2025-02-10T03:11:00.000Z" },
  createdAt: "2025-02-10T02:50:00.000Z",
};

const snakeTx = {
  transaction_id: "txn_snake_1",
  status: "SUCCESS",
  total: 99000,
  customer_name: "Dewi Lestari",
  customer_email: "dewi@example.com",
  product_name: "Consultation",
  paid_at: "2025-03-01T11:00:00.000Z",
  created_at: "2025-03-01T10:55:00.000Z",
};

const nestedInvoice = {
  id: "inv_1",
  transactionId: "txn_inv_1",
  status: "paid",
  amount: 1500000,
  customer: { name: "Bambang R.", email: "b@example.com" },
  description: "Annual subscription",
  link: "https://mayar.link/inv/abc",
  createdAt: "2025-04-01T00:00:00.000Z",
};

const minimalUnpaid = {
  id: "txn_min",
  status: "pending",
  amount: 75000,
  // Customer info under an unexpected key
  buyer: { name: "Mystery Buyer", email: "mb@example.com" },
};

// Mayar's actual paid-transaction shape: amount lives in `credit`
const creditFlat = {
  id: "txn_credit_flat",
  status: "SUCCESS",
  credit: 250000,
  customerName: "User Credit Flat",
  paymentLinkName: "Course",
  paidAt: "2026-05-02T08:00:00.000Z",
};
const creditNested = {
  id: "txn_credit_nested",
  status: "SUCCESS",
  credit: { amount: 480000, currency: "IDR" },
  customer: { name: "User Credit Nested" },
  paymentLink: { name: "Webinar" },
  paidAt: "2026-05-01T08:00:00.000Z",
};

// Amount under various plausible Mayar key names
const amountAlt1 = {
  id: "txn_alt1",
  status: "SUCCESS",
  total: 99500,
  customerName: "User Alt1",
  paymentLinkName: "Course",
  paidAt: "2026-05-01T00:00:00.000Z",
};
const amountAlt2 = {
  id: "txn_alt2",
  status: "SUCCESS",
  paymentAmount: "150000",
  customerName: "User Alt2",
  paymentLinkName: "Webinar",
  paidAt: "2026-05-02T08:30:00.000Z",
};
const amountNested = {
  id: "txn_alt3",
  status: "SUCCESS",
  payment: { amount: 320000 },
  customerName: "User Alt3",
  paymentLink: { name: "Membership" },
  paidAt: "2026-04-30T18:00:00.000Z",
};

// Mayar-style: product info only available via paymentLinkName
const paymentLinkFlat = {
  id: "txn_pl_flat",
  status: "SUCCESS",
  amount: 320000,
  customerName: "Yuni Pratama",
  customerEmail: "yuni@example.com",
  paymentLinkName: "Annual Mentorship 2025",
  paymentLinkType: "membership",
  createdAt: "2025-04-15T10:00:00.000Z",
  paidAt: "2025-04-15T10:05:00.000Z",
};

// Nested paymentLink object
const paymentLinkNested = {
  id: "txn_pl_nested",
  status: "SUCCESS",
  amount: 175000,
  customer: { name: "Sari Wulan", email: "sari@example.com" },
  paymentLink: { name: "Webinar — UI/UX Bootcamp", type: "webinar", url: "https://mayar.link/x" },
  createdAt: "2025-04-16T08:00:00.000Z",
  paidAt: "2025-04-16T08:02:00.000Z",
};

dumpRow("transactions-paid:flat", {
  id: flatTx.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: flatTx,
});
dumpRow("transactions-paid:nested", {
  id: nestedTx.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: nestedTx,
});
dumpRow("transactions-paid:snake", {
  id: snakeTx.transaction_id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: snakeTx,
});
dumpRow("transactions-unpaid:buyer-only", {
  id: minimalUnpaid.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: minimalUnpaid,
});
dumpRow("invoices:nested", {
  id: nestedInvoice.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: nestedInvoice,
});

dumpRow("transactions-paid:paymentLinkName", {
  id: paymentLinkFlat.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: paymentLinkFlat,
});

dumpRow("transactions-paid:paymentLink-nested", {
  id: paymentLinkNested.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: paymentLinkNested,
});

dumpRow("transactions-paid:credit-flat", {
  id: creditFlat.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: creditFlat,
});
dumpRow("transactions-paid:credit-nested", {
  id: creditNested.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: creditNested,
});

dumpRow("transactions-paid:amount-as-total", {
  id: amountAlt1.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: amountAlt1,
});
dumpRow("transactions-paid:amount-as-paymentAmount-string", {
  id: amountAlt2.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: amountAlt2,
});
dumpRow("transactions-paid:amount-nested", {
  id: amountNested.id,
  primary: "x",
  secondary: "y",
  meta: "z",
  raw: amountNested,
});
