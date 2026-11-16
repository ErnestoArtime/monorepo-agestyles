FROM node:24-bookworm-slim AS builder
WORKDIR /workspace
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @agestyles/storefront-web build

FROM node:24-bookworm-slim AS runner
WORKDIR /workspace
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /workspace/apps/storefront-web/.next/standalone ./
COPY --from=builder /workspace/apps/storefront-web/.next/static ./apps/storefront-web/.next/static
COPY --from=builder /workspace/apps/storefront-web/public ./apps/storefront-web/public
EXPOSE 3000
CMD ["node", "apps/storefront-web/server.js"]
