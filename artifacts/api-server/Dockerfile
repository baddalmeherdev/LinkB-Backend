# ============================================================
# Stage 1 — Builder
# Installs all workspace deps and compiles the server bundle.
# Build context must be the repository root, e.g.:
#   docker build -f artifacts/api-server/Dockerfile .
# On Render.com: leave Root Directory blank and set
#   Dockerfile Path → artifacts/api-server/Dockerfile
# ============================================================
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm (same major as the workspace lock-file)
RUN npm install -g pnpm@9

WORKDIR /app

# ── Copy workspace manifests first so dependency layers cache well ──
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml \
     tsconfig.base.json tsconfig.json ./

COPY lib/db/package.json            lib/db/package.json
COPY lib/api-zod/package.json       lib/api-zod/package.json
COPY lib/api-spec/package.json      lib/api-spec/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json

# Install all workspace dependencies (no network resolution — uses lock-file)
RUN pnpm install --frozen-lockfile

# ── Copy source and build ──
COPY lib/                  lib/
COPY artifacts/api-server/ artifacts/api-server/

# esbuild bundles src → artifacts/api-server/dist/index.cjs
RUN pnpm --filter @workspace/api-server build


# ============================================================
# Stage 2 — Runtime
# Lean image: only the compiled bundle + runtime system tools.
# ============================================================
FROM node:20-slim

# ── System runtime deps ──────────────────────────────────────
# ffmpeg  — video/audio processing
# python3 — required by yt-dlp
# yt-dlp  — downloaded as a self-contained binary (no pip needed)
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        curl \
        ca-certificates \
    && curl -L \
        https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
        -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled bundle from the builder stage.
# esbuild bundles workspace packages and most npm deps into index.cjs.
# The workspace-root node_modules are copied to satisfy the few deps
# that esbuild intentionally left external (e.g. drizzle-orm,
# cookie-parser) — these are required at runtime.
COPY --from=builder /app/node_modules                     ./node_modules
COPY --from=builder /app/artifacts/api-server/dist        ./dist

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "dist/index.cjs"]
