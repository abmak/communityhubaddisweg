# አዲስ ማዕድ (Addis Maed) API — build from the repository root:
#   docker build -f backend/Dockerfile -t community-hub-api .
FROM node:20-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace backend --include-workspace-root --no-audit --no-fund

COPY backend ./backend
RUN npm run build --workspace backend

FROM node:20-bookworm-slim AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# npm hoists the workspace dependencies to /app/node_modules; there is no
# /app/backend/node_modules layer to copy. Node resolves upward from here.
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/server.js ./server.js
COPY --from=build /app/backend/prisma ./prisma
COPY --from=build /app/backend/dist ./dist

RUN mkdir -p uploads && chown -R node:node /app
USER node

# The Prisma CLI lives in the hoisted workspace bin directory.
ENV PATH=/app/node_modules/.bin:$PATH

EXPOSE 4000
# Migrations run on start for a single-instance deployment. In a multi-replica
# setup, run `prisma migrate deploy` as a release step instead.
CMD ["sh", "-c", "prisma migrate deploy && node server.js"]
