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
- **Newsroom & newspaper** — a standalone `/news` area with recent articles, a personal “Your articles” desk, a rich-text authoring page, moderator image review, an endless dated newspaper feed at `/news/paper`, and automatic Discord announcements when a dispatch is published.
- **Discord bot** — `/price`, `/market`, `/offers`, `/player`, `/post` and `/alerts` slash commands, plus automatic alerts when a best bid or ask moves past a threshold or prints a new 7-day extreme. It also posts a batched market pulse, an hourly top-10 profitable spread board, and significant shop-price moves from the official feed, with the island/area and region named.
- **No accounts** — your IGN/guild profile lives in your browser; each offer gets a local edit token and the newsroom gets a local author token, so only you can manage your own posts.
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
   DISCORD_NEWS_CHANNEL_ID=...       # optional; otherwise the bot finds #news by name
   ```

3. Invite the bot with the `bot` and `applications.commands` scopes. Grant **View Channels**, **Send Messages**, **Embed Links**, **Read Message History**, **Manage Messages**, **Manage Roles** and **Manage Channels**. Manage Messages keeps `#apply` clean and lets the guides be pinned; the last two let it create the Dweller role and the admin-only `#staff-verify` channel; `/alerts`, `/initapply`, `/initrule` and `/rolecitizen` additionally check for **Manage Server** on the person running them.
4. Under **Bot → Privileged Gateway Intents**, enable **Server Members** (needed for join roles and member lookups). Message Content is not needed — DMs sent to the bot are exempt, and the `#apply` cleanup never reads message text.
5. Run `npm run bot:deploy` once (or just `npm run bot` — it registers commands on startup).
6. Start it with `npm run bot` or `npm run dev:all`.

### Slash commands

| Command | What it does |
| --- | --- |
| `/price item:<item>` | Best bid/ask, spread, 24h move, 7-day range and book depth. |
| `/market [sort]` | Compact board ranked by activity, biggest movers or tightest spread. |
| `/offers [item] [side] [player]` | Browse live offers with any combination of filters. |
| `/player ign:<name>` | Guild, open offers, locked value and last activity for a trader. |
| `/post side item quantity price ign [guild] [contact] [note] [x] [y] [z]` | Publish an offer straight from Discord. The reply is ephemeral and includes a **Cancel this offer** button. |
| `/alerts channel:<#channel>` | Point market alerts at a channel. Requires **Manage Server**. |
| `/apply` | Starts a membership application. Only works in a channel named **#apply**; the five questions are asked in DMs. |
| `/initapply` | Posts or refreshes the application guide embed in **#apply** and pins it. Requires **Manage Server**. |
| `/initrule [channel]` | Posts or refreshes a pinned general community rules embed. Defaults to the current text channel. Requires **Manage Server**. |
| `/rolecitizen [role] [member]` | Choose the role approved applicants receive (creates **Citizen** when omitted) and optionally give it to someone now. Requires **Manage Server**. |

Item options use Discord autocomplete backed by the shared catalogue in `src/lib/market.ts`.

### Applications and roles

1. A staff member runs `/initapply` in **#apply** to post (or refresh) the guide embed. The bot pins it and deletes other messages posted in the channel, so the guide stays easy to find. `/apply` is refused outside **#apply**, and each member can have only one pending form per server.
2. The bot sends five questions in DMs: **IGN** (3–16 letters, numbers or underscores), **age** (18+; younger applicants are stopped), **timezone and usual play times**, **why they want to join**, and **what they want to do or contribute**. Typing `cancel` stops the flow; unfinished conversations expire after an hour.
3. The finished form is posted to **#staff-verify** with **Approve** and **Deny** buttons. If that channel does not exist the bot creates it with `@everyone` denied **View Channel** — Discord administrators bypass channel overwrites, so it is admin-only. Anyone with **Manage Server** can review.
4. **Approve** gives the configured citizen role (created on demand as **Citizen**) and DMs the applicant; **Deny** DMs them without changing roles. `/rolecitizen role:<@role>` changes the role, and `/rolecitizen member:<@user>` grants it manually.
5. Every new member automatically receives **Dweller**, created with the light blue-grey colour `#9FB4C7`. Dweller stays as the base role after approval.

Application answers, submitted forms and decisions live in the shared `meta` table (`apply:*` keys), so a restart does not lose an in-flight review.

### Community rules

