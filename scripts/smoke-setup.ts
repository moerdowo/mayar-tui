// Smoke test for the setup screen rendering path.
import { createCliRenderer } from "@opentui/core";

import { runSetup } from "../src/ui/setup.js";
import { DEFAULT_CONFIG } from "../src/config/store.js";

async function main() {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 30,
    testing: true,
  });

  // We don't actually want to wait for input — race against an idle settle.
  // The setup never resolves without enter, so just verify it mounts.
  void runSetup(renderer, { ...DEFAULT_CONFIG });

  await renderer.idle();
  process.stdout.write("setup mounted OK\n");

  renderer.destroy();
}

main().then(() => process.exit(0)).catch((err) => {
  console.error("setup smoke failed:", err);
  process.exit(1);
});
