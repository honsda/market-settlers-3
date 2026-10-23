# Settlers Market

A live trading board for **Settlers III** on `play.settlers-mc.org` — post buy orders and sell offers, compare the whole order book, jump straight to a meeting point on the live Dynmap, read market dispatches, and get significant price moves pushed to Discord.

Built with **SvelteKit 3**, **Svelte 5 runes**, **TypeScript**, **Tailwind CSS v4**, SQLite/Supabase and **discord.js**.

---

## What it does

- **Buy orders & sell offers** — quantity, price per unit, IGN, guild, contact, note and optional X/Y/Z meeting point.
- **Market board** — best bid, best ask, spread, book depth, 24h move and a 7-day sparkline for every traded item.
- **Live updates** — offers posted on the website or from Discord appear everywhere within a second via Server-Sent Events.
- **Embedded live map** — the server Dynmap is framed in the app, with one-click deep links to offer coordinates and a live online-player list.
- **News & dispatches** — a `/news` section with market announcements, trading guides and community notes, including individual article pages with an in-page contents rail.
- **Discord bot** — `/price`, `/market`, `/offers`, `/player`, `/post` and `/alerts` slash commands, plus automatic alerts when a best bid or ask moves past a threshold or prints a new 7-day extreme.
- **No accounts** — your IGN/guild profile lives in your browser; each offer you create gets a local edit token so only you can cancel it.
- **Demo mode** — `npm run db:seed` fills the board with believable traders and two weeks of price history.
- **Supabase-ready schema** — a complete Postgres schema with RLS, indexes, an alert queue and an atomic revision counter lives in `supabase/schema.sql`.

---

## Quick start

Requirements: **Node.js 24+** (the app uses the built-in `node:sqlite` module) and npm.

```bash
git clone https://github.com/honsda/market-settlers-3.git
cd settlers3
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run db:seed           # optional demo data
npm run dev
```

Open <http://localhost:5173>. The map, market board, offers and Discord page all work without a bot token; the Discord page will show “not configured” until you add one.

### Run the website and bot together

```bash
# fill in DISCORD_TOKEN and DISCORD_CLIENT_ID first
npm run dev:all
```

`dev:all` starts Vite on port 5173 and the bot in watch mode. Both processes share the same SQLite file.

---

## Discord bot setup

1. Create an application at <https://discord.com/developers/applications> and add a **Bot**.
2. Copy the token and Application ID into `.env`:

   ```dotenv
   DISCORD_TOKEN=...
   DISCORD_CLIENT_ID=...
   DISCORD_GUILD_ID=...              # optional, makes commands appear instantly
   DISCORD_ALERT_CHANNEL_ID=...      # optional, can also be set with /alerts
   ```

3. Invite the bot with the `bot` and `applications.commands` scopes. **Send Messages** is the only permission it needs; `/alerts` additionally checks for **Manage Server** on the person running it.
4. Run `npm run bot:deploy` once (or just `npm run bot` — it registers commands on startup).
5. Start it with `npm run bot` or `npm run dev:all`.

No privileged intents (message content, members, presence) are required — only `Guilds`.

### Slash commands

| Command | What it does |
| --- | --- |
| `/price item:<item>` | Best bid/ask, spread, 24h move, 7-day range and book depth. |
| `/market [sort]` | Compact board ranked by activity, biggest movers or tightest spread. |
| `/offers [item] [side] [player]` | Browse live offers with any combination of filters. |
| `/player ign:<name>` | Guild, open offers, locked value and last activity for a trader. |
| `/post side item quantity price ign [guild] [contact] [note] [x] [y] [z]` | Publish an offer straight from Discord. The reply is ephemeral and includes a **Cancel this offer** button. |
| `/alerts channel:<#channel>` | Point market alerts at a channel. Requires **Manage Server**. |

Item options use Discord autocomplete backed by the shared catalogue in `src/lib/market.ts`.

### How alerts work

Every offer mutation snapshots the item's best bid/ask into `price_history`. When a price moves more than `ALERT_THRESHOLD_PCT` (default **8%**), or sets a new 7-day high/low, a row is written to the `alerts` table. The bot polls that queue every `ALERT_POLL_SECONDS` (default 20s) and posts an embed to the configured channel. Alerts are marked as posted only after Discord accepts them, so nothing is lost if the bot is briefly offline.

