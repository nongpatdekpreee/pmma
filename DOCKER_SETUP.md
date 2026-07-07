# Docker Setup for PMMA Application

This setup allows you to build and run both Backend (Node.js/Express) and Frontend (Next.js) services in Docker.

## Structure

- **backend/Dockerfile** - Backend API service (Express on port 5000)
- **client/Dockerfile** - Frontend service (Next.js on port 3000)
- **docker-compose.yml** - Orchestrates all services (backend, frontend, nginx, MySQL)
- **nginx.conf** - Reverse proxy configuration

## Services Included

1. **Backend** - Express API on port 5000
2. **Frontend** - Next.js on port 3000
3. **Nginx** - Reverse proxy on port 80
4. **MySQL** - Database on port 3306

## Quick Start

### Option A — Full stack (recommended)

```bash
# จาก root โปรเจกต์ — backend + frontend + nginx + MySQL
docker compose up -d --build
```

เปิด **http://localhost** (nginx port 80)

### Option B — Single combined image

```bash
docker build -f dockerfile -t pmma .
docker run -p 80:80 --env-file backend/.env pmma
```

### Option C — Build images แยก

```bash
docker build -f backend/Dockerfile -t pmma-backend .
docker build -f client/Dockerfile -t pmma-frontend \
  --build-arg NEXT_PUBLIC_API_URL="" \
  --build-arg API_PROXY_TARGET=http://backend:5000 .
```

### คำสั่งเพิ่มเติม

```bash
docker compose build          # build อย่างเดียว
docker compose down           # หยุดทุก service
docker compose logs -f        # ดู log ทั้งหมด
docker compose logs -f backend
```

## Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://192.168.60.114:5000
- **Nginx (All traffic)**: http://localhost
- **MySQL**: localhost:3306

## Environment Variables

Update environment variables in `docker-compose.yml`:

```yaml
environment:
  DB_HOST: mysql
  DB_PORT: 3306
  DB_USER: app_user
  DB_PASSWORD: app_password
  DB_NAME: app_db
  # Frontend build arg — ใช้ "" เมื่อเข้าผ่าน nginx (same-origin /api)
  NEXT_PUBLIC_API_URL: ""
```

## Database Initialization

The MySQL service will automatically initialize with `database.sql` if it exists.

## Troubleshooting

### 502 Bad Gateway
- Check if backend is running: `docker-compose logs backend`
- Ensure backend port 5000 is accessible

### Frontend not loading
- Check frontend logs: `docker-compose logs frontend`
- Verify `NEXT_PUBLIC_API_URL` is set correctly

### Database connection issues
- Wait for MySQL to fully start: `docker-compose logs mysql`
- Check database credentials in `.env` or `docker-compose.yml`

## Rebuild Services

```bash
# Rebuild backend
docker-compose build backend

# Rebuild frontend
docker-compose build frontend

# Rebuild specific service and restart
docker-compose up -d --build backend
```

## Health Checks

All services have health checks configured:

```bash
# Check service status
docker-compose ps

# View health status
docker ps --format "table {{.Names}}\t{{.Status}}"
```

## Production Deployment

For production, update:

1. Database credentials in `docker-compose.yml`
2. Frontend environment variables for correct API URL
3. Add `.env` file or use environment-specific compose files
4. Consider using Docker registries for image storage

## Multiple Environment Configs

Create environment-specific compose files:

```bash
# Development
docker-compose -f docker-compose.yml up

# Production
docker-compose -f docker-compose.prod.yml up
```
