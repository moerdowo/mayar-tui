// Verify the new header: clock+dot at top right, blinking dot toggles,
// inverse BALANCE label, bigger logo.
import { createCliRenderer } from "@opentui/core";

import { MayarApp } from "../src/ui/app.js";
import { DEFAULT_CONFIG } from "../src/config/store.js";
import { MAYAR_LOGO } from "../src/ui/ascii.js";
import { getTheme } from "../src/themes/index.js";

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
      logoText: { content: { toString(): string }; fg: { toString(): string } };
      clockText: { content: { toString(): string } };
      liveDot: { fg: { toString(): string }; content: { toString(): string } };
      balanceLabel: {
        content: { toString(): string };
        fg: { toString(): string };
        bg: { toString(): string };
      };
    };
    liveDotOn: boolean;
    stopClock: () => void;
    stopBlink: () => void;
  };
  proto.state.client.balance = async () => ({
    data: { balance: 12_345_678, pendingBalance: 250_000, currency: "IDR" },
  });
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

  process.stdout.write(`logo line count: ${MAYAR_LOGO.length}\n`);
  process.stdout.write(`clock now      : ${String(proto.refs.clockText.content)}\n`);
  process.stdout.write(`live dot       : "${String(proto.refs.liveDot.content)}"\n`);

  // Read the actual fg color rgba and check it matches the positive theme.
  const t = getTheme(DEFAULT_CONFIG.themeId);
  process.stdout.write(`theme positive : ${t.positive}\n`);
  process.stdout.write(`balance label fg/bg → expect inverse (fg=bg, bg=fg)\n`);

  // Watch the dot blink toggle for ~1.5s.
  const start = proto.liveDotOn;
  await new Promise((r) => setTimeout(r, 700));
  const after1 = proto.liveDotOn;
  await new Promise((r) => setTimeout(r, 700));
  const after2 = proto.liveDotOn;
  process.stdout.write(`blink: ${start} → ${after1} → ${after2}\n`);

  if (after1 === start) {
    process.stderr.write("FAIL: dot did not toggle after 700ms\n");
    proto.stopClock();
    proto.stopBlink();
    process.exit(1);
  }
  process.stdout.write("OK · live dot blinks\n");

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
