# KHARIS & ALETHEIA — production image (Next.js 16 App Router, standalone output)
# Multi-stage build: deps -> builder -> runner. See CONTRACT-NEXT.md "Docker".

# ---------- deps: install once, reused by the build stage ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder: compile the Next.js app ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are baked in at build time (Next.js inlines them into the
# client bundle) — pass them as build args so `docker compose build` can override
# the defaults baked into lib/config.ts. All optional; sane fallbacks apply.
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_FORM_ENDPOINT
ARG NEXT_PUBLIC_PAYMENT_PROVIDER
ARG NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_CONTACT_EMAIL=${NEXT_PUBLIC_CONTACT_EMAIL} \
    NEXT_PUBLIC_FORM_ENDPOINT=${NEXT_PUBLIC_FORM_ENDPOINT} \
    NEXT_PUBLIC_PAYMENT_PROVIDER=${NEXT_PUBLIC_PAYMENT_PROVIDER} \
    NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=${NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN npm run build

# ---------- runner: minimal runtime image ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# non-root user (node:22-alpine already ships a `node` user/group, uid/gid 1000)
RUN mkdir -p /app/.next && chown -R node:node /app

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
