// Smoke test: switch themes at runtime, ensure the visit doesn't crash.
import { createCliRenderer } from "@opentui/core";

import { MayarApp } from "../src/ui/app.js";
import { DEFAULT_CONFIG } from "../src/config/store.js";
import { THEME_IDS } from "../src/themes/index.js";

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 30,
    testing: true,
  });

  const app = new MayarApp(renderer, { ...DEFAULT_CONFIG, apiKey: "test-key" });

  const proto = app as unknown as {
    state: { client: { balance: () => Promise<unknown> } };
    applyThemePreview: (id: string) => void;
  };
  proto.state.client.balance = async () => ({
    data: { balance: 100, currency: "IDR" },
  });

  await app.start();
  await renderer.idle();

  for (const id of THEME_IDS) {
    proto.applyThemePreview(id);
    await renderer.idle();
    process.stdout.write(`theme ${id}: ok\n`);
  }

  renderer.destroy();
}

main()
  .then(() => {
    process.stdout.write("done\n");
    process.exit(0);
  })
  .catch((err) => {
    process.stderr.write(`theme smoke failed: ${err?.stack ?? err}\n`);
    process.exit(1);
  });