Run `/initrule` in a text channel — or pass `channel:<#channel>` — to post or refresh a pinned rules embed. Running it again edits the same message instead of posting duplicates. The command is staff-only and does not create a channel, so make a **#rules** channel first if you want one.

Rules are general Discord community rules (not in-game rules) and are stored per channel under `rules:message:*` in the shared `meta` table, so each rules channel keeps its own message id.

### How alerts work

Every offer mutation snapshots the item's best bid/ask into `price_history`. When a price moves more than `ALERT_THRESHOLD_PCT` (default **8%**), or sets a new 7-day high/low, a row is written to the `alerts` table. The bot polls that queue every `ALERT_POLL_SECONDS` (default 20s) and posts an embed to the configured channel. Alerts are marked as posted only after Discord accepts them, so nothing is lost if the bot is briefly offline.

Alerts are suppressed per item + direction for `ALERT_COOLDOWN_MINUTES` (default 45) to keep the feed readable.

### News announcements

When a moderator publishes an article, the bot posts an embed in **#news** with the title, summary, section, author, reading time, cover image and a link to the full dispatch. The public URL comes from `APP_URL`.

The bot checks `news_articles` every `NEWS_POLL_SECONDS` (default **20s**) for published rows that have not been announced yet. It sets `announced_at` only after Discord accepts the message, so an outage does not lose articles. On the feature's first start, articles already published before that moment are marked as announced; anything published afterwards is posted.

Set `DISCORD_NEWS_CHANNEL_ID` to point at a specific channel. If it is empty, the bot looks for a channel named **#news** in `DISCORD_GUILD_ID` (or in any server it has joined). The resolved ID is remembered in `meta` under `bot:news_channel_id`.

### Deploy the bot to Cloudflare Containers

The bot is a long-running Discord gateway process: it holds a WebSocket open, so it cannot run as a normal Cloudflare Worker. It runs in a **Cloudflare Container** instead. The Worker in `wrangler.bot.jsonc` manages the container lifecycle, a Cron Trigger wakes it every five minutes, and the image is built from the repo's `Dockerfile`.

Cloudflare Containers require a **Workers Paid** plan. A `basic` container (1 GiB RAM) is enough for this bot; it runs continuously while the gateway connection is open. See [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/).

You can deploy with **Workers Builds** (no local Docker required) or from your machine with Docker.

#### Option A: Workers Builds (no Docker)

1. In the Cloudflare dashboard, create a Worker named `settlers3-bot`: **Workers & Pages → Create application → Hello World**. The name must match `name` in `wrangler.bot.jsonc`.
2. Open the Worker → **Settings → Variables and Secrets** and add the required runtime secrets from the table below: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_URL`. These must be runtime secrets, not Build variables.
3. Go to **Settings → Builds → Connect** and select:
   - Repository: `honsda/market-settlers-3`
   - Branch: `main`
   - Root directory: `/` (repository root)
   - Build command: leave empty, because Workers Builds installs dependencies automatically. Use `npm ci` if the UI requires one.
   - Deploy command: `npm run deploy:bot`
   - Turn off preview/non-production builds. Containers only update through a full `wrangler deploy`, not `wrangler versions upload`.
4. Push a commit to `main` (or click **Deploy** / **Retry build**). The first build takes several minutes while Cloudflare builds and provisions the container image.
5. Open `https://settlers3-bot.<your-subdomain>.workers.dev/health`. `ready` becomes `true` once Discord connects.

#### Option B: Deploy from your machine (Docker)

You need Docker running locally for this path.

1. Log in and create the bot Worker's secrets. These are separate from the website Worker's secrets:

   ```bash
   npx wrangler login
   npx wrangler secret put DISCORD_TOKEN --config wrangler.bot.jsonc
   npx wrangler secret put DISCORD_CLIENT_ID --config wrangler.bot.jsonc
   npx wrangler secret put SUPABASE_URL --config wrangler.bot.jsonc
   npx wrangler secret put SUPABASE_SECRET_KEY --config wrangler.bot.jsonc
   npx wrangler secret put APP_URL --config wrangler.bot.jsonc
   ```

   Add the optional values from the table below the same way. Wrangler offers to create the Worker when you add the first secret.

2. Deploy the container image:

   ```bash
   npm run deploy:bot
   ```

   This runs `wrangler deploy --config wrangler.bot.jsonc`. The first deploy builds and uploads the image. The Cron Trigger (or a request to `/health`) starts the container, and later deploys roll out a fresh image.

