# TCC Stock Management Backend

Backend API สำหรับระบบจัดการสต็อกสินค้า พัฒนาด้วย Node.js และ Express.js

## 🚀 เริ่มต้นใช้งาน

### ติดตั้ง Dependencies

```bash
npm install
```

### ตั้งค่า Database

1. เปิด MySQL และสร้าง Database:
```bash
mysql -u root -p
```

2. รันไฟล์ SQL เพื่อสร้างตารางและข้อมูลตัวอย่าง:
```bash
mysql -u root < database.sql
```

หรือ copy SQL จากไฟล์ `database.sql` ไปรันใน MySQL Workbench

### รัน Server

```bash
# รันแบบปกติ
npm start

# รันแบบ development (auto-reload)
npm run dev
```

Server จะทำงานที่: `http://192.168.60.114:5000`

## 📁 โครงสร้างโปรเจค

```
Backend/
├── config/
│   └── database.js          # การเชื่อมต่อ Database
├── controllers/
│   ├── productController.js # Logic สำหรับ Products
│   └── categoryController.js # Logic สำหรับ Categories
├── routes/
│   ├── productRoutes.js     # Routes สำหรับ Products
│   └── categoryRoutes.js    # Routes สำหรับ Categories
├── .env                     # ตั้งค่า Environment
├── .gitignore
├── server.js               # Entry point
├── package.json
├── database.sql            # SQL Schema และข้อมูลตัวอย่าง
└── README.md
```

## 🔌 API Endpoints

### Products API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/products` | ดึงสินค้าทั้งหมด |
| GET    | `/api/products/:id` | ดึงสินค้าตาม ID |
| POST   | `/api/products` | สร้างสินค้าใหม่ |
| PUT    | `/api/products/:id` | อัพเดทสินค้า |
| DELETE | `/api/products/:id` | ลบสินค้า |

### Categories API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/categories` | ดึงหมวดหมู่ทั้งหมด |
| GET    | `/api/categories/:id` | ดึงหมวดหมู่ตาม ID |
| POST   | `/api/categories` | สร้างหมวดหมู่ใหม่ |
| PUT    | `/api/categories/:id` | อัพเดทหมวดหมู่ |
| DELETE | `/api/categories/:id` | ลบหมวดหมู่ |

## 📝 ตัวอย่างการใช้งาน API

### สร้างสินค้าใหม่ (POST)

```json
POST http://192.168.60.114:5000/api/products
Content-Type: application/json

{
  "name": "iPhone 15",
  "description": "สมาร์ทโฟนรุ่นใหม่ล่าสุด",
  "price": 35000,
  "quantity": 100,
  "category_id": 1
}
```

### อัพเดทสินค้า (PUT)

```json
PUT http://192.168.60.114:5000/api/products/1
Content-Type: application/json

{
  "name": "Samsung Galaxy S24",
  "description": "อัพเดทรุ่นใหม่",
  "price": 28000,
  "quantity": 75,
  "category_id": 1
}
```

### ดึงข้อมูลสินค้าทั้งหมด (GET)

```
GET http://192.168.60.114:5000/api/products
```

### ลบสินค้า (DELETE)

```
DELETE http://192.168.60.114:5000/api/products/1
```

## ⚙️ การตั้งค่า Environment (.env)

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=app_db
```

## 🛠️ เทคโนโลยีที่ใช้

- **Node.js** - Runtime Environment
- **Express.js** - Web Framework
- **MySQL2** - Database Driver
- **dotenv** - Environment Variables
- **CORS** - Cross-Origin Resource Sharing
- **Body-Parser** - Request Body Parser

## 📦 Database Schema

### Table: categories
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- name (VARCHAR)
- description (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### Table: products
- id (INT, PRIMARY KEY, AUTO_INCREMENT)
- name (VARCHAR)
- description (TEXT)
- price (DECIMAL)
- quantity (INT)
- category_id (INT, FOREIGN KEY)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

## 📄 License

ISC














