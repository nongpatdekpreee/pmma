# แก้ `docker push` → `error from registry: unknown error`

ข้อความนี้มาจาก **ฝั่ง registry** (เช่น Harbor บน `10.4.102.212:8080`) ไม่ใช่จาก Docker client โดยตรง

## สิ่งที่ควรเช็ค

1. **ล็อกอิน**
   ```bash
   docker login 10.4.102.212:8080
   ```

2. **พื้นที่ดิสก์บนเซิร์ฟเวอร์ registry** — เต็มแล้ว push มักล้มแบบ generic error

3. **สิทธิ์ project/repository** — user ที่ login ต้องมีสิทธิ์ push ไปที่ `pmma`

4. **ดู log บน registry** (Harbor: Administration / Logs หรือ log ของ container registry)

5. **ลอง push layer ใหม่** — บางครั้ง layer ค้าง (`Waiting` แล้ว error):
   ```bash
   docker push 10.4.102.212:8080/pmma:latest
   ```
   หรือ tag เป็นเวอร์ชันใหม่แล้ว push:
   ```bash
   docker tag 10.4.102.212:8080/pmma:latest 10.4.102.212:8080/pmma:v20250323
   docker push 10.4.102.212:8080/pmma:v20250323
   ```

6. **เครือข่าย / proxy / TLS** — ถ้า registry ใช้ HTTPS ผิด cert อาจต้องตั้ง `insecure-registries` (ไม่แนะนำ production) หรือแก้ cert

## ถ้า push ไม่ได้ชั่วคราว

รัน image จากเครื่องที่ build แล้วโดยตรงบน server (ไม่ผ่าน push):

```bash
docker save 10.4.102.212:8080/pmma:latest | ssh user@server docker load
```

แล้ว `docker compose up -d` บน server