3. Open `https://settlers3-bot.<your-subdomain>.workers.dev/health`. The response includes `ready`, the bot tag, guild count and uptime. The health route starts the container if it is not already running.

The bot registers its slash commands on boot. If you only changed command definitions and do not want to rebuild the container, run `npm run bot:deploy` locally against the same Discord application.

If a Workers Builds deploy fails:

- **Worker name mismatch** — the Worker in the dashboard must be named exactly `settlers3-bot`.
- **Required secrets missing** — add them under **Settings → Variables and Secrets**, not under Build variables. Build variables are only available during the build.
- **`/health` returns 404 or 502 on the first deploy** — wait several minutes for the container image to finish provisioning, then retry. Check **Logs** for the bot process.

#### How the container stays online

- `wrangler.bot.jsonc` sets `sleepAfter = "24h"` and a `*/5 * * * *` Cron Trigger. The cron calls `ensureRunning()`, which starts a stopped container or renews the idle timer of a running one.
- If Cloudflare restarts or moves the container, the process reconnects to Discord on boot. The cron brings it back within five minutes.
- `bot/health.ts` exposes `GET /health` on port 3000 only when `BOT_HEALTH_PORT` is set. Cloudflare uses it as the container readiness probe.
- Container logs appear in the Cloudflare dashboard under **Workers & Pages → `settlers3-bot` → Logs**; live tailing is available there.

To run the bot Worker and its container locally (Docker required):

```bash
npm run bot:cloudflare:dev
```

For local development without Docker, keep using `npm run bot` (or `npm run dev:all`); it runs the same `bot/index.ts` directly.

#### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token from the Developer Portal. |
| `DISCORD_CLIENT_ID` | yes | Application ID, used for command registration and the invite link. |
| `DISCORD_GUILD_ID` | recommended | Makes new slash commands appear instantly. |
| `APP_URL` | yes | Public website URL, used in Discord links. |
| `SUPABASE_URL` | yes | Shared database with the web deployment. |
| `SUPABASE_SECRET_KEY` | yes | Server-side key; never expose it to the browser. |
| `DISCORD_ALERT_CHANNEL_ID` | optional | Can also be set later with `/alerts`. |
| `DISCORD_NEWS_CHANNEL_ID` | optional | Defaults to the bot's **#news** channel lookup. |
| `ALERT_*`, `NEWS_POLL_SECONDS`, `WIKI_MARKET_*` | optional | Tuning values described in `.env.example`. |

The container forces `MARKET_BACKEND=supabase`. Do **not** switch it to SQLite: the container filesystem is ephemeral and the website Worker cannot read it. With Supabase configured the bot is stateless and restarts safely.

The bot image uses Node.js 24 and runs `npm run bot:start` (`tsx --tsconfig tsconfig.bot.json bot/index.ts`). `tsx` is a runtime dependency, so `npm ci --omit=dev` is enough.

---

## Live shop feed

The **Live shop prices** panel on `/market` and the bot's market updates read the same feed as the official wiki market page:

```text
https://wiki.settlers-mc.org/data/market.json
```

The server writes that file about every 60 seconds. All prices in it are **gold nuggets**; bundle offers (for example `8 wheat for 2 nuggets`) are normalized to a per-item price before display.

The bot polls the feed every `WIKI_MARKET_POLL_SECONDS` (default **60s**) and:

- posts a batched **market pulse** to the configured market channel every `WIKI_MARKET_SUMMARY_MINUTES` (default **30m**) when new trades have happened;
- posts an hourly **profitable spread board** with up to ten positive shop/market spreads, showing the shop prices, 24h market average, last trade, volume and the margin per item and per 64-stack (`WIKI_MARKET_PROFIT_MINUTES`, default **60m**);
- posts an immediate **market move** alert when a new trade's average is at least `WIKI_MARKET_ALERT_THRESHOLD_PCT` (default **12%**) away from that item's previous 7-day average **in the same region**;
- labels every pulse and move with the island/area and region (for example `Rainlands / Morvethan`);
- uses one Discord field per item + area, with volume, average, gold traded and current best shop prices, so updates stay readable without losing detail;
- suppresses repeat move alerts for the same item + region for `WIKI_MARKET_ALERT_COOLDOWN_MINUTES` (default **60m**).

