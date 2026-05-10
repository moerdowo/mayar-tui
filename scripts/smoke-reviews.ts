// Verify the new Reviews resource: row mapping, ms-timestamp parsing,
// rating-stars, and TUI integration.
import { createCliRenderer } from "@opentui/core";

import { MayarApp } from "../src/ui/app.js";
import { DEFAULT_CONFIG } from "../src/config/store.js";
import { RESOURCES } from "../src/ui/resources.js";
import { formatWhen } from "../src/api/format.js";

// Sample review shape per docs.mayar.id /reviews
const reviews = [
  {
    id: "rev_1",
    customerId: "cu_1",
    userId: "u_1",
    paymentLinkId: "pl_1",
    rating: 5,
    message: "Sangat puas dengan kursusnya, materinya lengkap dan jelas.",
    status: "ACTIVE",
    // Unix milliseconds (Mayar style)
    createdAt: 1747500000000, // ~ 17 May 2025
    updatedAt: 1747500000000,
    multipleImage: [],
    content: [],
    customer: { id: "cu_1", name: "Yuni Pratama" },
    paymentLink: {
      id: "pl_1",
      name: "Annual Mentorship 2025",
      type: "membership",
      link: "https://mayar.link/abc",
      subType: "monthly",
    },
  },
  {
    id: "rev_2",
    rating: 3,
    message: "Webinarnya OK tapi durasinya terlalu pendek.",
    status: "ACTIVE",
    createdAt: 1745000000000,
    updatedAt: 1745000000000,
    customer: { id: "cu_2", name: "Sari Wulan" },
    paymentLink: { id: "pl_2", name: "UI/UX Bootcamp", type: "webinar" },
  },
  {
    id: "rev_3",
    rating: 1,
    message: "Tidak sesuai ekspektasi.",
    status: "ACTIVE",
    createdAt: 1730000000000,
    customer: { id: "cu_3", name: "Bambang R." },
    paymentLink: { id: "pl_3", name: "Ebook Pemasaran", type: "ebook" },
  },
];

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 30,
    testing: true,
  });
  const app = new MayarApp(renderer, { ...DEFAULT_CONFIG, apiKey: "test" });
  const proto = app as unknown as {
    state: {
      client: {
        balance: () => Promise<unknown>;
        paidTransactions: () => Promise<unknown>;
        unpaidTransactions: () => Promise<unknown>;
        invoices: () => Promise<unknown>;
        singlePayments: () => Promise<unknown>;
        products: () => Promise<unknown>;
        customers: () => Promise<unknown>;
        reviews: () => Promise<unknown>;
      };
      resourceIdx: number;
      rows: unknown[];
    };
    refs: { table: { getSelectedIndex(): number } };
    handleKey: (k: { name: string }) => void;
    stopClock: () => void;
    stopBlink: () => void;
  };
  proto.state.client.balance = async () => ({ data: { balance: 0, currency: "IDR" } });
  for (const k of [
    "paidTransactions",
    "unpaidTransactions",
    "invoices",
    "singlePayments",
    "products",
    "customers",
  ] as const) {
    proto.state.client[k] = async () => ({ data: [] });
  }
  proto.state.client.reviews = async () => ({ data: reviews, pagination: { total: 3 } });

  await app.start();
  await renderer.idle();
  await new Promise((r) => setTimeout(r, 50));
  await renderer.idle();

  // Jump to Reviews via hotkey "7"
  proto.handleKey({ name: "7" });
  await renderer.idle();
  await new Promise((r) => setTimeout(r, 50));
  await renderer.idle();

  process.stdout.write(`resourceIdx after 7: ${proto.state.resourceIdx}\n`);
  process.stdout.write(`rows loaded: ${proto.state.rows.length}\n`);

  const reviewsResource = RESOURCES.find((r) => r.id === "reviews")!;

  process.stdout.write("\n── row mapping ──\n");
  for (const rev of reviews) {
    const row = (await reviewsResource.fetch(
      {
        // synth client returning just this one review
        reviews: async () => ({ data: [rev], pagination: { total: 1 } }),
      } as never,
      {},
    )).rows[0]!;
    process.stdout.write(
      `  ${row.secondary}  ${row.primary.padEnd(18)} | ${row.meta}\n`,
    );
  }

  process.stdout.write("\n── detail of first review ──\n");
  const detail = reviewsResource.detail({
    id: reviews[0]!.id!,
    primary: "x",
    secondary: "y",
    meta: "z",
    raw: reviews[0],
  });
  for (const f of detail) {
    if (f.label.startsWith("─")) break;
    process.stdout.write(`  ${f.label.padEnd(14)} ${f.value}\n`);
  }

  process.stdout.write(
    `\nformatWhen(1747500000000) = ${formatWhen(1747500000000, new Date("2026-05-02T12:00:00Z"))}\n`,
  );
  process.stdout.write(
    `formatWhen("1747500000000") = ${formatWhen("1747500000000", new Date("2026-05-02T12:00:00Z"))}\n`,
  );

  proto.stopClock();
  proto.stopBlink();
  renderer.destroy();
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    process.stderr.write(`${(e as Error).stack ?? e}\n`);
    process.exit(1);
  });
