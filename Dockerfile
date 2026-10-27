# Settlers III Discord bot
#
# Long-running worker image for Northflank (or any container host). The bot
# needs a persistent gateway connection, so do not deploy it as a web service.
#
#   docker build -t settlers3-bot .
#   docker run --env-file .env settlers3-bot

FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.bot.json ./
COPY bot ./bot
COPY src/lib ./src/lib

# The bot only writes here when it falls back to SQLite. With Supabase
# configured (recommended when the web app runs on Vercel) it stays stateless.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

CMD ["npm", "run", "bot:start"]