The profit board includes positive spreads only. It uses the shop-to-shop spread when an item has both an **open selling shop** and an **open buying shop**; if a side is missing it falls back to the 24h weighted average (or the last trade). Sold-out and out-of-gold shops are excluded. Items traded in the last 24 hours come first, and stale shop-to-shop rows only fill leftover slots. Its hourly cursor is `wiki:last_profit_at`.

The cursor is stored in `meta` (`wiki:last_trade_ts`, `wiki:last_summary_at`, `wiki:last_profit_at`, `wiki:last_feed_generated`), so restarting the bot does not replay old trades. On first start it begins from the newest trade in the feed.

The official feed contains shop names, items, regions and prices — no player names. It is separate from the player-to-player order book in `offers`; the dashboard shows both.

---

## Supabase

The hosted Postgres schema lives in [`supabase/schema.sql`](supabase/schema.sql). It creates:

- `offers` — the shared order book, with status/source checks and edit tokens.
- `price_history` — best bid/ask snapshots used for sparklines and alerts.
- `alerts` — the bot's queued price signals and delivery state.
- `meta` — the revision counter, bot heartbeat and alert-channel settings.
- `news_articles` — drafts, review submissions and published dispatches.
- `news_media` — uploaded images plus their approval state, stored as base64 in the row.
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

## Newsroom & newspaper

The newsroom is deliberately separate from the market dashboard. It has its own minimal layout, masthead and navigation:

| Route | Purpose |
| --- | --- |
| `/news` | Recent articles and the front page. |
| `/news/paper` | Endless, dated newspaper feed; older pages load as you scroll. |
| `/news/mine` | The articles created in this browser, with draft/review/published status. |
| `/news/write` | Rich-text editor for new articles and drafts. |
| `/news/moderation` | Staff queue for approving or rejecting images and publishing articles. |
| `/news/[slug]` | A published article. |

### Writing and identity

There are no accounts. The browser generates a random **author token** and keeps it in `localStorage`; the server stores only its SHA-256 hash. That token is how “Your articles”, draft editing and image ownership work. Clearing site data loses access to those drafts, so keep the same browser/profile. The token is not shown in URLs.

The editor uses **TipTap** for headings, bold/italic/underline, lists, quotes, links, code and images. Article HTML is sanitized server-side with `sanitize-html`; only images served from `/api/news/media/...` are allowed, so pasted external image URLs are stripped.

### Image review

Uploaded images are stored in `news_media` with `status = 'pending'`. They are unlisted but fetchable by their random ID so the author and staff can preview them. An article can be submitted for review with pending images, but it cannot be published until **every attached image and the cover** is approved. Uploads are capped at 4 MB (and larger browser images are compressed client-side) to stay under serverless request-body limits. The moderator desk is a client-side page that asks for `NEWS_MODERATOR_KEY` and sends it as `x-news-moderator-key`; without that env var the endpoint returns `503`.

To use it:

1. Set `NEWS_MODERATOR_KEY` to a long random value in `.env` and in the hosting provider.
2. Open `/news/moderation`, enter the key, approve images, then publish the article.
3. Treat the key like a password. It is not the same as any Discord role; if you later add Discord OAuth, the key can be replaced with a role check.

The original hand-written dispatches are preserved in `src/lib/news-legacy.ts` and appear as an archive on the first newspaper page until database articles replace them.

Categories: `Announcement`, `Market`, `Guide` and `Event`.

### Miraheze instead of the custom newsroom?

Miraheze is a free MediaWiki farm, so it is good at community editing, page history, talk pages and wiki-style moderation. It is a poor drop-in backend for this newsroom if you want the custom writing experience, Discord-native identity and an approval queue:

- **API** — you can create/read pages with the MediaWiki Action API (`/w/api.php`) and REST API, and upload files with `action=upload`. Reads are straightforward; writes need a bot password or OAuth, CSRF tokens and careful error handling.
- **Rich text** — MediaWiki stores wikitext. VisualEditor/Parsoid can round-trip HTML, but it is not a general-purpose HTML editor. Templates, wiki markup and sanitization will leak into the authoring experience.
- **Images** — uploads are generally live as soon as they are uploaded. A “pending until approved” workflow needs the Moderation extension, a draft namespace, page protection or a custom bot workflow. You would still build most of the queue and publish logic yourself.
- **Identity and roles** — “Your articles” would mean Miraheze accounts and OAuth, not the local author token. Moderator rights live in wiki groups, which means a second account system beside Discord.
- **Look and performance** — the custom site would render MediaWiki HTML or fetch page content and restyle it. You lose control of layout, article metadata, canonical URLs and latency; every article view becomes an API/cache problem.
- **Licensing and reliability** — public wiki content is typically CC BY-SA, and Miraheze is volunteer-run with occasional outages and rate limits. Check the current terms before making it the canonical store for your news.

