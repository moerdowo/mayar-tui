// Smoke test: build the renderer, mount the app, render one frame, then exit.
// Uses the testing renderer mode so it doesn't need a real TTY.
import { createCliRenderer } from "@opentui/core";

import { MayarApp } from "../src/ui/app.js";
import { DEFAULT_CONFIG } from "../src/config/store.js";

async function main() {
  process.stdout.write("Booting renderer…\n");
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 30,
    testing: true,
  });

  const config = { ...DEFAULT_CONFIG, apiKey: "test-key" };
  const app = new MayarApp(renderer, config);

  // Override the network call with a stub by reaching into the app's client.
  const proto = (app as unknown as { state: { client: { balance: () => Promise<unknown> } } });
  proto.state.client.balance = async () => ({
    data: { balance: 1234567, pendingBalance: 0, currency: "IDR" },
  });

  await app.start();

  // Settle a frame.
  await renderer.idle();
  process.stdout.write("Mounted, idle. OK\n");

  renderer.destroy();
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("smoke failed:", err);
  process.exit(1);
});
