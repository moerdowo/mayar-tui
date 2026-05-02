#!/usr/bin/env bun
import { main } from "../dist/index.js";

main().catch((err) => {
  console.error("mayartui crashed:", err);
  process.exit(1);
});
