# Settlers Market

A live trading board for **Settlers III** on `play.settlers-mc.org` — post buy orders and sell offers, compare the whole order book, jump straight to a meeting point on the live Dynmap, read market dispatches, and get significant price moves pushed to Discord.

Built with **SvelteKit 3**, **Svelte 5 runes**, **TypeScript**, **Tailwind CSS v4**, SQLite/Supabase and **discord.js**.

---

## What it does

- **Buy orders & sell offers** — quantity, price per unit, IGN, guild, contact, note and optional X/Y/Z meeting point.
- **Market board** — best bid, best ask, spread, book depth, 24h move and a 7-day sparkline for every traded item.
- **Live shop prices** — the official wiki feed (`/data/market.json`) is shown on `/market` with best wanted/for-sale prices, last sale, 24h volume and movers.
- **Live updates** — offers posted on the website or from Discord appear everywhere within a second via Server-Sent Events.
- **Embedded live map** — the server Dynmap is framed in the app, with one-click deep links to offer coordinates and a live online-player list.
- **News & dispatches** — a `/news` section with market announcements, trading guides and community notes, including individual article pages with an in-page contents rail.
- **Discord bot** — `/price`, `/market`, `/offers`, `/player`, `/post` and `/alerts` slash commands, plus automatic alerts when a best bid or ask moves past a threshold or prints a new 7-day extreme. It also posts a batched market pulse and significant shop-price moves from the official feed, with the island/area and region named.
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
   DISCORD_ALERT_CHANNEL_ID=...      # market channel; can also be set with /alerts
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

## Live shop feed

The **Live shop prices** panel on `/market` and the bot's market updates read the same feed as the official wiki market page:

```text
https://wiki.settlers-mc.org/data/market.json
```

The server writes that file about every 60 seconds. All prices in it are **gold nuggets**; bundle offers (for example `8 wheat for 2 nuggets`) are normalized to a per-item price before display.

The bot polls the feed every `WIKI_MARKET_POLL_SECONDS` (default **60s**) and:

- posts a batched **market pulse** to the configured market channel every `WIKI_MARKET_SUMMARY_MINUTES` (default **30m**) when new trades have happened;
- posts an immediate **market move** alert when a new trade's average is at least `WIKI_MARKET_ALERT_THRESHOLD_PCT` (default **12%**) away from that item's previous 7-day average **in the same region**;
- labels every pulse and move with the island/area and region (for example `Rainlands / Morvethan`);
- suppresses repeat move alerts for the same item + region for `WIKI_MARKET_ALERT_COOLDOWN_MINUTES` (default **60m**).

The cursor is stored in `meta` (`wiki:last_trade_ts`, `wiki:last_summary_at`, `wiki:last_feed_generated`), so restarting the bot does not replay old trades. On first start it begins from the newest trade in the feed.

The official feed contains shop names, items, regions and prices — no player names. It is separate from the player-to-player order book in `offers`; the dashboard shows both.

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

### Which database is used?

The app selects **Supabase automatically when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set**, and falls back to SQLite otherwise. `MARKET_BACKEND=sqlite` forces the local demo database; `MARKET_BACKEND=supabase` forces the hosted one.

Both the web app and the Discord bot use the same backend and the same `meta.revision` counter. A write from the bot bumps the revision through `bump_revision()`, and the dashboard's SSE stream refetches within a couple of seconds.

`npm run db:seed` and `npm run db:reset` are SQLite-only demo tools. A fresh Supabase project starts empty — create the first offers from the dashboard or `/post` in Discord.

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
| `MARKET_BACKEND` | `supabase` if configured | `supabase` or `sqlite`. |
| `MARKET_DB_PATH` | `data/market.db` | Shared SQLite database. Web app and bot must use the same path. |
| `ALERT_THRESHOLD_PCT` | `8` | Minimum best bid/ask move to alert on. |
| `ALERT_COOLDOWN_MINUTES` | `45` | Per item + direction alert cooldown. |
| `ALERT_POLL_SECONDS` | `20` | Bot alert-queue poll interval. |
| `WIKI_MARKET_URL` | `https://wiki.settlers-mc.org/data/market.json` | Official shop-price feed. |
| `WIKI_MARKET_POLL_SECONDS` | `60` | How often the bot checks the shop feed. |
| `WIKI_MARKET_SUMMARY_MINUTES` | `30` | Batched market-pulse interval. |
| `WIKI_MARKET_ALERT_THRESHOLD_PCT` | `12` | Move size that triggers an immediate market-move alert. |
| `WIKI_MARKET_ALERT_COOLDOWN_MINUTES` | `60` | Per-item market-move cooldown. |
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
    wiki-market.ts         official shop-feed types, regions and item mapping
    news.ts                news article content, categories and helpers
    format.ts              price/quantity/percent/time formatting
    client/                browser stores (profile, live SSE, toasts, composer)
    components/            Svelte UI (market table, offer form, cards, map frame…)
    server/
      db.ts                backend switch, SQLite schema, Supabase client, meta/revision
      offers.ts            async offer facade (SQLite or Supabase)
      offers-sqlite.ts     local offer CRUD, edit tokens, guilds, player summaries
      offers-supabase.ts   hosted offer CRUD
      market.ts            async history/snapshot facade
      market-core.ts       pure order book + alert evaluation
      market-sqlite.ts     local price history and alert queue
      market-supabase.ts   hosted price history and alert queue
      dashboard.ts         /api/market response assembly
      wiki-market.ts       official shop-feed fetch, normalization and snapshot
      alerts.ts            async alert queue facade for the bot
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
  wiki-market.ts           shop-feed pulse and market-move posts
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
| `/api/wiki-market` | `GET` | Normalized official shop feed: shops, prices, 24h volume, movers. |
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

Run the bot as a second process with `npm run bot:start`. With Supabase configured, both processes only need the same `SUPABASE_URL` and `SUPABASE_SECRET_KEY`; there is no shared volume to manage. The revision counter and alert queue live in Postgres, so multiple web instances and the bot stay in sync.

For a SQLite-only deployment, set `MARKET_BACKEND=sqlite`, keep `MARKET_DB_PATH` on shared storage, and run the bot on the same host. SQLite is in WAL mode, so the two processes can read and write concurrently.

`data/` is gitignored. Back up `market.db` (and its `-wal` file while the app is running) if you use the local backend.

---

## Notes & disclaimer

- Prices are set entirely by players. The board does not verify trades or hold items/coins.
- The map iframe points at `https://play.settlers-mc.org/`; deep links use its Dynmap query parameters (`worldname=Caeldun`, `mapname=flat|surface`, `x/y/z/zoom`).
- Item textures are loaded from the public `minecraft-assets` CDN.
- This is a community project and is not affiliated with the server owners or with Blue Byte.
