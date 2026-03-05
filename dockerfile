# =============================================
# Build (default = frontend):  docker build -t pmma-plan .
# Backend only:               docker build --target backend -t pmma-plan .
# Frontend only:              docker build --target frontend -t pmma-plan .
# =============================================

# -----------------------------------------------------------------------------
# Backend (Node 18 slim = smaller image)
# -----------------------------------------------------------------------------
FROM node:18-slim AS backend
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ .
EXPOSE 5000
ENV PORT=5000
CMD ["npm", "start"]

FROM node:20-slim AS frontend
WORKDIR /app
COPY client/package*.json ./
RUN npm install
COPY client/ .
EXPOSE 9000
ENV PORT=9000
CMD ["npm", "run", "dev"]
