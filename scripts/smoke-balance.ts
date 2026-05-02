// Verify the ASCIIFont balance widget renders and updates.
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
    };
    refs: {
      balanceLabel: { content: unknown };
      balanceBig: { text: string };
      balanceSub: { content: unknown };
    };
    refreshBalance: () => Promise<void>;
  };
  proto.state.client.balance = async () => ({
    data: { balance: 12_345_678, pendingBalance: 250_000, currency: "IDR" },
  });
  proto.state.client.paidTransactions = async () => ({ data: [], pagination: { total: 0 } });
  proto.state.client.unpaidTransactions = async () => ({ data: [] });
  proto.state.client.invoices = async () => ({ data: [] });
  proto.state.client.singlePayments = async () => ({ data: [] });
  proto.state.client.products = async () => ({ data: [] });
  proto.state.client.customers = async () => ({ data: [] });

  await app.start();
  await renderer.idle();
  await new Promise((r) => setTimeout(r, 50));
  await renderer.idle();

  process.stdout.write(`label : ${String(proto.refs.balanceLabel.content)}\n`);
  process.stdout.write(`big   : ${proto.refs.balanceBig.text}\n`);
  process.stdout.write(`sub   : ${String(proto.refs.balanceSub.content)}\n`);

  // Update balance and verify it changes
  proto.state.client.balance = async () => ({
    data: { balance: 9_999, pendingBalance: 0, currency: "IDR" },
  });
  await proto.refreshBalance();
  await renderer.idle();
  process.stdout.write(`\nafter update:\n`);
  process.stdout.write(`big   : ${proto.refs.balanceBig.text}\n`);
  process.stdout.write(`sub   : ${String(proto.refs.balanceSub.content)}\n`);

  // Error case
  proto.state.client.balance = async () => {
    throw new Error("network down");
  };
  await proto.refreshBalance();
  await renderer.idle();
  process.stdout.write(`\non error:\n`);
  process.stdout.write(`label : ${String(proto.refs.balanceLabel.content)}\n`);
  process.stdout.write(`big   : ${proto.refs.balanceBig.text}\n`);

  renderer.destroy();
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    process.stderr.write(`${(e as Error).stack ?? e}\n`);
    process.exit(1);
  });
