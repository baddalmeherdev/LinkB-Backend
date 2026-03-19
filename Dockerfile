FROM node:20-bullseye

RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        python3 \
        python3-pip \
    && pip3 install yt-dlp \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@9

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml \
     tsconfig.base.json tsconfig.json ./

COPY lib/db/package.json               lib/db/package.json
COPY lib/api-zod/package.json          lib/api-zod/package.json
COPY lib/api-spec/package.json         lib/api-spec/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json

RUN pnpm install

COPY lib/                  lib/
COPY artifacts/api-server/ artifacts/api-server/

RUN pnpm --filter @workspace/api-server build

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "artifacts/api-server/dist/index.cjs"]
