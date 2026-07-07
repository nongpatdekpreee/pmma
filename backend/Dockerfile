# Backend API — build from repo root:
#   docker build -f backend/Dockerfile -t pmma-backend .
FROM node:20-alpine AS deps

RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY --from=deps /app/node_modules ./node_modules
COPY backend/ ./

RUN mkdir -p uploads \
  && sed -i 's/\r$//' docker-entrypoint.sh \
  && chmod +x docker-entrypoint.sh

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:5000/',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
