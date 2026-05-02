export interface SpinnerStyle {
  id: string;
  name: string;
  frames: string[];
  intervalMs: number;
}

export const SPINNERS: Record<string, SpinnerStyle> = {
  dots: {
    id: "dots",
    name: "Dots",
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    intervalMs: 80,
  },
  line: {
    id: "line",
    name: "Line",
    frames: ["|", "/", "-", "\\"],
    intervalMs: 120,
  },
  arrow: {
    id: "arrow",
    name: "Arrow",
    frames: ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"],
    intervalMs: 120,
  },
  pulse: {
    id: "pulse",
    name: "Pulse",
    frames: ["█", "▓", "▒", "░", "▒", "▓"],
    intervalMs: 110,
  },
  matrix: {
    id: "matrix",
    name: "Matrix",
    frames: ["⠁", "⠃", "⠇", "⡇", "⣇", "⣧", "⣷", "⣿", "⣷", "⣧", "⣇", "⡇", "⠇", "⠃"],
    intervalMs: 70,
  },
  bounce: {
    id: "bounce",
    name: "Bounce",
    frames: ["⠁", "⠂", "⠄", "⠂"],
    intervalMs: 130,
  },
};

export const SPINNER_IDS = Object.keys(SPINNERS);

export function getSpinner(id?: string): SpinnerStyle {
  if (id && SPINNERS[id]) return SPINNERS[id];
  return SPINNERS.dots!;
}

export class SpinnerTicker {
  private style: SpinnerStyle;
  private idx = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(frame: string) => void>();

  constructor(style: SpinnerStyle) {
    this.style = style;
  }

  setStyle(style: SpinnerStyle) {
    this.style = style;
    this.idx = 0;
    if (this.timer) {
      this.stop();
      this.start();
    }
  }

  current(): string {
    return this.style.frames[this.idx % this.style.frames.length] ?? "";
  }

  on(fn: (frame: string) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.idx = (this.idx + 1) % this.style.frames.length;
      const frame = this.current();
      for (const fn of this.listeners) fn(frame);
    }, this.style.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
