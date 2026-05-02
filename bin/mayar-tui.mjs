#!/usr/bin/env bun
import { main } from "../dist/index.js";

main().catch((err) => {
  console.error("mayar-tui crashed:", err);
  process.exit(1);
});
