# Combined: Next.js (standalone) + Express backend + nginx reverse proxy
# Build from repo root: docker build -t pmma-combined -f Dockerfile .

# ----- Stage 1: Frontend dependencies -----
FROM node:20-alpine AS frontend-deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY client/package.json client/package-lock.json* ./
RUN npm ci

# ----- Stage 2: Backend dependencies -----
FROM node:20-alpine AS backend-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

# ----- Stage 3: Build frontend (Next.js standalone) -----
FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY --from=frontend-deps /app/node_modules ./node_modules
COPY client/ .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Baked into client bundle: "" = same-origin /api via nginx
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# หน้า login บน host (พอร์ต 80) — ถ้ายังไม่มี currentUser ใน localStorage จะ redirect ไปที่นี่ก่อนเข้า :9000
ARG NEXT_PUBLIC_LOGIN_URL=http://10.4.102.212/
ENV NEXT_PUBLIC_LOGIN_URL=${NEXT_PUBLIC_LOGIN_URL}

# ตั้งเป็น true ถ้า dev บนเครื่องแล้วไม่ต้องการบังคับไป login
ARG NEXT_PUBLIC_AUTH_DISABLED=false
ENV NEXT_PUBLIC_AUTH_DISABLED=${NEXT_PUBLIC_AUTH_DISABLED}

RUN npm run build

# ----- Stage 4: Final runner -----
FROM node:20-alpine AS runner

RUN apk add --no-cache nginx

WORKDIR /app

# ---- Backend ----
COPY --from=backend-deps /app/node_modules ./backend/node_modules
COPY backend/server.js ./backend/
COPY backend/config ./backend/config
COPY backend/controllers ./backend/controllers
COPY backend/routes ./backend/routes
RUN mkdir -p /app/backend/uploads

# ---- Frontend (Next.js standalone) ----
COPY --from=frontend-builder /app/.next/standalone ./frontend/
COPY --from=frontend-builder /app/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/public ./frontend/public

# ---- Nginx + startup ----
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /app/start.sh
# Windows CRLF makes Linux report "start.sh: not found" when exec'd
RUN sed -i 's/\r$//' /etc/nginx/nginx.conf /app/start.sh && chmod +x /app/start.sh

RUN mkdir -p /var/log/nginx /tmp

ENV NODE_ENV=production

EXPOSE 80

CMD ["/app/start.sh"]
