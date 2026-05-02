// Regression: when focus is on the table, arrow keys must NOT advance the menu.
import { createCliRenderer } from "@opentui/core";

import { MayarApp } from "../src/ui/app.js";
import { DEFAULT_CONFIG } from "../src/config/store.js";

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
      resourceIdx: number;
      rowIdx: number;
    };
    refs: {
      menuSelect: { getSelectedIndex(): number };
      table: { getSelectedIndex(): number };
    };
    handleKey: (k: { name: string; ctrl?: boolean; shift?: boolean }) => void;
  };

  const fakeRows = {
    data: Array.from({ length: 8 }, (_, i) => ({
      id: `id_${i}`,
      customerName: `Customer ${i}`,
      amount: (i + 1) * 1000,
      status: "SUCCESS",
      paidAt: "2025-04-01T00:00:00.000Z",
      createdAt: "2025-04-01T00:00:00.000Z",
    })),
    pagination: { total: 8 },
  };
  proto.state.client.balance = async () => ({ data: { balance: 0, currency: "IDR" } });
  proto.state.client.paidTransactions = async () => fakeRows;
  proto.state.client.unpaidTransactions = async () => fakeRows;
  proto.state.client.invoices = async () => fakeRows;
  proto.state.client.singlePayments = async () => fakeRows;
  proto.state.client.products = async () => fakeRows;
  proto.state.client.customers = async () => fakeRows;

  await app.start();
  await renderer.idle();
  await new Promise((r) => setTimeout(r, 50));
  await renderer.idle();

  const menuBefore = proto.refs.menuSelect.getSelectedIndex();
  const resourceBefore = proto.state.resourceIdx;
  process.stdout.write(`initial: menu=${menuBefore} resource=${resourceBefore}\n`);

  // Tab to focus the table (menu -> list)
  proto.handleKey({ name: "tab" });
  await renderer.idle();

  // Now press down 3 times — should move table selection only.
  proto.handleKey({ name: "down" });
  proto.handleKey({ name: "down" });
  proto.handleKey({ name: "down" });
  await renderer.idle();
  await new Promise((r) => setTimeout(r, 30));
  await renderer.idle();

  const menuAfter = proto.refs.menuSelect.getSelectedIndex();
  const resourceAfter = proto.state.resourceIdx;
  const tableSel = proto.refs.table.getSelectedIndex();
  process.stdout.write(
    `after 3 down on table: menu=${menuAfter} resource=${resourceAfter} table=${tableSel}\n`,
  );

  if (menuAfter !== menuBefore) {
    process.stderr.write(`FAIL: menu selection changed from ${menuBefore} to ${menuAfter}\n`);
    process.exit(1);
  }
  if (resourceAfter !== resourceBefore) {
    process.stderr.write(
      `FAIL: resourceIdx changed from ${resourceBefore} to ${resourceAfter}\n`,
    );
    process.exit(1);
  }
  if (tableSel !== 3) {
    process.stderr.write(`FAIL: table selection should be 3, got ${tableSel}\n`);
    process.exit(1);
  }
  process.stdout.write("OK · table arrows no longer leak to menu\n");

  // Verify opentui's focus actually moved to the table container.
  const focused = (renderer as unknown as { currentFocusedRenderable: { id: string } | null })
    .currentFocusedRenderable;
  process.stdout.write(`opentui focus id: ${focused?.id ?? "none"}\n`);
  if (!focused) {
    process.stderr.write("FAIL: nothing is opentui-focused after focusList\n");
    process.exit(1);
  }
  // tab back to menu and verify opentui focus moves to menuSelect
  proto.handleKey({ name: "tab" }); // -> detail
  proto.handleKey({ name: "tab" }); // -> menu
  await renderer.idle();
  const focused2 = (renderer as unknown as { currentFocusedRenderable: { id: string } | null })
    .currentFocusedRenderable;
  process.stdout.write(`after tab,tab opentui focus id: ${focused2?.id ?? "none"}\n`);
  if (focused2?.id !== (proto.refs as unknown as { menuSelect: { id: string } }).menuSelect.id) {
    process.stderr.write("FAIL: opentui focus did not return to menuSelect\n");
    process.exit(1);
  }
  process.stdout.write("OK · opentui focus follows tab cycle\n");

  renderer.destroy();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    process.stderr.write(`${(e as Error).stack ?? e}\n`);
    process.exit(1);
  });
