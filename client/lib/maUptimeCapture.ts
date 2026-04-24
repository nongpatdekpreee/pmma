/**
 * MA: ตอนกด Done บน Calendar/Schedule — ส่งคู่นี้ไป backend
 * ใช้เวลาท้องถิ่นของเบราว์เซอร์ (ไม่ใช่เวลาเครื่อง server) เพื่อให้ตรงกับชั่วโมงที่ผู้ใช้เห็น
 */
export function getMaUptimeLocalForDoneCapture(at: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    maUptimeLocalDate: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    maUptimeLocalTime: `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`,
  };
}
