# Едно изображение за сайта и игровия сървъра (различна команда в docker-compose)
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/game/package.json apps/game/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate --schema packages/db/prisma/schema.prisma
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace @belmaster/web

FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app /app
EXPOSE 3000 4000
CMD ["npm", "run", "start", "--workspace", "@belmaster/web"]
