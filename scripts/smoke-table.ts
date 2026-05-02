// Verify the center-column TableList renders, navigates, and re-themes.
import { createCliRenderer } from "@opentui/core";

import { MayarApp } from "../src/ui/app.js";
import { DEFAULT_CONFIG } from "../src/config/store.js";
import { THEME_IDS } from "../src/themes/index.js";

interface Tx {
  id: string;
  customerName: string;
  customerEmail: string;
  productName: string;
  amount: number;
  status: string;
  paidAt: string;
  createdAt: string;
}

function fakeTx(i: number): Tx {
  return {
    id: `txn_${i}`,
    customerName: ["Andi", "Putri", "Bambang", "Dewi", "Rama"][i % 5] + ` ${i}`,
    customerEmail: `user${i}@example.com`,
    productName: ["Course", "Webinar", "Ebook", "Membership"][i % 4]!,
    amount: (i + 1) * 100_000,
    status: i % 3 === 0 ? "SUCCESS" : "PENDING",
    paidAt: i % 3 === 0 ? "2025-04-01T03:00:00.000Z" : "",
    createdAt: "2025-04-01T02:00:00.000Z",
  };
}

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
      };
      rows: unknown[];
      rowIdx: number;
      resourceIdx: number;
    };
    refs: { table: { handleKey: (k: { name: string }) => boolean; getSelectedIndex(): number } };
    handleKey: (k: { name: string; ctrl?: boolean; shift?: boolean }) => void;
    focusList: () => void;
    applyThemePreview: (id: string) => void;
  };

  proto.state.client.balance = async () => ({ data: { balance: 5_000_000, currency: "IDR" } });
  const fakeList = { data: Array.from({ length: 12 }, (_, i) => fakeTx(i)), pagination: { total: 12 } };
  proto.state.client.paidTransactions = async () => fakeList;
  proto.state.client.unpaidTransactions = async () => fakeList;
  proto.state.client.invoices = async () => fakeList;
  proto.state.client.singlePayments = async () => fakeList;
  proto.state.client.products = async () => fakeList;
  proto.state.client.customers = async () => fakeList;

  await app.start();
  await renderer.idle();

  // wait for fetch to complete
  await new Promise((r) => setTimeout(r, 50));
  await renderer.idle();

  process.stdout.write(`rows loaded: ${proto.state.rows.length}\n`);

  proto.focusList();
  await renderer.idle();
  process.stdout.write(`focused list, sel=${proto.refs.table.getSelectedIndex()}\n`);

  for (let i = 0; i < 5; i++) {
    proto.handleKey({ name: "down" });
    await renderer.idle();
  }
  process.stdout.write(`after 5 down: sel=${proto.refs.table.getSelectedIndex()}, rowIdx=${proto.state.rowIdx}\n`);

  proto.handleKey({ name: "end" });
  await renderer.idle();
  process.stdout.write(`after end: sel=${proto.refs.table.getSelectedIndex()}\n`);

  proto.handleKey({ name: "home" });
  await renderer.idle();
  process.stdout.write(`after home: sel=${proto.refs.table.getSelectedIndex()}\n`);

  for (let i = 0; i < 6; i++) {
    proto.handleKey({ name: String(i + 1) });
    await renderer.idle();
    await new Promise((r) => setTimeout(r, 20));
    await renderer.idle();
    process.stdout.write(`switched resource ${i + 1}, rows=${proto.state.rows.length}\n`);
  }

  for (const id of THEME_IDS) {
    proto.applyThemePreview(id);
    await renderer.idle();
    process.stdout.write(`theme ${id}: ok\n`);
  }

  renderer.destroy();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    process.stderr.write(`${(e as Error).stack ?? e}\n`);
    process.exit(1);
  });
