
FROM node:20-alpine AS backend-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM node:20-alpine AS backend
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

# Copy dependencies
COPY --from=backend-deps /app/node_modules ./node_modules

# Copy application code
COPY server.js ./
COPY config ./config
COPY controllers ./controllers
COPY routes ./routes

# Change ownership to non-root user
RUN chown -R nodeuser:nodejs /app

USER nodeuser

EXPOSE 5000

CMD ["node", "server.js"]

