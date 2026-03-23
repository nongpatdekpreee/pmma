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
 
# ----- Stage 3: Build frontend (Next.js) -----
FROM node:20-alpine AS frontend-builder
WORKDIR /app
 
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY client/ .
 
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
 
# Build-time env vars (baked into client bundle)
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_NETBOX_BASE_URL=http://10.4.102.212:9000
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_NETBOX_BASE_URL=${NEXT_PUBLIC_NETBOX_BASE_URL}
 
RUN npm run build
 
# ----- Stage 4: Final runner -----
FROM node:20-alpine AS runner
 
RUN apk add --no-cache nginx
 
WORKDIR /app