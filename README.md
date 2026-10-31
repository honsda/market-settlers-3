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
- **Newsroom & newspaper** — a standalone `/news` area with recent articles, a personal “Your articles” desk, a rich-text authoring page, moderator image review, and an endless dated newspaper feed at `/news/paper`.
- **Discord bot** — `/price`, `/market`, `/offers`, `/player`, `/post` and `/alerts` slash commands, plus automatic alerts when a best bid or ask moves past a threshold or prints a new 7-day extreme. It also posts a batched market pulse and significant shop-price moves from the official feed, with the island/area and region named.
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

### Deploy the bot

The bot is a long-running gateway worker: it keeps a WebSocket connection to Discord and does not listen on a port. It needs **Node.js 22.13+** (Node 24 recommended) and **Supabase** — free bot panels use ephemeral storage, so SQLite would reset on every restart.

#### Wispbyte (free, no card)

Wispbyte's free plan gives 512 MB RAM and 1 GB disk, runs 24/7, and does not ask for a payment method. Log into the panel every couple of weeks to keep the server active.

1. **Create a server** and choose the **Node.js 22** Docker image (Node.js 24 also works).
2. Open **Files** and either connect this GitHub repository (`honsda/market-settlers-3`, branch `main`) or upload the project. With GitHub, enable **Auto Update** if you want restarts to pull the latest commit.
3. Open **Startup** and replace the startup command with:

   ```bash
   cd /home/container; if [[ -d .git ]] && [[ ${AUTO_UPDATE:-0} == "1" ]]; then git pull; fi; mkdir -p data; if [ -f package.json ]; then /usr/local/bin/npm install --omit=dev --no-audit --no-fund; fi; exec /home/container/node_modules/.bin/tsx --tsconfig tsconfig.bot.json bot/index.ts
   ```

   If the panel asks for a main/startup file, point it at `bot/index.ts` (or use **Use on startup** on that file). The command above is what actually runs the bot.

4. Add the environment variables below under **Startup → Environment Variables**.
5. Start the server. The console should show `Signed in as ...`; the bot registers its slash commands and creates `Dweller` and `#staff-verify` if they are missing.

The startup command installs production dependencies (including `tsx`) on boot and runs the bot directly, so there is no build step. `tsconfig.bot.json` is used because the generated SvelteKit tsconfig is not present on the panel.

If the Node image is older than 22.13, choose a newer one — `node:sqlite` is imported even when Supabase is the backend.

If the console says `Missing main file`, set the startup/main file to `bot/index.ts` (or use **Use on startup** on it). If `npm install` fails with `EACCES ... /home/container/node_modules`, delete `node_modules` and `.npm` in **Files**, restart, and if it still fails ask Wispbyte support to check the volume ownership. The bot also needs the panel login every couple of weeks; otherwise the free server may be paused.

#### Northflank / container hosts

The repo also ships a `Dockerfile` for hosts that build containers. The bot is a **worker**, not a website: it holds a Discord gateway connection and does not listen on a port.

1. Northflank → **Create service** → **Build from Git** → connect `honsda/market-settlers-3` on `main`.
2. Build type: **Dockerfile** (auto-detected at the repository root).
3. Service type: **Worker**. Do not expose or health-check a port.
4. Instance: the free **Sandbox** plan is enough (the bot idles around 100–200 MB).
5. Add the environment variables below, then deploy. On the first boot the bot registers its slash commands and creates the `Dweller` role and `#staff-verify` channel.

The image runs `npm run bot:start` (`tsx --tsconfig tsconfig.bot.json bot/index.ts`). `tsx` is a runtime dependency, so `npm ci --omit=dev` is enough.

#### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DISCORD_TOKEN` | yes | Bot token from the Developer Portal. |
| `DISCORD_CLIENT_ID` | yes | Application ID, used for command registration and the invite link. |
| `DISCORD_GUILD_ID` | recommended | Makes new slash commands appear instantly. |
| `APP_URL` | yes | Your Vercel URL, used in Discord links. |
| `SUPABASE_URL` | yes | Shared database with the Vercel deployment. |
| `SUPABASE_SECRET_KEY` | yes | Server-side key; never expose it to the browser. |
| `NEWS_MODERATOR_KEY` | recommended | Staff key for `/news/moderation`; without it image review is disabled. |
| `DISCORD_ALERT_CHANNEL_ID` | optional | Can also be set later with `/alerts`. |
| `ALERT_*`, `WIKI_MARKET_*` | optional | Tuning values described in `.env.example`. |

Do **not** set `MARKET_BACKEND=sqlite` on either host — the panel/container filesystem is ephemeral and the web app on Vercel cannot share it. With Supabase configured the bot is stateless and restarts safely.

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
- uses one Discord field per item + area, with volume, average, gold traded and current best shop prices, so updates stay readable without losing detail;
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

Uploaded images are stored in `news_media` with `status = 'pending'`. They are unlisted but fetchable by their random ID so the author and staff can preview them. An article can be submitted for review with pending images, but it cannot be published until **every attached image and the cover** is approved. Uploads are capped at 4 MB (and larger browser images are compressed client-side) to stay under Vercel's serverless request-body limit. The moderator desk is a client-side page that asks for `NEWS_MODERATOR_KEY` and sends it as `x-news-moderator-key`; without that env var the endpoint returns `503`.

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
| `NEWS_MODERATOR_KEY` | — | Staff key for `/news/moderation`; required to approve images. |

`.env.local` takes precedence over `.env`. The web app, scripts and bot all load the same files (`src/lib/server/env.ts` uses `process.loadEnvFile`).

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
Dockerfile                 production image for the Discord bot (container hosts)
tsconfig.bot.json          container-safe TypeScript config for `bot:start`
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

The project uses `@sveltejs/adapter-node`, so `npm run build` produces a self-contained Node server:

```bash
npm ci
npm run build
APP_URL=https://market.example.com PORT=3000 node build/index.js
```

Run the bot as a second process with `npm run bot:start`. With Supabase configured, both processes only need the same `SUPABASE_URL` and `SUPABASE_SECRET_KEY`; there is no shared volume to manage. The revision counter and alert queue live in Postgres, so multiple web instances and the bot stay in sync. Set `NEWS_MODERATOR_KEY` on the web host or the newsroom cannot approve images.

For a SQLite-only deployment, set `MARKET_BACKEND=sqlite`, keep `MARKET_DB_PATH` on shared storage, and run the bot on the same host. SQLite is in WAL mode, so the two processes can read and write concurrently.

`data/` is gitignored. Back up `market.db` (and its `-wal` file while the app is running) if you use the local backend.

---

## Notes & disclaimer

- Prices are set entirely by players. The board does not verify trades or hold items/coins.
- The map iframe points at `https://play.settlers-mc.org/`; deep links use its Dynmap query parameters (`worldname=Caeldun`, `mapname=flat|surface`, `x/y/z/zoom`).
- Item textures are loaded from the public `minecraft-assets` CDN.
- This is a community project and is not affiliated with the server owners or with Blue Byte.
