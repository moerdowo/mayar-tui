import {
  BoxRenderable,
  TextRenderable,
  SelectRenderable,
  InputRenderable,
  ScrollBoxRenderable,
  ASCIIFontRenderable,
  type CliRenderer,
  type KeyEvent,
  SelectRenderableEvents,
  InputRenderableEvents,
} from "@opentui/core";

import { MayarClient, MayarApiError } from "../api/client.js";
import type { BalanceData } from "../api/types.js";
import { formatCurrency } from "../api/format.js";
import { type AppConfig, saveConfig } from "../config/store.js";
import { getTheme, THEMES, THEME_IDS, type Theme } from "../themes/index.js";
import { getSpinner, SPINNERS, SPINNER_IDS, SpinnerTicker } from "../animations/spinner.js";
import { MAYAR_LOGO } from "./ascii.js";
import { RESOURCES, type DetailField, type ResourceDef, type ResourceRow } from "./resources.js";
import { TableList, type TableRow } from "./table.js";

interface AppState {
  config: AppConfig;
  theme: Theme;
  client: MayarClient;
  resourceIdx: number;
  page: number;
  rows: ResourceRow[];
  rowIdx: number;
  total: number | null;
  loading: boolean;
  loadError: string | null;
  balance: BalanceData | null;
  balanceError: string | null;
  showSettings: boolean;
  status: string;
}

interface Refs {
  rootBox: BoxRenderable;
  headerBox: BoxRenderable;
  logoText: TextRenderable;
  clockText: TextRenderable;
  liveDot: TextRenderable;
  balanceLabel: TextRenderable;
  balanceBig: ASCIIFontRenderable;
  balanceSub: TextRenderable;
  bodyBox: BoxRenderable;
  menuBox: BoxRenderable;
  menuSelect: SelectRenderable;
  listBox: BoxRenderable;
  listHeader: TextRenderable;
  table: TableList<unknown>;
  detailBox: BoxRenderable;
  detailScroll: ScrollBoxRenderable;
  statusBar: BoxRenderable;
  statusText: TextRenderable;
  settingsOverlay: BoxRenderable | null;
}

export class MayarApp {
  private renderer: CliRenderer;
  private state: AppState;
  private refs: Refs | null = null;
  private spinner: SpinnerTicker;
  private spinnerOff: (() => void) | null = null;
  private detailFocused = false;
  private listSelected = false;
  private menuSelected = true;
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private blinkTimer: ReturnType<typeof setInterval> | null = null;
  private liveDotOn = true;

  constructor(renderer: CliRenderer, config: AppConfig) {
    this.renderer = renderer;
    const theme = getTheme(config.themeId);
    this.spinner = new SpinnerTicker(getSpinner(config.spinnerId));
    this.state = {
      config,
      theme,
      client: new MayarClient({ apiKey: config.apiKey, env: config.env }),
      resourceIdx: 0,
      page: 1,
      rows: [],
      rowIdx: 0,
      total: null,
      loading: false,
      loadError: null,
      balance: null,
      balanceError: null,
      showSettings: false,
      status: "",
    };
  }

  async start(): Promise<void> {
    this.build();
    this.renderer.setBackgroundColor(this.state.theme.background);
    this.renderer.keyInput.on("keypress", this.handleKey);
    this.startClock();
    this.startBlink();
    void this.refreshBalance();
    void this.loadCurrent();
  }

  private startClock(): void {
    if (this.clockTimer) return;
    this.clockTimer = setInterval(() => {
      if (!this.refs) return;
      this.refs.clockText.content = this.clockNowText();
    }, 1000);
  }