**Recommendation:** keep the custom `news_articles` / `news_media` store as the canonical publishing system. If you want a community wiki, run Miraheze as a separate archive or companion wiki and use a small bot to copy approved articles there with attribution and a canonical link back to `/news/[slug]`. That gives you wiki history without turning wiki markup, OAuth and volunteer uptime into hard dependencies of the newspaper.

---

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server with HMR. |
| `npm run build` | Production build for Cloudflare Workers (`.svelte-kit/cloudflare`). |
| `npm run preview` | Build and preview the Worker locally with `wrangler dev`. |
| `npm run deploy` | Build and deploy the website to Cloudflare Workers. |
| `npm run deploy:bot` | Build and deploy the Discord bot to Cloudflare Containers. |
| `npm run deploy:all` | Deploy the website and the bot. |
| `npm run bot:cloudflare:dev` | Run the bot Worker and container locally (Docker required). |
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
| `NEWS_MODERATOR_KEY` | — | Staff key for `/news/moderation`; required to approve images. |

`.env.local` takes precedence over `.env`. The web app, scripts and bot all load the same files (`src/lib/server/env.ts` uses `process.loadEnvFile`). On Cloudflare, set the website values on the `settlers3` Worker and the bot values on the `settlers3-bot` Worker; both are exposed to the app as `process.env`.

---

## Project layout

```
src/
  lib/
    market.ts              shared catalogue, types, map URL builder
    wiki-market.ts         official shop-feed types, regions and item mapping
    news.ts                news types, categories, date/status and HTML helpers
    news-legacy.ts         the original hand-written dispatches (archive fallback)
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
      news.ts              async newsroom facade (SQLite or Supabase)
      news-core.ts         validation, sanitization, hashing and row mapping
      news-sqlite.ts       local article/media CRUD and moderation
      news-supabase.ts     hosted article/media CRUD and moderation
      news-legacy.ts       archive dispatches adapted to the database shape
      news-http.ts         author-token / moderator-key helpers and JSON errors
      dynmap.ts            live Dynmap player proxy
      env.ts               environment loading + defaults
  routes/
    +page.svelte           dashboard
    market/               full market board
    map/                  embedded live map
    news/                 masthead, recent articles, newspaper, editor, your desk, moderation
    discord/              bot status, commands and alert feed
    api/                  offers, market, history, alerts, server, guilds, stream, news
bot/
  cloudflare.ts            Cloudflare Worker and container class for the bot
  health.ts                HTTP readiness endpoint used by Cloudflare Containers
  index.ts                 Discord client, heartbeat, interactions
  commands.ts              slash commands, autocomplete, cancel button
  applications.ts          /apply DM flow, /initapply guide, #apply cleanup, review
  rules.ts                 /initrule general community rules embed
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
Dockerfile                 Cloudflare Containers image for the Discord bot
wrangler.jsonc             website Worker name, assets and compatibility settings
wrangler.bot.jsonc         bot Worker, container and Cron Trigger settings
tsconfig.bot.json          container-safe TypeScript config for `bot:start`
tsconfig.cloudflare.json   type-check config for the bot Worker
```

### Data model

- `offers` — one row per open/closed offer, with `source` (`web`, `discord`, `seed`) and an `edit_token` returned only to the creator.
- `price_history` — best bid/ask snapshots per item, written whenever an offer changes the book.
- `alerts` — significant-move queue with `posted_at` / `discord_message_id` for reliable delivery.
- `meta` — revision counter (drives SSE), bot heartbeat, alert channel, application state and other small values.
- `news_articles` — one row per dispatch with `status` (`draft`, `pending`, `published`, `rejected`), sanitized `body_html`, author token hash and publication timestamp.
- `news_media` — one row per uploaded image with its base64 payload, MIME type, owning article and approval `status`.

