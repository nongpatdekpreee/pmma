# PMMA

โมโนรีโปสำหรับระบบ **วางแผนและติดตามงาน MA/PM** (บำรุงรักษาตามสัญญา) — ฟรอนต์เป็น **Next.js** แบ็กเอนด์เป็น **Express + MySQL** รวมถึงภาพโปรดักชันแบบ **Docker** (nginx + API + UI)

## ความสามารถหลัก (ภาพรวม)

- ทรัพย์สิน / ไซต์ / ผู้ผลิต / บทบาทและประเภทอุปกรณ์
- พนักงานและไฟล์แนบ
- สัญญา (contract), ประวัติต่อสัญญา (renew), อุปกรณ์ผูกสัญญาต่อไซต์ (SLid)
- งาน (tasks), รายงาน PM/MA, ปฏิทินและวันหยุด
- วิเคราะห์ (analytics) และรายงานอื่นตามหน้าแอป

## โครงสร้างโปรเจกต์

```
pmmaddddd/
├── client/                 # Next.js 16 (App Router), React 19
├── backend/                # Express API, MySQL (mysql2 pool)
│   ├── config/             # database.js — โหลดจาก .env
│   ├── controllers/
│   ├── routes/
│   ├── migrations/         # คู่มือ + SQL อัปเกรดสคีมา — อ่าน migrations/README.md
│   └── uploads/            # ไฟล์อัปโหลด (รูปพนักงาน, รายงาน, สัญญา ฯลฯ)
├── Dockerfile              # บิลด์ client standalone + รัน backend + nginx
├── nginx.conf
└── start.sh                # สตาร์ท backend :5000, Next :3000, nginx :80
```

## ความต้องการของระบบ

- **Node.js** 20 LTS (แนะนำให้ตรงกับ Docker image `node:20-alpine`)
- **MySQL** สำหรับข้อมูลจริง (สคีมาตามที่ทีมใช้ / ไฟล์ SQL ที่แจก)

## ตั้งค่าแบ็กเอนด์ (local)

1. สร้างฐานข้อมูลและรัน SQL โดยการ importจาก app_db.sql

2. ในโฟลเดอร์ `backend/` สร้างไฟล์ `.env`:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=ชื่อฐานข้อมูลของคุณ
```

3. ติดตั้งและรัน:

```bash
cd backend
npm install
npm run dev
```

API ตัวอย่าง: `http://192.168.60.114:5000/` จะคืน JSON ชื่อ MA/PM Plan API

เส้นทาง API หลัก (prefix `/api`):

| Prefix | หมายเหตุย่อ |
|--------|----------------|
| `/api/sites` | ไซต์ / locations |
| `/api/manufacturers` | ผู้ผลิต |
| `/api/device-roles`, `/api/device-types` | บทบาท / ประเภทอุปกรณ์ |
| `/api/devices` | อุปกรณ์ |
| `/api/employees` | พนักงาน |
| `/api/contracts` | สัญญา + ประวัติ |
| `/api/tasks` | งาน |
| `/api/pm-reports`, `/api/ma-reports` | รายงาน PM / MA |
| `/api/analytics` | วิเคราะห์ |
| `/api/holidays` | วันหยุด |

ไฟล์สแตติกอัปโหลดให้บริการที่ `/uploads` บนพอร์ตเดียวกับแบ็กเอนด์

## ตั้งค่าฟรอนต์ (local)

1. ในโฟลเดอร์ `client/` ตั้งค่า URL ของ API (แนะนำให้ชี้ไปที่แบ็กเอนด์ local):

```env
# client/.env.local (ตัวอย่าง)
NEXT_PUBLIC_API_URL=http://192.168.60.114:5000
```

ถ้าไม่ตั้งค่า โค้ดอาจ fallback ไปที่ค่าเริ่มต้นใน `client/lib/api.ts` — ควรกำหนด `NEXT_PUBLIC_API_URL` ให้ตรงกับสภาพแวดล้อมของคุณ

2. ติดตั้งและรัน dev:

```bash
cd client
npm install
npm run dev
```

เปิด UI ตามที่ Next แจ้ง (ปกติ `http://localhost:3000`)

3. บิลด์โปรดักชัน:

```bash
cd client
npm run build
npm start
```

## Docker (รวม UI + API)

### Build + push ขึ้น registry

```bash
docker build -t 10.4.102.212:8080/pmma:latest -f dockerfile .
docker push 10.4.102.212:8080/pmma:latest
```

### รันบน server (inventory / tccstock_mysql)

```bash
docker pull 10.4.102.212:8080/pmma:latest
docker rm -f pmma
docker run -d --name pmma \
  --network inventory_default \
  -p 9000:80 \
  --env-file backend/.env \
  -e DB_HOST=tccstock_mysql \
  10.4.102.212:8080/pmma:latest
docker logs pmma --tail 30
```

- ภายใน container: nginx **:80** → `/api` ไป Express **:5000**, `/` ไป Next **:3000**
- จาก container อื่นใน network: ใช้ `http://pmma:80` (ไม่ใช่ `:9000` หรือ `:5000`)
- `DB_HOST` ต้องเป็นชื่อ MySQL container (`tccstock_mysql`) ไม่ใช่ IP host
- ดูตัวอย่าง env: `backend/.env.inventory.example`

### รันทดสอบบนเครื่อง dev (Windows)

```bash
docker build -t pmma:latest -f dockerfile .
docker run -p 9001:80 --env-file backend/.env -e DB_HOST=host.docker.internal pmma:latest
```

- ภายในคอนเทนเนอร์ nginx ฟังพอร์ต **80** — พร็อกซี `/api` และ `/uploads` ไป Express ที่ **5000** และส่งคำขออื่นไป Next standalone ที่ **3000**
- ตอน **build** ใช้ `NEXT_PUBLIC_API_URL=""` (default) เพื่อให้เบราว์เซอร์เรียก API แบบ same-origin

ตัวแปร `DB_*` และ `PORT` ของแบ็กเอนด์ต้องมีให้คอนเทนเนอร์เชื่อม MySQL ได้ (เช่น `--env-file` หรือ `-e`)

## เทคโนโลยีหลัก

| ส่วน | เทคโนโลยี |
|------|------------|
| UI | Next.js 16, React 19, Tailwind CSS 4 |
| API | Express 4, mysql2, multer, dotenv |
| DB | MySQL |
| รวมภาพ | nginx + Node (สคริปต์ `start.sh`) |

## License

ISC (ตาม `package.json` ของโมดูลในรีโป — ปรับได้ตามนโยบายองค์กร)
