import { createCliRenderer } from "@opentui/core";

import { MayarApp } from "../src/ui/app.js";
import { DEFAULT_CONFIG } from "../src/config/store.js";
import { RESOURCES } from "../src/ui/resources.js";

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 30,
    testing: true,
  });
  const app = new MayarApp(renderer, { ...DEFAULT_CONFIG, apiKey: "test-key" });
  const proto = app as unknown as {
    state: { client: { balance: () => Promise<unknown> } };
    openSettings: () => void;
    closeSettings: () => void;
    handleKey: (k: { name: string; ctrl?: boolean; shift?: boolean }) => void;
  };
  proto.state.client.balance = async () => ({ data: { balance: 0, currency: "IDR" } });

  await app.start();
  await renderer.idle();

  proto.openSettings();
  await renderer.idle();
  process.stdout.write("settings opened\n");

  proto.closeSettings();
  await renderer.idle();
  process.stdout.write("settings closed\n");

  // Cycle through resources via menu hotkey
  for (let i = 0; i < RESOURCES.length; i++) {
    proto.handleKey({ name: String(i + 1) });
    await renderer.idle();
    process.stdout.write(`resource ${i + 1} ok\n`);
  }

  renderer.destroy();
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    process.stderr.write(`${(e as Error).stack ?? e}\n`);
    process.exit(1);
  });