  private stopClock(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private startBlink(): void {
    if (this.blinkTimer) return;
    this.blinkTimer = setInterval(() => {
      if (!this.refs) return;
      this.liveDotOn = !this.liveDotOn;
      this.refs.liveDot.fg = this.liveDotOn ? this.state.theme.positive : this.state.theme.panel;
    }, 600);
  }

  private stopBlink(): void {
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer);
      this.blinkTimer = null;
    }
  }

  private clockNowText(): string {
    const d = new Date();
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    return `${date}  ·  ${time}`;
  }

  private build(): void {
    const t = this.state.theme;
    const ctx = this.renderer;
    const root = this.renderer.root;

    const rootBox = new BoxRenderable(ctx, {
      width: "100%",
      height: "100%",
      backgroundColor: t.background,
      flexDirection: "column",
    });

    const screen = new BoxRenderable(ctx, {
      width: "100%",
      height: "100%",
      flexDirection: "column",
      backgroundColor: t.background,
    });
    rootBox.add(screen);

    // ── header ─────────────────────────────────────────────
    const headerBox = new BoxRenderable(ctx, {
      height: 11,
      flexDirection: "row",
      padding: 1,
      gap: 2,
      backgroundColor: t.panel,
      border: true,
      borderColor: t.border,
      borderStyle: "rounded",
      title: " mayar-tui ",
      titleAlignment: "left",
      bottomTitle: ` ${this.envLabel()} `,
      bottomTitleAlignment: "right",
    });

    // Left side: ASCII MAYAR logo, vertically centred.
    const logoBox = new BoxRenderable(ctx, {
      flexGrow: 1,
      flexDirection: "column",
      justifyContent: "center",
      backgroundColor: t.panel,
    });
    const logoText = new TextRenderable(ctx, {
      content: MAYAR_LOGO.join("\n"),
      fg: t.accent,
    });
    logoBox.add(logoText);

    // Right side: clock + live dot at top, BALANCE label (inverse style),
    // big ASCII number, then small active/pending sub-line.
    const balanceBox = new BoxRenderable(ctx, {
      flexShrink: 0,
      flexDirection: "column",
      alignItems: "flex-end",
      justifyContent: "flex-start",
      paddingX: 1,
      paddingY: 0,
      backgroundColor: t.panel,
    });

    const clockRow = new BoxRenderable(ctx, {
      flexDirection: "row",
      alignItems: "center",
      gap: 1,
      backgroundColor: t.panel,
    });
    const clockText = new TextRenderable(ctx, {
      content: this.clockNowText(),
      fg: t.fgSubtle,
    });
    const liveDot = new TextRenderable(ctx, {
      content: "●",
      fg: t.positive,
    });
    clockRow.add(clockText);
    clockRow.add(liveDot);

    const balanceLabel = new TextRenderable(ctx, {
      content: this.balanceLabelText(),
      // Inverse / negative style: panel-colored text on accent background.
      fg: t.background,
      bg: t.fg,
      marginTop: 1,
    });
    const balanceBig = new ASCIIFontRenderable(ctx, {
      text: this.balanceBigText(),
      font: "tiny",
      color: t.positive,
      backgroundColor: t.panel,
      selectable: false,
    });
    const balanceSub = new TextRenderable(ctx, {
      content: this.balanceSubText(),
      fg: t.fgMuted,
      marginTop: 1,
    });
    balanceBox.add(clockRow);
    balanceBox.add(balanceLabel);
    balanceBox.add(balanceBig);
    balanceBox.add(balanceSub);
    headerBox.add(logoBox);
    headerBox.add(balanceBox);
    screen.add(headerBox);

    // ── body (3 columns) ───────────────────────────────────
    const bodyBox = new BoxRenderable(ctx, {
      flexGrow: 1,
      flexDirection: "row",
      gap: 1,
      backgroundColor: t.background,
    });
    screen.add(bodyBox);

    // menu column
    const menuBox = new BoxRenderable(ctx, {
      width: 28,
      flexDirection: "column",
      border: true,
      borderColor: t.borderFocused,
      focusedBorderColor: t.borderFocused,
      borderStyle: "rounded",
      backgroundColor: t.panel,
      title: " menu ",
      bottomTitle: " ↑↓ enter ",
      bottomTitleAlignment: "right",
    });
    const menuOptions = RESOURCES.map((r) => ({
      name: `${r.hotkey}  ${r.name}`,
      description: r.description,
      value: r.id,
    }));
    const menuSelect = new SelectRenderable(ctx, {
      options: menuOptions,
      width: "100%",
      height: "100%",
      showDescription: true,
      wrapSelection: true,
      backgroundColor: t.panel,
      focusedBackgroundColor: t.panel,
      textColor: t.fg,
      focusedTextColor: t.fg,
      descriptionColor: t.fgSubtle,
      selectedDescriptionColor: t.fgMuted,
      selectedBackgroundColor: t.highlightBg,
      selectedTextColor: t.highlightFg,
      selectedIndex: 0,
    });
    menuBox.add(menuSelect);
    bodyBox.add(menuBox);

    // list column
    const listBox = new BoxRenderable(ctx, {
      flexGrow: 1,
      flexDirection: "column",
      border: true,
      borderColor: t.border,
      focusedBorderColor: t.borderFocused,
      borderStyle: "rounded",
      backgroundColor: t.panel,
      title: " list ",
      bottomTitle: " ←/→ page · r reload ",
      bottomTitleAlignment: "right",
    });
    const listHeaderBox = new BoxRenderable(ctx, {
      paddingX: 1,
      height: 1,
      backgroundColor: t.panel,
    });
    const listHeader = new TextRenderable(ctx, {
      content: this.listHeaderText(),
      fg: t.fgMuted,
    });
    listHeaderBox.add(listHeader);
    const tableHost = new BoxRenderable(ctx, {
      flexGrow: 1,
      backgroundColor: t.panel,
    });
    const table = new TableList<unknown>(ctx, t);
    tableHost.add(table.container);
    listBox.add(listHeaderBox);
    listBox.add(tableHost);
    bodyBox.add(listBox);

    // detail column
    const detailBox = new BoxRenderable(ctx, {
      width: 42,
      flexDirection: "column",
      border: true,
      borderColor: t.border,
      focusedBorderColor: t.borderFocused,
      borderStyle: "rounded",
      backgroundColor: t.panel,
      title: " detail ",
      bottomTitle: " tab to focus ",
      bottomTitleAlignment: "right",
    });
    const detailScroll = new ScrollBoxRenderable(ctx, {
      width: "100%",
      height: "100%",
      backgroundColor: t.panel,
      contentOptions: { padding: 1, gap: 0, backgroundColor: t.panel },
      rootOptions: { backgroundColor: t.panel },
      scrollbarOptions: {
        trackOptions: { backgroundColor: t.scrollbarBg, foregroundColor: t.scrollbarFg },
      },
    });
    detailBox.add(detailScroll);
    bodyBox.add(detailBox);

    // status bar
    const statusBar = new BoxRenderable(ctx, {
      height: 1,
      paddingX: 1,
      backgroundColor: t.panel,
    });
    const statusText = new TextRenderable(ctx, {
      content: this.statusBarText(),
      fg: t.fgMuted,
    });
    statusBar.add(statusText);
    screen.add(statusBar);

    root.add(rootBox);

    this.refs = {
      rootBox,
      headerBox,
      logoText,
      clockText,
      liveDot,
      balanceLabel,
      balanceBig,
      balanceSub,
      bodyBox,
      menuBox,
      menuSelect,
      listBox,
      listHeader,
      table,
      detailBox,
      detailScroll,
      statusBar,
      statusText,
      settingsOverlay: null,
    };

    menuSelect.on(SelectRenderableEvents.SELECTION_CHANGED, (idx: number) => {
      this.state.resourceIdx = idx;
      this.state.page = 1;
      this.state.rowIdx = 0;
      this.applyTableColumns();
      this.updateListHeader();
      this.updateStatus();
      void this.loadCurrent();
    });
    menuSelect.on(SelectRenderableEvents.ITEM_SELECTED, () => {
      this.focusList();
    });
    table.on("selection-changed", (idx) => {
      this.state.rowIdx = idx;
      this.renderDetail();
    });

    this.applyTableColumns();

    menuSelect.focus();
    this.menuSelected = true;
    this.listSelected = false;
    this.detailFocused = false;
    this.refreshFocusVisuals();
  }

  private rebuildLayoutColors(): void {
    if (!this.refs) return;
    const t = this.state.theme;
    this.renderer.setBackgroundColor(t.background);
    const r = this.refs;

    for (const b of [r.headerBox, r.menuBox, r.listBox, r.detailBox, r.statusBar]) {
      b.backgroundColor = t.panel;
    }
    r.rootBox.backgroundColor = t.background;
    r.bodyBox.backgroundColor = t.background;

    r.logoText.fg = t.accent;
    r.clockText.fg = t.fgSubtle;
    r.liveDot.fg = this.liveDotOn ? t.positive : t.panel;
    r.balanceLabel.fg = t.background;
    r.balanceLabel.bg = t.fg;
    r.balanceBig.color = this.state.balanceError ? t.negative : t.positive;
    r.balanceBig.backgroundColor = t.panel;
    r.balanceSub.fg = t.fgMuted;
    r.statusText.fg = t.fgMuted;
    r.listHeader.fg = t.fgMuted;

    r.menuSelect.backgroundColor = t.panel;
    r.menuSelect.focusedBackgroundColor = t.panel;
    r.menuSelect.textColor = t.fg;
    r.menuSelect.focusedTextColor = t.fg;
    r.menuSelect.descriptionColor = t.fgSubtle;
    r.menuSelect.selectedDescriptionColor = t.fgMuted;
    r.menuSelect.selectedBackgroundColor = t.highlightBg;
    r.menuSelect.selectedTextColor = t.highlightFg;

    r.table.setTheme(t);

    r.detailScroll.backgroundColor = t.panel;
    this.refreshFocusVisuals();
  }

  private applyTableColumns(): void {
    if (!this.refs) return;
    this.refs.table.setColumns(this.currentResource().columns);
  }

  private envLabel(): string {
    return this.state.config.env === "sandbox" ? "sandbox" : "production";
  }

  private balanceParts(): { active: number; pending: number; currency: string } {
    const b = this.state.balance ?? {};
    const active = b.totalBalance ?? b.balance ?? b.active ?? 0;
    const pending = b.pendingBalance ?? b.pending ?? 0;
    const currency = b.currency ?? "IDR";
    return { active, pending, currency };
  }

  private balanceLabelText(): string {
    if (this.state.balanceError) return ` BALANCE · ${this.state.balanceError} `;
    return " BALANCE ";
  }

  private balanceBigText(): string {
    if (this.state.balanceError) return "—";
    if (!this.state.balance) return "···";
    const { active, currency } = this.balanceParts();
    // ASCII font is wide — show only the number with thousands separators.
    if (currency === "IDR") return Math.round(active).toLocaleString("id-ID");
    return Math.round(active).toLocaleString("en-US");
  }

  private balanceSubText(): string {
    if (this.state.balanceError) return "tap r to retry";
    if (!this.state.balance) return "loading…";
    const { active, pending, currency } = this.balanceParts();
    const pendingPart = pending
      ? `pending ${formatCurrency(pending, currency)}`
      : "pending Rp 0";
    return `active ${formatCurrency(active, currency)}  ·  ${pendingPart}`;
  }

  private listHeaderText(): string {
    const r = this.currentResource();
    const total = this.state.total !== null ? `· ${this.state.total} total` : "";
    return `${r.name}  · page ${this.state.page} ${total}`;
  }

  private statusBarText(): string {
    const focusName = this.detailFocused ? "detail" : this.listSelected ? "list" : "menu";
    const status = this.state.status ? ` · ${this.state.status}` : "";
    return ` tab focus(${focusName})  · s settings · r reload · ←/→ page · q quit${status}`;
  }

  private updateListHeader(): void {
    if (!this.refs) return;
    this.refs.listHeader.content = this.listHeaderText();
  }

  private updateStatus(): void {
    if (!this.refs) return;
    this.refs.statusText.content = this.statusBarText();
  }

  private updateBalanceText(): void {
    if (!this.refs) return;
    const t = this.state.theme;
    this.refs.balanceLabel.content = this.balanceLabelText();
    // Inverse style: panel-colored text on a solid color band.
    this.refs.balanceLabel.fg = t.background;
    this.refs.balanceLabel.bg = this.state.balanceError ? t.negative : t.fg;
    this.refs.balanceBig.text = this.balanceBigText();
    this.refs.balanceBig.color = this.state.balanceError ? t.negative : t.positive;
    this.refs.balanceBig.backgroundColor = t.panel;
    this.refs.balanceSub.content = this.balanceSubText();
    this.refs.balanceSub.fg = t.fgMuted;
  }

  private currentResource(): ResourceDef {
    return RESOURCES[this.state.resourceIdx] ?? RESOURCES[0]!;
  }

  private setLoadingSpinner(active: boolean): void {
    if (this.spinnerOff) {
      this.spinnerOff();
      this.spinnerOff = null;
    }
    if (active && this.state.config.animationsEnabled) {
      this.spinner.setStyle(getSpinner(this.state.config.spinnerId));
      this.spinner.start();
      this.spinnerOff = this.spinner.on((frame) => {
        if (!this.refs) return;
        this.refs.table.setEmpty(`  ${frame}  loading ${this.currentResource().name.toLowerCase()}…`);
      });
    } else {
      this.spinner.stop();
    }
  }

  private async refreshBalance(): Promise<void> {
    try {
      const env = await this.state.client.balance();
      this.state.balance = (env.data ?? {}) as BalanceData;
      this.state.balanceError = null;
    } catch (err) {
      const msg = err instanceof MayarApiError ? `${err.status || "ERR"}` : "error";
      this.state.balance = null;
      this.state.balanceError = msg;
    }
    this.updateBalanceText();
  }

  private async loadCurrent(): Promise<void> {
    if (!this.refs) return;
    const resource = this.currentResource();
    this.state.loading = true;
    this.state.loadError = null;
    this.state.rows = [];
    this.refs.table.setRows([]);
    this.refs.table.setEmpty("  loading…");
    this.setLoadingSpinner(true);
    this.updateListHeader();
    this.updateStatus();
    this.renderDetail();

    try {
      const { rows, total } = await resource.fetch(this.state.client, {
        page: this.state.page,
        pageSize: this.state.config.pageSize,
      });
      this.state.rows = rows;
      this.state.total = total ?? null;
      this.state.loading = false;
      this.setLoadingSpinner(false);

      if (rows.length === 0) {
        this.refs.table.setRows([]);
        this.refs.table.setEmpty("  no records on this page");
      } else {
        const tableRows: TableRow<unknown>[] = rows.map((r) => ({ id: r.id, raw: r.raw }));
        this.refs.table.setRows(tableRows);
        this.state.rowIdx = 0;
      }
      this.updateListHeader();
      this.renderDetail();
    } catch (err) {
      this.state.loading = false;
      this.setLoadingSpinner(false);
      const msg = err instanceof MayarApiError ? `${err.status} ${err.message}` : (err as Error).message;
      this.state.loadError = msg;
      this.refs.table.setRows([]);
      this.refs.table.setEmpty(`  ✖ ${msg}`, true);
      this.renderDetail();
    }
  }

  private renderDetail(): void {
    if (!this.refs) return;
    const ctx = this.renderer;
    const scroll = this.refs.detailScroll;
    for (const child of [...scroll.getChildren()]) {
      scroll.remove(child.id);
    }

    const t = this.state.theme;

    const addText = (content: string, fg: string) => {
      scroll.add(new TextRenderable(ctx, { content, fg }));
    };

    if (this.state.loading) {
      addText("loading…", t.fgSubtle);
      return;
    }
    if (this.state.loadError) {
      addText("Error", t.negative);
      addText(this.state.loadError, t.fgMuted);
      return;
    }
    const row = this.state.rows[this.state.rowIdx];
    if (!row) {
      addText("no selection", t.fgSubtle);
      return;
    }

    const fields = this.currentResource().detail(row);
    addText(row.primary, t.accent);
    addText("─".repeat(36), t.border);
    for (const f of fields) {
      addText(f.label.toUpperCase(), t.fgSubtle);
      addText(f.value, this.toneColor(f.tone));
      addText("", t.fg);
    }
  }

  private toneColor(tone?: DetailField["tone"]): string {
    const t = this.state.theme;
    switch (tone) {
      case "positive":
        return t.positive;
      case "warning":
        return t.warning;
      case "negative":
        return t.negative;
      case "muted":
        return t.fgMuted;
      case "accent":
        return t.accent;
      default:
        return t.fg;
    }
  }

  private focusMenu(): void {
    if (!this.refs) return;
    this.refs.menuSelect.focus();
    this.menuSelected = true;
    this.listSelected = false;
    this.detailFocused = false;
    this.refs.table.setFocused(false);
    this.refreshFocusVisuals();
  }

  private focusList(): void {
    if (!this.refs || this.state.rows.length === 0) return;
    this.menuSelected = false;
    this.listSelected = true;
    this.detailFocused = false;
    this.refs.table.setFocused(true);
    this.refreshFocusVisuals();
  }

  private focusDetail(): void {
    if (!this.refs) return;
    this.refs.detailScroll.focus();
    this.menuSelected = false;
    this.listSelected = false;
    this.detailFocused = true;
    this.refs.table.setFocused(false);
    this.refreshFocusVisuals();
  }

  private refreshFocusVisuals(): void {
    if (!this.refs) return;
    const t = this.state.theme;
    this.refs.menuBox.borderColor = this.menuSelected ? t.borderFocused : t.border;
    this.refs.listBox.borderColor = this.listSelected ? t.borderFocused : t.border;
    this.refs.detailBox.borderColor = this.detailFocused ? t.borderFocused : t.border;
    this.updateStatus();
  }

  private cycleFocus(reverse = false): void {
    const order: Array<"menu" | "list" | "detail"> = ["menu", "list", "detail"];
    const current = this.detailFocused ? "detail" : this.listSelected ? "list" : "menu";
    const idx = order.indexOf(current);
    const next = order[(idx + (reverse ? -1 : 1) + order.length) % order.length]!;
    if (next === "menu") this.focusMenu();
    else if (next === "list") this.focusList();
    else this.focusDetail();
  }

  private handleKey = (key: KeyEvent): void => {
    if (this.state.showSettings) {
      this.handleSettingsKey(key);
      return;
    }

    if ((key.ctrl && key.name === "c") || key.name === "q") {
      this.shutdown();
      return;
    }

    if (key.name === "tab") {
      this.cycleFocus(key.shift === true);
      return;
    }

    if (key.name === "s") {
      this.openSettings();
      return;
    }

    if (key.name === "r") {
      void this.refreshBalance();
      void this.loadCurrent();
      return;
    }

    if (this.listSelected && this.refs) {
      if (this.refs.table.handleKey(key)) return;
    }

    // Page nav: ←/→ globally; H/L only when not on the table
    if (key.name === "left" || (key.name === "h" && !this.listSelected)) {
      if (this.state.page > 1) {
        this.state.page -= 1;
        void this.loadCurrent();
      }
      return;
    }
    if (key.name === "right" || (key.name === "l" && !this.listSelected)) {
      this.state.page += 1;
      void this.loadCurrent();
      return;
    }

    const ch = key.name;
    if (ch && ch.length === 1 && /[1-9]/.test(ch)) {
      const n = Number(ch) - 1;
      if (n >= 0 && n < RESOURCES.length && this.refs) {
        this.state.resourceIdx = n;
        this.state.page = 1;
        this.refs.menuSelect.setSelectedIndex(n);
      }
    }
  };

  private openSettings(): void {
    if (!this.refs || this.state.showSettings) return;
    this.state.showSettings = true;

    const t = this.state.theme;
    const ctx = this.renderer;

    const themeOpts = THEME_IDS.map((id) => ({
      name: THEMES[id]!.name,
      description: id,
      value: id,
    }));
    const spinnerOpts = SPINNER_IDS.map((id) => ({
      name: SPINNERS[id]!.name,
      description: id,
      value: id,
    }));
    const animOpts = [
      { name: "On", description: "spinners while loading", value: "on" },
      { name: "Off", description: "no spinners or live frames", value: "off" },
    ];
    const envOpts = [
      { name: "Production", description: "api.mayar.id", value: "production" },
      { name: "Sandbox", description: "api.mayar.club", value: "sandbox" },
    ];

    const overlay = new BoxRenderable(ctx, {
      position: "absolute",
      top: "10%",
      left: "15%",
      width: "70%",
      height: "80%",
      backgroundColor: t.panel,
      border: true,
      borderColor: t.borderFocused,
      borderStyle: "double",
      title: " settings ",
      titleAlignment: "center",
      bottomTitle: " enter applies on focused row · esc closes ",
      bottomTitleAlignment: "center",
      flexDirection: "column",
      padding: 1,
      gap: 1,
      zIndex: 100,
    });

    const addLabel = (text: string) => {
      overlay.add(new TextRenderable(ctx, { content: text, fg: t.fgSubtle }));
    };

    const themeSelect = new SelectRenderable(ctx, {
      options: themeOpts,
      width: "100%",
      height: 8,
      selectedIndex: Math.max(0, THEME_IDS.indexOf(this.state.config.themeId)),
      backgroundColor: t.panel,
      focusedBackgroundColor: t.panel,
      textColor: t.fg,
      focusedTextColor: t.fg,
      selectedBackgroundColor: t.highlightBg,
      selectedTextColor: t.highlightFg,
      descriptionColor: t.fgSubtle,
    });
    const spinnerSelect = new SelectRenderable(ctx, {
      options: spinnerOpts,
      width: "100%",
      height: 6,
      selectedIndex: Math.max(0, SPINNER_IDS.indexOf(this.state.config.spinnerId)),
      backgroundColor: t.panel,
      focusedBackgroundColor: t.panel,
      textColor: t.fg,
      focusedTextColor: t.fg,
      selectedBackgroundColor: t.highlightBg,
      selectedTextColor: t.highlightFg,
      descriptionColor: t.fgSubtle,
    });
    const animSelect = new SelectRenderable(ctx, {
      options: animOpts,
      width: "100%",
      height: 4,
      selectedIndex: this.state.config.animationsEnabled ? 0 : 1,
      backgroundColor: t.panel,
      focusedBackgroundColor: t.panel,
      textColor: t.fg,
      focusedTextColor: t.fg,
      selectedBackgroundColor: t.highlightBg,
      selectedTextColor: t.highlightFg,
      descriptionColor: t.fgSubtle,
    });
    const envSelect = new SelectRenderable(ctx, {
      options: envOpts,
      width: "100%",
      height: 4,
      selectedIndex: this.state.config.env === "sandbox" ? 1 : 0,
      backgroundColor: t.panel,
      focusedBackgroundColor: t.panel,
      textColor: t.fg,
      focusedTextColor: t.fg,
      selectedBackgroundColor: t.highlightBg,
      selectedTextColor: t.highlightFg,
      descriptionColor: t.fgSubtle,
    });
    const apiKeyInput = new InputRenderable(ctx, {
      placeholder: "API Key (leave blank to keep current)",
      value: "",
      width: "100%",
      backgroundColor: t.panel,
      textColor: t.fg,
      placeholderColor: t.fgSubtle,
      focusedBackgroundColor: t.background,
      focusedTextColor: t.fg,
    });

    addLabel("THEME");
    overlay.add(themeSelect);
    addLabel("SPINNER");
    overlay.add(spinnerSelect);
    addLabel("ANIMATIONS");
    overlay.add(animSelect);
    addLabel("ENVIRONMENT");
    overlay.add(envSelect);
    addLabel("API KEY");
    overlay.add(apiKeyInput);
    overlay.add(
      new TextRenderable(ctx, {
        content: "tip: theme previews live as you scroll · enter to commit",
        fg: t.fgMuted,
      }),
    );

    this.refs.rootBox.add(overlay);
    this.refs.settingsOverlay = overlay;

    themeSelect.on(SelectRenderableEvents.SELECTION_CHANGED, (idx: number) => {
      const id = THEME_IDS[idx];
      if (id) this.applyThemePreview(id);
    });
    themeSelect.on(SelectRenderableEvents.ITEM_SELECTED, (idx: number) => {
      const id = THEME_IDS[idx];
      if (id) {
        this.state.config.themeId = id;
        this.persist();
        this.flashStatus(`theme → ${THEMES[id]!.name}`);
      }
    });
    spinnerSelect.on(SelectRenderableEvents.ITEM_SELECTED, (idx: number) => {
      const id = SPINNER_IDS[idx];
      if (id) {
        this.state.config.spinnerId = id;
        this.spinner.setStyle(getSpinner(id));
        this.persist();
        this.flashStatus(`spinner → ${SPINNERS[id]!.name}`);
      }
    });
    animSelect.on(SelectRenderableEvents.ITEM_SELECTED, (idx: number) => {
      this.state.config.animationsEnabled = idx === 0;
      this.persist();
      this.flashStatus(`animations ${idx === 0 ? "on" : "off"}`);
    });
    envSelect.on(SelectRenderableEvents.ITEM_SELECTED, (idx: number) => {
      const env: "production" | "sandbox" = idx === 1 ? "sandbox" : "production";
      this.state.config.env = env;
      this.state.client = new MayarClient({ apiKey: this.state.config.apiKey, env });
      this.persist();
      if (this.refs) this.refs.headerBox.bottomTitle = ` ${this.envLabel()} `;
      this.flashStatus(`env → ${env}`);
      void this.refreshBalance();
      void this.loadCurrent();
    });
    apiKeyInput.on(InputRenderableEvents.ENTER, (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) {
        this.flashStatus("api key unchanged");
        return;
      }
      this.state.config.apiKey = trimmed;
      this.state.client = new MayarClient({
        apiKey: trimmed,
        env: this.state.config.env,
      });
      this.persist();
      apiKeyInput.value = "";
      this.flashStatus("api key updated");
      void this.refreshBalance();
      void this.loadCurrent();
    });

    themeSelect.focus();
  }

  private closeSettings(): void {
    if (!this.refs || !this.state.showSettings) return;
    if (this.refs.settingsOverlay) {
      this.refs.rootBox.remove(this.refs.settingsOverlay.id);
      this.refs.settingsOverlay = null;
    }
    this.state.showSettings = false;
    this.applyThemePreview(this.state.config.themeId);
    this.focusMenu();
  }

  private handleSettingsKey(key: KeyEvent): void {
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      this.closeSettings();
    }
  }

  private applyThemePreview(themeId: string): void {
    this.state.theme = getTheme(themeId);
    this.rebuildLayoutColors();
    this.renderDetail();
    this.updateBalanceText();
  }

  private flashStatus(msg: string): void {
    this.state.status = msg;
    this.updateStatus();
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => {
      if (this.state.status === msg) {
        this.state.status = "";
        this.updateStatus();
      }
    }, 2400);
  }

  private persist(): void {
    try {
      saveConfig(this.state.config);
    } catch (err) {
      this.flashStatus(`save failed: ${(err as Error).message}`);
    }
  }

  private shutdown(): void {
    this.spinner.stop();
    this.stopClock();
    this.stopBlink();
    this.renderer.destroy();
    process.exit(0);
  }
}
