# Settlers III Discord bot
#
# Long-running gateway bot image for any always-on container host (Render,
# Fly.io, a VPS, or Docker on your own machine). The free Cloudflare Worker
# deployment uses bot/worker.ts instead and does not need this image.
#
# Render's free plan sleeps a web service after ~15 minutes without inbound
# traffic, which drops the gateway connection. Keep it awake with a five-minute
# ping; see README → Deploy the bot to Render (free).
#
#   docker build -t anreu .
#   docker run -p 3000:3000 --env-file .env anreu

FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    BOT_HEALTH_PORT=3000

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.bot.json ./
COPY bot ./bot
COPY src/lib ./src/lib

# The bot only writes here when it falls back to SQLite. With Supabase
# configured (recommended when the web app runs on Cloudflare) it stays stateless.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "run", "bot:start"]
