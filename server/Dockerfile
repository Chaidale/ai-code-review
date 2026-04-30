FROM alpine:3.21 AS release-meta

RUN apk add --no-cache git

WORKDIR /repo

COPY .git ./.git

RUN GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || true)" && \
  if [ -n "$GIT_SHA" ]; then \
    printf "ai-code-review@%s" "$GIT_SHA" > /release.txt; \
  else \
    : > /release.txt; \
  fi

FROM node:22-alpine

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY server/. .
COPY --from=release-meta /release.txt ./.sentry-release

EXPOSE 3001

ENV NODE_ENV=production
CMD ["node", "--import", "./start.js", "index.js"]
