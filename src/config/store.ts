import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { DEFAULT_PAGE_SIZE } from "../api/client.js";

export interface AppConfig {
  apiKey: string;
  env: "production" | "sandbox";
  themeId: string;
  spinnerId: string;
  animationsEnabled: boolean;
  pageSize: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  apiKey: "",
  env: "production",
  themeId: "matrix",
  spinnerId: "dots",
  animationsEnabled: true,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function getConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "mayartui", "config.json");
}

export function loadConfig(): AppConfig {
  const path = getConfigPath();
  let onDisk: Partial<AppConfig> = {};
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf8");
      onDisk = JSON.parse(raw) as Partial<AppConfig>;
    } catch {
      onDisk = {};
    }
  }
  const envKey = process.env.MAYAR_API_KEY;
  const envEnv = process.env.MAYAR_ENV as AppConfig["env"] | undefined;
  return {
    ...DEFAULT_CONFIG,
    ...onDisk,
    apiKey: envKey ?? onDisk.apiKey ?? DEFAULT_CONFIG.apiKey,
    env: envEnv ?? onDisk.env ?? DEFAULT_CONFIG.env,
  };
}

export function saveConfig(cfg: AppConfig): void {
  const path = getConfigPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}
