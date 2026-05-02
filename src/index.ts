import { createCliRenderer } from "@opentui/core";

import { loadConfig } from "./config/store.js";
import { MayarApp } from "./ui/app.js";
import { runSetup } from "./ui/setup.js";

export { MayarApp } from "./ui/app.js";
export { MayarClient, MayarApiError } from "./api/client.js";
export type { Theme } from "./themes/index.js";
export { THEMES, getTheme } from "./themes/index.js";
export { SPINNERS, getSpinner } from "./animations/spinner.js";

export async function main(): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    targetFps: 60,
  });

  let config = loadConfig();

  if (!config.apiKey) {
    config = await runSetup(renderer, config);
  }

  const app = new MayarApp(renderer, config);
  await app.start();
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("mayartui crashed:", err);
    process.exit(1);
  });
}