The browser keeps a local profile (`IGN`, guild, contact), per-offer edit tokens and a news author token in `localStorage`. There are no passwords or user accounts.

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
| `/api/news` | `GET`, `POST` | Public feed (`limit`, `cursor`, `full=1`) and article creation. Author mutations need `x-news-author-token`. |
| `/api/news/mine` | `GET` | The author's drafts, pending articles and published pieces. |
| `/api/news/[id]` | `GET`, `PATCH`, `DELETE` | Read/edit/delete a draft owned by the author token. |
| `/api/news/[id]/submit` | `POST` | Send a draft to the moderator queue. |
| `/api/news/media` | `POST` | Upload an image (`multipart/form-data`); starts as `pending`. |
| `/api/news/media/[id]` | `GET` | Serve an image by its unlisted ID. |
| `/api/news/moderation` | `GET`, `POST` | Review queue and approve/reject actions. Needs `x-news-moderator-key`. |

Rate limiting is in-process (`src/lib/server/rate-limit.ts`) and keyed by IP.

---

## Deployment

### Cloudflare Workers (website)

The web app uses `@sveltejs/adapter-cloudflare` and deploys to Workers Static Assets. Workers cannot run `node:sqlite`, so the deployed site must use Supabase; the SQLite backend is still available for local development.

1. Create a Supabase project and apply `supabase/schema.sql` (paste it into the SQL editor, or run `SUPABASE_ACCESS_TOKEN=sbp_... npm run db:push-schema`).
2. Log in and store the production configuration as Worker secrets:

   ```bash
   npx wrangler login
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_SECRET_KEY
   npx wrangler secret put NEWS_MODERATOR_KEY   # optional, enables image moderation
   npx wrangler secret put APP_URL              # e.g. https://settlers3.example.workers.dev
   ```

3. Deploy:

   ```bash
   npm run deploy
   ```

   That runs `vite build` and `wrangler deploy`. The Worker name, compatibility date, static-assets directory and `MARKET_BACKEND=supabase` live in `wrangler.jsonc`.

   To deploy both the website and the Discord bot in one command, run `npm run deploy:all` (Docker must be running for the bot image).

4. Deploy the Discord bot to Cloudflare Containers (see [Deploy the bot to Cloudflare Containers](#deploy-the-bot-to-cloudflare-containers)). It uses the same `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `APP_URL`, but its secrets are stored on the separate `settlers3-bot` Worker.

To deploy the website with Workers Builds instead of the CLI, create a Worker named `settlers3`, set its build command to `npm run build` and its deploy command to `npx wrangler deploy`, then connect this repository on the `main` branch.

To test the production Worker locally:

```bash
npm run preview        # vite build + wrangler dev
```

`wrangler dev` loads `.env` (or `.dev.vars`) automatically, so a Supabase-configured local `.env` is enough. In production, the Worker gets the same values from its secrets and variables.

#### Cloudflare notes

- Live updates (`/api/stream`) poll Supabase every 5 seconds and the client reconnects every 4 minutes. This keeps each Worker invocation under the free plan's 50-subrequest limit.
- Rate limiting is in-memory and therefore per isolate. It is fine for a community market, but not a hard security boundary; add Cloudflare WAF rules if you need stricter limits.
- Uploaded news images are stored as base64 in Postgres (4 MB cap), so no R2 bucket is required.
- The free plan's CPU budget is tight for server-side rendering. If you see CPU-limit errors under real traffic, enable Workers Paid.

### Self-hosted Node (optional)

If you also want a plain Node deployment, install `@sveltejs/adapter-node`, swap the adapter import in `vite.config.ts`, rebuild, and run `node build/index.js`. With Supabase configured, the web app and bot only need the same `SUPABASE_URL` and `SUPABASE_SECRET_KEY`; the revision counter and alert queue live in Postgres, so multiple web instances and the bot stay in sync.

For a SQLite-only deployment, set `MARKET_BACKEND=sqlite`, keep `MARKET_DB_PATH` on shared storage, and run the bot on the same host. SQLite is in WAL mode, so the two processes can read and write concurrently.

`data/` is gitignored. Back up `market.db` (and its `-wal` file while the app is running) if you use the local backend.

---

## Notes & disclaimer

- Prices are set entirely by players. The board does not verify trades or hold items/coins.
- The map iframe points at `https://play.settlers-mc.org/`; deep links use its Dynmap query parameters (`worldname=Caeldun`, `mapname=flat|surface`, `x/y/z/zoom`).
- Item textures are loaded from the public `minecraft-assets` CDN.
- This is a community project and is not affiliated with the server owners or with Blue Byte.