Alerts are suppressed per item + direction for `ALERT_COOLDOWN_MINUTES` (default 45) to keep the feed readable.

---

## Supabase

The hosted Postgres schema lives in [`supabase/schema.sql`](supabase/schema.sql). It creates:

- `offers` — the shared order book, with status/source checks and edit tokens.
- `price_history` — best bid/ask snapshots used for sparklines and alerts.
- `alerts` — the bot's queued price signals and delivery state.
- `meta` — the revision counter, bot heartbeat and alert-channel settings.
- `bump_revision()` — an atomic revision bump used by the web app and bot.
- `open_offers` — a convenience view for dashboards.

Row Level Security is enabled on every table and public access is revoked. The server uses `SUPABASE_SECRET_KEY`, which bypasses RLS; the publishable key cannot read the market tables.

Add the project URL and keys to `.env`, then apply the schema in one of two ways:

1. **SQL editor** — open the Supabase dashboard → SQL Editor, paste `supabase/schema.sql`, and run it.
2. **Management API** — create a personal access token at <https://supabase.com/dashboard/account/tokens>, add `SUPABASE_ACCESS_TOKEN=sbp_...` to `.env`, and run:

   ```bash
   npm run db:push-schema
   ```

The API keys can read and write rows, but they cannot run DDL, so schema creation needs either the SQL editor or a personal access token.

Local development continues to use the SQLite demo database. The Supabase schema mirrors the same tables and column names for a hosted deployment.

---

## News & dispatches

The public news section is at `/news`, with article pages at `/news/[slug]`. Dispatches are content, not database rows: edit `src/lib/news.ts` to add an article (`title`, `excerpt`, `category`, `author`, date, accent, icon, tags and a block-based body), and the listing, filters, related links, in-page contents and metadata update automatically.

Categories currently supported: `Announcement`, `Market`, `Guide` and `Event`.

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server with HMR. |
| `npm run build` | Production build (Node adapter → `build/`). |
| `npm start` | Run the production server (`node build/index.js`). |
| `npm run check` | Svelte + TypeScript diagnostics. |
| `npm run bot` | Discord bot in watch mode. |
| `npm run bot:start` | Discord bot without watch mode. |
| `npm run bot:deploy` | Register slash commands without starting the bot. |
| `npm run dev:all` | Website + bot together. |
| `npm run db:seed` | Add demo offers, history and alerts. |
| `npm run db:reset` | Delete the local database and reseed it. |
| `npm run db:seed -- --force` | Rebuild demo rows in place. |
| `npm run db:push-schema` | Apply `supabase/schema.sql` with `SUPABASE_ACCESS_TOKEN`. |

---

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_URL` | `http://localhost:5173` | Public URL used in Discord embeds and links. |
| `MARKET_DB_PATH` | `data/market.db` | Shared SQLite database. Web app and bot must use the same path. |
| `ALERT_THRESHOLD_PCT` | `8` | Minimum best bid/ask move to alert on. |
| `ALERT_COOLDOWN_MINUTES` | `45` | Per item + direction alert cooldown. |
| `ALERT_POLL_SECONDS` | `20` | Bot alert-queue poll interval. |
| `DISCORD_TOKEN` | — | Bot token. |
| `DISCORD_CLIENT_ID` | — | Application ID (used for registration and the invite URL). |
| `DISCORD_GUILD_ID` | — | Optional guild for instant command registration. |
| `DISCORD_ALERT_CHANNEL_ID` | — | Default alert channel; `/alerts` can override it in the database. |
| `SUPABASE_URL` | — | Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | — | Public key (`sb_publishable_...`); safe for the browser. |
| `SUPABASE_SECRET_KEY` | — | Server-only secret key (`sb_secret_...`); bypasses RLS. Never expose it. |
| `SUPABASE_ACCESS_TOKEN` | — | Personal access token used only by `npm run db:push-schema`. |

