import {
  BoxRenderable,
  ScrollBoxRenderable,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core";

import type { Theme } from "../themes/index.js";
import type { DetailField } from "./resources.js";

export type CellTone = NonNullable<DetailField["tone"]>;

export interface TableColumn<T> {
  key: string;
  label: string;
  /** Fixed width in cells, or `"flex"` to fill remaining space. */
  width: number | "flex";
  align?: "left" | "right";
  get: (raw: T) => string;
  tone?: (raw: T) => CellTone | undefined;
}

export interface TableRow<T> {
  id: string;
  raw: T;
}

type TableEvent = "selection-changed" | "item-activated";

interface RowVisual {
  box: BoxRenderable;
  cellTexts: TextRenderable[];
}

function toneToColor(theme: Theme, tone: CellTone | undefined, fallback: string): string {
  switch (tone) {
    case "positive":
      return theme.positive;
    case "warning":
      return theme.warning;
    case "negative":
      return theme.negative;
    case "muted":
      return theme.fgMuted;
    case "accent":
      return theme.accent;
    case "default":
    case undefined:
      return fallback;
  }
}

/**
 * Interactive single-line table backed by a ScrollBox of row boxes.
 * Selection is managed externally via key dispatch (see `handleKey`).
 */
export class TableList<T = unknown> {
  readonly container: BoxRenderable;
  private headerBox: BoxRenderable;
  private body: ScrollBoxRenderable;
  private emptyText: TextRenderable;

  private ctx: CliRenderer;
  private theme: Theme;
  private columns: TableColumn<T>[] = [];
  private rows: TableRow<T>[] = [];
  private rowVisuals: RowVisual[] = [];
  private selectedIdx = 0;
  private listeners = new Map<TableEvent, Set<(idx: number, row: TableRow<T> | null) => void>>();
  private hasFocus = false;

  constructor(ctx: CliRenderer, theme: Theme) {
    this.ctx = ctx;
    this.theme = theme;

    this.container = new BoxRenderable(ctx, {
      width: "100%",
      height: "100%",
      flexDirection: "column",
      backgroundColor: theme.panel,
      focusable: true,
    });

    this.headerBox = new BoxRenderable(ctx, {
      width: "100%",
      height: 1,
      flexDirection: "row",
      paddingLeft: 1,
      paddingRight: 1,
      backgroundColor: theme.panel,
    });

    const divider = new BoxRenderable(ctx, {
      width: "100%",
      height: 1,
      backgroundColor: theme.panel,
    });
    divider.add(
      new TextRenderable(ctx, {
        content: "",
        fg: theme.border,
      }),
    );

    this.body = new ScrollBoxRenderable(ctx, {
      width: "100%",
      flexGrow: 1,
      backgroundColor: theme.panel,
      contentOptions: {
        flexDirection: "column",
        backgroundColor: theme.panel,
        gap: 0,
      },
      rootOptions: { backgroundColor: theme.panel },
      scrollbarOptions: {
        trackOptions: {
          backgroundColor: theme.scrollbarBg,
          foregroundColor: theme.scrollbarFg,
        },
      },
    });

    this.emptyText = new TextRenderable(ctx, {
      content: "  loading…",
      fg: theme.fgSubtle,
    });

    this.container.add(this.headerBox);
    this.container.add(divider);
    this.container.add(this.body);
    this.container.add(this.emptyText);

    this.refreshDivider(divider);
    this._divider = divider;
  }

  private _divider!: BoxRenderable;

  private refreshDivider(divider: BoxRenderable) {
    for (const c of [...divider.getChildren()]) divider.remove(c.id);
    divider.add(
      new TextRenderable(this.ctx, {
        content: "─".repeat(200),
        fg: this.theme.border,
        truncate: true,
      }),
    );
  }

  setColumns(columns: TableColumn<T>[]): void {
    this.columns = columns;
    this.renderHeader();
    this.renderBody();
  }

  setRows(rows: TableRow<T>[]): void {
    this.rows = rows;
    this.selectedIdx = rows.length === 0 ? 0 : Math.min(this.selectedIdx, rows.length - 1);
    if (rows.length > 0) this.selectedIdx = 0;
    this.renderBody();
    this.emit("selection-changed");
  }

  setEmpty(message: string, isError = false): void {
    this.emptyText.content = message;
    this.emptyText.fg = isError ? this.theme.negative : this.theme.fgSubtle;
    this.emptyText.visible = true;
    this.body.visible = false;
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.container.backgroundColor = theme.panel;
    this.headerBox.backgroundColor = theme.panel;
    this.body.backgroundColor = theme.panel;
    this.emptyText.fg = theme.fgSubtle;
    this.refreshDivider(this._divider);
    this.renderHeader();
    this.renderBody();
  }

  setFocused(focused: boolean): void {
    this.hasFocus = focused;
    if (focused) this.container.focus();
    else this.container.blur();
    // refresh selection visual to reflect focus state
    this.applySelectionVisual();
  }

  getSelectedIndex(): number {
    return this.selectedIdx;
  }

  getSelected(): TableRow<T> | null {
    return this.rows[this.selectedIdx] ?? null;
  }

  setSelectedIndex(idx: number): void {
    if (this.rows.length === 0) return;
    const clamped = Math.max(0, Math.min(this.rows.length - 1, idx));
    if (clamped === this.selectedIdx) return;
    const prev = this.selectedIdx;
    this.selectedIdx = clamped;
    this.applySelectionVisual(prev);
    this.scrollSelectedIntoView();
    this.emit("selection-changed");
  }

  on(event: TableEvent, fn: (idx: number, row: TableRow<T> | null) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  handleKey(key: KeyEvent): boolean {
    if (this.rows.length === 0) return false;
    let handled = true;
    let next = this.selectedIdx;
    switch (key.name) {
      case "up":
      case "k":
        next = this.selectedIdx - 1;
        break;
      case "down":
      case "j":
        next = this.selectedIdx + 1;
        break;
      case "pageup":
        next = this.selectedIdx - 10;
        break;
      case "pagedown":
        next = this.selectedIdx + 10;
        break;
      case "home":
        next = 0;
        break;
      case "end":
        next = this.rows.length - 1;
        break;
      case "return":
        this.emit("item-activated");
        return true;
      default:
        handled = false;
    }
    if (!handled) return false;
    this.setSelectedIndex(next);
    return true;
  }

  private emit(event: TableEvent): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) fn(this.selectedIdx, this.getSelected());
  }

  private cellLayout(col: TableColumn<T>) {
    const opts: Record<string, unknown> = {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: col.align === "right" ? "flex-end" : "flex-start",
      paddingRight: 1,
      overflow: "hidden",
      flexShrink: 1,
    };
    if (col.width === "flex") {
      opts.flexGrow = 1;
      opts.minWidth = 4;
    } else {
      opts.width = col.width;
    }
    return opts;
  }

  private renderHeader(): void {
    for (const c of [...this.headerBox.getChildren()]) this.headerBox.remove(c.id);
    for (const col of this.columns) {
      const cell = new BoxRenderable(this.ctx, {
        ...this.cellLayout(col),
        backgroundColor: this.theme.panel,
      });
      cell.add(
        new TextRenderable(this.ctx, {
          content: col.label.toUpperCase(),
          fg: this.theme.fgSubtle,
          truncate: true,
        }),
      );
      this.headerBox.add(cell);
    }
  }

  private renderBody(): void {
    for (const c of [...this.body.getChildren()]) this.body.remove(c.id);
    this.rowVisuals = [];

    if (this.rows.length === 0) {
      this.body.visible = false;
      this.emptyText.visible = true;
      return;
    }

    this.body.visible = true;
    this.emptyText.visible = false;

    for (let i = 0; i < this.rows.length; i++) {
      const isSel = i === this.selectedIdx;
      const rowBox = new BoxRenderable(this.ctx, {
        width: "100%",
        height: 1,
        flexDirection: "row",
        paddingLeft: 1,
        paddingRight: 1,
        backgroundColor: this.rowBg(isSel),
      });
      const cellTexts: TextRenderable[] = [];
      for (const col of this.columns) {
        const cell = new BoxRenderable(this.ctx, {
          ...this.cellLayout(col),
          backgroundColor: this.rowBg(isSel),
        });
        const text = new TextRenderable(this.ctx, {
          content: col.get(this.rows[i]!.raw),
          fg: this.cellFg(col, this.rows[i]!.raw, isSel),
          truncate: true,
        });
        cell.add(text);
        rowBox.add(cell);
        cellTexts.push(text);
      }
      this.body.add(rowBox);
      this.rowVisuals.push({ box: rowBox, cellTexts });
    }
    this.scrollSelectedIntoView();
  }

  private rowBg(selected: boolean): string {
    if (!selected) return this.theme.panel;
    return this.hasFocus ? this.theme.selectionBg : this.theme.highlightBg;
  }

  private cellFg(col: TableColumn<T>, raw: T, selected: boolean): string {
    const fallback = selected
      ? this.hasFocus
        ? this.theme.selectionFg
        : this.theme.highlightFg
      : this.theme.fg;
    const tone = col.tone?.(raw);
    if (selected) {
      // Selected rows use the selection foreground for readability,
      // unless the tone is something attention-grabbing.
      if (tone === "negative" || tone === "warning" || tone === "positive") {
        return toneToColor(this.theme, tone, fallback);
      }
      return fallback;
    }
    return toneToColor(this.theme, tone, fallback);
  }

  private applySelectionVisual(prevIdx?: number): void {
    const apply = (idx: number) => {
      const visual = this.rowVisuals[idx];
      if (!visual) return;
      const row = this.rows[idx];
      if (!row) return;
      const isSel = idx === this.selectedIdx;
      visual.box.backgroundColor = this.rowBg(isSel);
      // refresh each cell's bg + fg
      const cellBoxes = visual.box.getChildren();
      for (let c = 0; c < this.columns.length; c++) {
        const col = this.columns[c]!;
        const cellBox = cellBoxes[c] as BoxRenderable | undefined;
        if (cellBox) cellBox.backgroundColor = this.rowBg(isSel);
        const text = visual.cellTexts[c];
        if (text) text.fg = this.cellFg(col, row.raw, isSel);
      }
    };
    if (prevIdx !== undefined && prevIdx !== this.selectedIdx) apply(prevIdx);
    apply(this.selectedIdx);
  }

  private scrollSelectedIntoView(): void {
    const visual = this.rowVisuals[this.selectedIdx];
    if (!visual) return;
    try {
      this.body.scrollChildIntoView(visual.box.id);
    } catch {
      // Pre-layout calls can throw; ignore.
    }
  }
}
