# build stage
FROM node:20-slim AS builder

WORKDIR /app
COPY client/package*.json ./
RUN npm install

COPY client/ .
RUN npm run build

# serve stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]