`.env.local` takes precedence over `.env`. The web app, scripts and bot all load the same files (`src/lib/server/env.ts` uses `process.loadEnvFile`).

---

## Project layout

```
src/
  lib/
    market.ts              shared catalogue, types, map URL builder
    news.ts                news article content, categories and helpers
    format.ts              price/quantity/percent/time formatting
    client/                browser stores (profile, live SSE, toasts, composer)
    components/            Svelte UI (market table, offer form, cards, map frame…)
    server/
      db.ts                node:sqlite schema, revision counter, transactions
      offers.ts            offer CRUD, edit tokens, guilds, player summaries
      market.ts            order-book snapshots, history, alert generation
      dashboard.ts         /api/market response assembly
      alerts.ts            alert queue reads/writes for the bot
      dynmap.ts            live Dynmap player proxy
      env.ts               environment loading + defaults
  routes/
    +page.svelte           dashboard
    market/               full market board
    map/                  embedded live map
    news/                 dispatch listing and article pages
    discord/              bot status, commands and alert feed
    api/                  offers, market, history, alerts, server, guilds, stream
bot/
  index.ts                 Discord client, heartbeat, interactions
  commands.ts              slash commands, autocomplete, cancel button
  watcher.ts               queued alert delivery
  register.ts              REST command registration
  deploy-commands.ts       standalone registration entrypoint
  format.ts                Discord embeds
scripts/
  seed.ts / reset.ts       demo data and local database reset
  push-schema.ts           apply supabase/schema.sql via the Management API
supabase/
  schema.sql               Postgres tables, indexes, RLS and revision RPC
data/
  market.db                created on first run (gitignored)
```

### Data model

- `offers` — one row per open/closed offer, with `source` (`web`, `discord`, `seed`) and an `edit_token` returned only to the creator.
- `price_history` — best bid/ask snapshots per item, written whenever an offer changes the book.
- `alerts` — significant-move queue with `posted_at` / `discord_message_id` for reliable delivery.
- `meta` — revision counter (drives SSE), bot heartbeat, alert channel and other small values.

The browser keeps a local profile (`IGN`, guild, contact) and per-offer edit tokens in `localStorage`. There are no passwords or user accounts.

---

## API

| Route | Methods | Notes |
| --- | --- | --- |
| `/api/market` | `GET` | Offers, recent activity, computed order books, alerts, summary. |
| `/api/offers` | `GET`, `POST` | Filters: `status`, `side`, `item`, `player`, `guild`, `limit`. |
| `/api/offers/[id]` | `GET`, `PATCH`, `DELETE` | Mutations need `x-edit-token`. |
| `/api/history/[item]` | `GET` | Price points for one item. |
| `/api/alerts` | `GET` | Price signal feed. |
| `/api/guilds` | `GET` | Most active guilds. |
| `/api/server` | `GET` | Live Dynmap player list (proxied). |
| `/api/bot/status` | `GET` | Connection, channel and threshold status. |
| `/api/stream` | `GET` | Server-Sent Events; emits when the database revision changes. |

Rate limiting is in-process (`src/lib/server/rate-limit.ts`) and keyed by IP.

---

## Deployment

The project uses `@sveltejs/adapter-node`, so `npm run build` produces a self-contained Node server:

```bash
npm ci
npm run build
APP_URL=https://market.example.com PORT=3000 node build/index.js
```

Run the bot as a second process with `npm run bot:start`, sharing `MARKET_DB_PATH` with the web app. SQLite is in WAL mode, so the two processes can read and write concurrently on one host. If you run multiple web instances, point them at a single database file on shared storage or switch the data layer to a client/server database.

`data/` is gitignored, so back up `market.db` (and its `-wal` file while the app is running) if the board matters to you.

---

## Notes & disclaimer

- Prices are set entirely by players. The board does not verify trades or hold items/coins.
- The map iframe points at `https://play.settlers-mc.org/`; deep links use its Dynmap query parameters (`worldname=Caeldun`, `mapname=flat|surface`, `x/y/z/zoom`).
- Item textures are loaded from the public `minecraft-assets` CDN.
- This is a community project and is not affiliated with the server owners or with Blue Byte.
