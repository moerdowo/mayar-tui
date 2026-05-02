export interface Theme {
  id: string;
  name: string;
  background: string;
  panel: string;
  border: string;
  borderFocused: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  accent: string;
  accentSecondary: string;
  positive: string;
  warning: string;
  negative: string;
  selectionBg: string;
  selectionFg: string;
  highlightBg: string;
  highlightFg: string;
  scrollbarBg: string;
  scrollbarFg: string;
}

export const THEMES: Record<string, Theme> = {
  matrix: {
    id: "matrix",
    name: "Matrix",
    background: "#000000",
    panel: "#020a02",
    border: "#0a3d0a",
    borderFocused: "#00ff66",
    fg: "#00ff41",
    fgMuted: "#00b32d",
    fgSubtle: "#005c17",
    accent: "#39ff14",
    accentSecondary: "#26d953",
    positive: "#00ff66",
    warning: "#ffd400",
    negative: "#ff3b3b",
    selectionBg: "#003d14",
    selectionFg: "#bdffba",
    highlightBg: "#005c17",
    highlightFg: "#ccffcc",
    scrollbarBg: "#031703",
    scrollbarFg: "#00b32d",
  },
  "tokyo-night": {
    id: "tokyo-night",
    name: "Tokyo Night",
    background: "#1a1b26",
    panel: "#1f2335",
    border: "#3b4261",
    borderFocused: "#7aa2f7",
    fg: "#c0caf5",
    fgMuted: "#9aa5ce",
    fgSubtle: "#565f89",
    accent: "#7aa2f7",
    accentSecondary: "#bb9af7",
    positive: "#9ece6a",
    warning: "#e0af68",
    negative: "#f7768e",
    selectionBg: "#283457",
    selectionFg: "#c0caf5",
    highlightBg: "#3d59a1",
    highlightFg: "#ffffff",
    scrollbarBg: "#1f2335",
    scrollbarFg: "#7aa2f7",
  },
  goblin: {
    id: "goblin",
    name: "Goblin Mode",
    background: "#0e1a0a",
    panel: "#152411",
    border: "#3a5a25",
    borderFocused: "#a3d977",
    fg: "#c8e6a0",
    fgMuted: "#7faa54",
    fgSubtle: "#4a6b30",
    accent: "#a3d977",
    accentSecondary: "#d6a85a",
    positive: "#7fe25f",
    warning: "#e0a14a",
    negative: "#d35454",
    selectionBg: "#2d4a1a",
    selectionFg: "#e8f5c8",
    highlightBg: "#557a30",
    highlightFg: "#fffbe6",
    scrollbarBg: "#152411",
    scrollbarFg: "#a3d977",
  },
  dracula: {
    id: "dracula",
    name: "Dracula",
    background: "#282a36",
    panel: "#21222c",
    border: "#44475a",
    borderFocused: "#bd93f9",
    fg: "#f8f8f2",
    fgMuted: "#bfbfbf",
    fgSubtle: "#6272a4",
    accent: "#bd93f9",
    accentSecondary: "#ff79c6",
    positive: "#50fa7b",
    warning: "#f1fa8c",
    negative: "#ff5555",
    selectionBg: "#44475a",
    selectionFg: "#f8f8f2",
    highlightBg: "#6272a4",
    highlightFg: "#f8f8f2",
    scrollbarBg: "#21222c",
    scrollbarFg: "#bd93f9",
  },
  synthwave: {
    id: "synthwave",
    name: "Synthwave",
    background: "#1b1033",
    panel: "#241447",
    border: "#5a3296",
    borderFocused: "#ff7edb",
    fg: "#f5f0ff",
    fgMuted: "#b9a3e0",
    fgSubtle: "#7a5cb1",
    accent: "#ff7edb",
    accentSecondary: "#36f9f6",
    positive: "#72f1b8",
    warning: "#fede5d",
    negative: "#ff4365",
    selectionBg: "#3a1f6e",
    selectionFg: "#fff",
    highlightBg: "#ff7edb",
    highlightFg: "#1b1033",
    scrollbarBg: "#241447",
    scrollbarFg: "#ff7edb",
  },
  nord: {
    id: "nord",
    name: "Nord",
    background: "#2e3440",
    panel: "#3b4252",
    border: "#4c566a",
    borderFocused: "#88c0d0",
    fg: "#eceff4",
    fgMuted: "#d8dee9",
    fgSubtle: "#7b8394",
    accent: "#88c0d0",
    accentSecondary: "#81a1c1",
    positive: "#a3be8c",
    warning: "#ebcb8b",
    negative: "#bf616a",
    selectionBg: "#434c5e",
    selectionFg: "#eceff4",
    highlightBg: "#5e81ac",
    highlightFg: "#eceff4",
    scrollbarBg: "#3b4252",
    scrollbarFg: "#88c0d0",
  },
  rosepine: {
    id: "rosepine",
    name: "Rosé Pine",
    background: "#191724",
    panel: "#1f1d2e",
    border: "#403d52",
    borderFocused: "#ebbcba",
    fg: "#e0def4",
    fgMuted: "#908caa",
    fgSubtle: "#6e6a86",
    accent: "#ebbcba",
    accentSecondary: "#c4a7e7",
    positive: "#9ccfd8",
    warning: "#f6c177",
    negative: "#eb6f92",
    selectionBg: "#26233a",
    selectionFg: "#e0def4",
    highlightBg: "#524f67",
    highlightFg: "#e0def4",
    scrollbarBg: "#1f1d2e",
    scrollbarFg: "#ebbcba",
  },
};

export const THEME_IDS = Object.keys(THEMES);

export function getTheme(id?: string): Theme {
  if (id && THEMES[id]) return THEMES[id];
  return THEMES.matrix!;
}
