FROM node:26.13.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-fund
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
COPY scripts/package-core-runtime.mjs ./scripts/package-core-runtime.mjs
RUN npm run build && npm prune --omit=dev --omit=optional --ignore-scripts \
    && node scripts/package-core-runtime.mjs

FROM alpine:3.24@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a AS runtime
# Use Alpine's dynamically linked Node so apk updates the OpenSSL used at runtime.
RUN apk upgrade --no-cache \
    && apk add --no-cache 'nodejs-current~26' 'nodejs-current>=26.13.0-r0' \
        'libssl3>=3.5.10-r0' 'libcrypto3>=3.5.10-r0' 'zlib>=1.4-r0' ca-certificates icu-data-full \
    && node -e "const libs = process.report.getReport().sharedObjects; if (!['/usr/lib/libssl.so.3', '/usr/lib/libcrypto.so.3'].every(p => libs.includes(p))) process.exit(1)" \
    && addgroup -g 1000 node \
    && adduser -D -u 1000 -G node node \
    && ln -s /usr/bin/node /usr/local/bin/node
COPY --from=build /usr/local/bin/docker-entrypoint.sh /usr/local/bin/
ENTRYPOINT ["docker-entrypoint.sh"]
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
