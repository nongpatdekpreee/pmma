# บังคับ login ก่อนเข้าแอป (พอร์ต 9000)

แอปจะตรวจ `localStorage` key **`currentUser`** (เดียวกับที่ใช้ตอน Logout)

- ถ้า **ยังไม่มี** → redirect ไป `NEXT_PUBLIC_LOGIN_URL` (ค่าเริ่มต้น `http://10.4.102.212/`) พร้อม query  
  **`returnUrl=<url ที่จะกลับมา>`** เช่น `http://10.4.102.212:9000/...`
- หลัง login สำเร็จ ระบบ login ควร **redirect กลับมาที่ `returnUrl`** และแนะนำให้แนบ  
  **`?currentUser=...`** (ค่าเดียวกับที่ส่งตอน logout) เพื่อให้แอปบันทึกลง `localStorage` แล้วเข้าใช้งานได้

## ตัวแปร (bake ตอน `npm run build` / Docker build)

| ตัวแปร | ความหมาย |
|--------|-----------|
| `NEXT_PUBLIC_LOGIN_URL` | URL หน้า login (พอร์ต 80) |
| `NEXT_PUBLIC_LOGIN_RETURN_PARAM` | ชื่อ query สำหรับ URL กลับ (default: `returnUrl`) |
| `NEXT_PUBLIC_AUTH_DISABLED` | ตั้ง `true` เวลา dev บนเครื่อง ไม่ให้ redirect |

Docker build ตัวอย่าง:

```bash
docker build --build-arg NEXT_PUBLIC_LOGIN_URL=http://10.4.102.212/ -t pmma-combined -f Dockerfile .
```

## หมายเหตุ

ถ้าระบบ login ของคุณใช้ชื่อพารามิเตอร์อื่น (เช่น `redirect_uri`) ให้ตั้ง `NEXT_PUBLIC_LOGIN_RETURN_PARAM` ให้ตรง
