# syntax=docker/dockerfile:1
#
# Two images from one file (build from the repository root, see compose.yaml):
#   web     the Next.js app: small, runs as a non-root user, reads the database (it writes only to repair a write the listener was killed in)
#   worker  the scripts that build and update the database: ingest, EDDN listener, db tools
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
# glibc (bookworm), not Alpine: better-sqlite3 and zeromq ship prebuilt binaries for it, so no compiler is needed.
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# All dependencies, from the lockfile exactly. Install scripts are skipped on purpose: the lockfile cannot say that better-sqlite3 ships its
# own binaries and must not be compiled, so npm tries to build it (and fails: there is no Python or compiler here). The native modules
# (better-sqlite3, zeromq) load their prebuilt binaries at run time, which is checked by the first start of the stack.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS build
COPY . .
# "standalone" copies only the files the server needs into .next/standalone (see next.config.ts).
ENV NEXT_OUTPUT=standalone
RUN npm run build

# ---- web ----
FROM base AS web
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 MERITFINDER_DB=/data/meritfinder.sqlite
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server.js"]

# ---- worker ----
FROM deps AS worker
ENV NODE_ENV=production MERITFINDER_DB=/data/meritfinder.sqlite
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
# The data folder is a volume: made here, owned by the app's user, so the volume starts out writable by it.
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
CMD ["node_modules/.bin/tsx", "scripts/eddn-listener.ts"]
