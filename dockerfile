# Combined: Next.js + Express + nginx (single container, port 80)
# Build from repo root:
#   docker build -t pmma:latest -f dockerfile .
#   docker run -p 9000:80 --env-file backend/.env pmma:latest

FROM node:20-alpine AS frontend-deps

RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY client/package.json client/package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS backend-deps

RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-alpine AS frontend-builder

WORKDIR /app
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY client/ .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# "" = browser calls same-origin /api via nginx
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

ARG API_PROXY_TARGET=http://127.0.0.1:5000
ENV API_PROXY_TARGET=${API_PROXY_TARGET}

RUN npm run build

FROM node:20-alpine AS runner

RUN apk add --no-cache nginx

WORKDIR /app

COPY --from=backend-deps /app/node_modules ./backend/node_modules
COPY backend/ ./backend/
RUN test -f ./backend/services/tokenService.js \
  && test -f ./backend/middleware/authMiddleware.js \
  && mkdir -p /app/backend/uploads

COPY --from=frontend-builder /app/.next/standalone ./frontend/
COPY --from=frontend-builder /app/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/public ./frontend/public

COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /app/start.sh
RUN sed -i 's/\r$//' /etc/nginx/nginx.conf /app/start.sh \
  && chmod +x /app/start.sh \
  && mkdir -p /var/log/nginx /tmp

ENV NODE_ENV=production

EXPOSE 80

CMD ["/app/start.sh"]
