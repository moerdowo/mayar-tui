# mayartui

A terminal UI dashboard for the [Mayar.id](https://mayar.id) headless API.
Built with [OpenTUI](https://opentui.com) on Bun, written in TypeScript.

```
┌── mayartui ───────────────────────────────────────────────────┐
│ Sat, 2 May 2026  ·  14:30:45  ●                               │
│                                                               │
│ ███╗   ███╗ █████╗ ██╗   ██╗ █████╗ ██████╗     BALANCE       │
│ ████╗ ████║██╔══██╗╚██╗ ██╔╝██╔══██╗██╔══██╗                  │
│ ██╔████╔██║███████║ ╚████╔╝ ███████║██████╔╝    Rp 12.345.678 │
│ ██║╚██╔╝██║██╔══██║  ╚██╔╝  ██╔══██║██╔══██╗                  │
│ ╚═╝     ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   active … pending│
└────────────────────────────────────────────────── production ─┘
┌── menu ──────┐┌── list ──────────────────────┐┌── detail ────┐
│ 1 Tx Paid   ││ Andi Setiawan      Rp 250 000 ││ ID 8af33…    │
│ 2 Tx Unpaid ││ Putri Hidayat      Rp 480 000 ││ STATUS       │
│ 3 Invoices  ││ Bambang R.         Rp 125 000 ││ SUCCESS      │
│ 4 Payments  ││ Dewi Lestari        Rp 99 000 ││ AMOUNT       │
│ 5 Products  ││ Rama Wijaya        Rp 750 000 ││ Rp 250 000   │
│ 6 Customers ││                              ││ ...           │
└──────────────┘└───────────────────────────────┘└──────────────┘
 tab focus(menu) · s settings · r reload · ←/→ page · q quit
```

## Features

- Three-column layout — menu / list / detail.
- Live clock with blinking indicator and a chunky ASCII balance widget
  in the header.
- Resources: paid transactions, unpaid transactions, invoices, single
  payments, products, customers.
- Theme switcher: Matrix, **Mayar** (brand light theme), Tokyo Night,
  Goblin Mode, Dracula, Synthwave, Nord, Rosé Pine.
- Configurable loading spinner (dots, line, arrow, pulse, matrix, bounce)
  with a global "animations off" toggle.
- Production / Sandbox environment toggle.
- Persists configuration to `~/.config/mayartui/config.json`
  (mode `0600`).
- API key can be supplied via `MAYAR_API_KEY` environment variable to
  override the saved value.

## Requirements

**Bun ≥ 1.1 is required at runtime.** OpenTUI's native renderer ships
Bun-only FFI bindings (Node.js / Deno support is in progress upstream),
so `mayartui` runs on Bun even when installed through `npm`.

Install Bun once if you don't already have it:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Install

Install globally from npm:

```bash
npm install -g mayartui
mayartui
```

Or one-off via `npx` / `bunx`:

```bash
npx mayartui
# or
bunx mayartui
```

Or run from source:

```bash
git clone https://github.com/moerdowo/mayar-tui.git
cd mayar-tui
bun install
bun run start
```

## Configuration

On first launch you'll see a setup card asking for your API key. Generate
one at <https://web.mayar.id/api-keys>. The key is stored at
`~/.config/mayartui/config.json` (mode `0600`).

### Environment variables

| Variable          | Effect                                     |
| ----------------- | ------------------------------------------ |
| `MAYAR_API_KEY`   | Overrides the saved API key for this run.  |
| `MAYAR_ENV`       | `production` or `sandbox`.                 |
| `XDG_CONFIG_HOME` | Standard XDG override for the config path. |

## Keys

| Key             | Action                                   |
| --------------- | ---------------------------------------- |
| `↑` / `↓`       | Move within the focused list             |
| `Tab` / `S-Tab` | Cycle focus between menu / list / detail |
| `Enter`         | Confirm menu selection                   |
| `1`–`6`         | Jump straight to a resource              |
| `←` / `→`       | Previous / next page                     |
| `r`             | Reload current resource and balance      |
| `s`             | Open the settings overlay                |
| `Esc`           | Close settings                           |
| `q` / `Ctrl+C`  | Quit                                     |

## Programmatic use

`mayartui` also exposes a small library surface — useful if you want to
embed the API client or mount the TUI inside another OpenTUI app:

```ts
import {
  MayarClient,
  MayarApp,
  THEMES,
  SPINNERS,
} from "mayartui";

const client = new MayarClient({
  apiKey: process.env.MAYAR_API_KEY!,
  env: "production",
});

const balance = await client.balance();
const paid = await client.paidTransactions({ page: 1, pageSize: 20 });
```

## API endpoints used

All endpoints are documented at <https://docs.mayar.id>. The base URL is
`https://api.mayar.id/hl/v1` (production) or `https://api.mayar.club/hl/v1`
(sandbox). Authentication is `Authorization: Bearer <api_key>`.

| Method | Path                       | Resource                |
| ------ | -------------------------- | ----------------------- |
| `GET`  | `/balance`                 | account balance         |
| `GET`  | `/transactions`            | paid transactions       |
| `GET`  | `/transactions/unpaid`     | unpaid transactions     |
| `GET`  | `/invoice`                 | invoices                |
| `GET`  | `/payment`                 | single payment requests |
| `GET`  | `/product`                 | products                |
| `GET`  | `/customer`                | customers               |

## Development

```bash
bun install
bun run dev          # run the TUI from source
bun run typecheck    # tsc --noEmit
bun run build        # bundle to dist/ + emit .d.ts
```

There is a small smoke harness in `scripts/` that mounts the renderer in
testing mode (no real TTY) to catch regressions:

```bash
bun run scripts/smoke.ts
bun run scripts/smoke-theme.ts
bun run scripts/smoke-settings.ts
```

## License

MIT
