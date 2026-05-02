// Verify the live clock under the logo updates each second.
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
    refs: { clockText: { content: { toString(): string } } };
    clockNowText: () => string;
    stopClock: () => void;
  };
  proto.state.client.balance = async () => ({ data: { balance: 0 } });
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

  await app.start();
  await renderer.idle();

  const t1 = proto.clockNowText();
  process.stdout.write(`tick 1: ${t1}\n`);
  await new Promise((r) => setTimeout(r, 1100));
  const t2 = proto.clockNowText();
  process.stdout.write(`tick 2: ${t2}\n`);

  if (t1 === t2) {
    process.stderr.write("FAIL: clock did not advance\n");
    proto.stopClock();
    process.exit(1);
  }
  process.stdout.write("OK · clock ticked\n");
  proto.stopClock();
  renderer.destroy();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    process.stderr.write(`${(e as Error).stack ?? e}\n`);
    process.exit(1);
  });
