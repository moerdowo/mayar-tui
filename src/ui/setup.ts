import {
  BoxRenderable,
  TextRenderable,
  InputRenderable,
  SelectRenderable,
  type CliRenderer,
  type KeyEvent,
  InputRenderableEvents,
  SelectRenderableEvents,
} from "@opentui/core";

import { type AppConfig, saveConfig } from "../config/store.js";
import { getTheme } from "../themes/index.js";
import { MAYAR_LOGO } from "./ascii.js";

export async function runSetup(
  renderer: CliRenderer,
  current: AppConfig,
): Promise<AppConfig> {
  return new Promise<AppConfig>((resolve, reject) => {
    const t = getTheme(current.themeId);
    const ctx = renderer;
    renderer.setBackgroundColor(t.background);

    const apiKeyInput = new InputRenderable(ctx, {
      placeholder: "paste your Mayar API key…",
      width: 60,
      backgroundColor: t.background,
      focusedBackgroundColor: t.panel,
      textColor: t.fg,
      focusedTextColor: t.fg,
      placeholderColor: t.fgSubtle,
    });

    const envSelect = new SelectRenderable(ctx, {
      width: 60,
      height: 4,
      options: [
        { name: "Production", description: "https://api.mayar.id/hl/v1", value: "production" },
        { name: "Sandbox", description: "https://api.mayar.club/hl/v1", value: "sandbox" },
      ],
      selectedIndex: current.env === "sandbox" ? 1 : 0,
      backgroundColor: t.panel,
      focusedBackgroundColor: t.panel,
      textColor: t.fg,
      focusedTextColor: t.fg,
      selectedBackgroundColor: t.highlightBg,
      selectedTextColor: t.highlightFg,
      descriptionColor: t.fgSubtle,
    });

    const status = new TextRenderable(ctx, {
      content: "enter to confirm api key · tab to switch fields · ctrl+c to quit",
      fg: t.fgMuted,
    });

    const card = new BoxRenderable(ctx, {
      position: "absolute",
      top: "10%",
      left: "10%",
      width: "80%",
      height: "80%",
      backgroundColor: t.panel,
      border: true,
      borderColor: t.borderFocused,
      borderStyle: "rounded",
      title: " welcome to mayar-tui ",
      titleAlignment: "center",
      bottomTitle: " setup ",
      bottomTitleAlignment: "right",
      flexDirection: "column",
      gap: 1,
      padding: 2,
    });

    card.add(new TextRenderable(ctx, { content: MAYAR_LOGO.join("\n"), fg: t.accent }));
    card.add(
      new TextRenderable(ctx, {
        content:
          "Generate an API key at https://web.mayar.id/api-keys, then paste it below.",
        fg: t.fg,
      }),
    );
    card.add(new TextRenderable(ctx, { content: "API KEY", fg: t.fgSubtle }));
    card.add(apiKeyInput);
    card.add(new TextRenderable(ctx, { content: "ENVIRONMENT", fg: t.fgSubtle }));
    card.add(envSelect);
    card.add(status);

    renderer.root.add(card);

    let env: AppConfig["env"] = current.env;
    envSelect.on(SelectRenderableEvents.SELECTION_CHANGED, (idx: number) => {
      env = idx === 1 ? "sandbox" : "production";
    });

    let activeIdx = 0;
    const focusables: Array<{ focus(): void }> = [apiKeyInput, envSelect];
    focusables[0]!.focus();

    const cycleFocus = (forward: boolean) => {
      activeIdx = (activeIdx + (forward ? 1 : -1) + focusables.length) % focusables.length;
      focusables[activeIdx]!.focus();
    };

    const onKey = (key: KeyEvent) => {
      if (key.ctrl && key.name === "c") {
        renderer.destroy();
        process.exit(0);
      }
      if (key.name === "tab") {
        cycleFocus(key.shift !== true);
      }
    };
    renderer.keyInput.on("keypress", onKey);

    apiKeyInput.on(InputRenderableEvents.ENTER, (val: string) => {
      const key = val.trim();
      if (!key) {
        status.content = "✖ api key cannot be empty";
        status.fg = t.negative;
        return;
      }
      const next: AppConfig = { ...current, apiKey: key, env };
      try {
        saveConfig(next);
      } catch (err) {
        status.content = `✖ save failed: ${(err as Error).message}`;
        status.fg = t.negative;
        return;
      }
      renderer.keyInput.off("keypress", onKey);
      renderer.root.remove(card.id);
      resolve(next);
    });

    // Surface unexpected destruction so the caller doesn't hang.
    renderer.once("destroy", () => {
      reject(new Error("renderer destroyed during setup"));
    });
  });
}
