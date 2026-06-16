'use client';

import Link from 'next/link';
import { MA_WORK_ORDER_SAMPLE } from '@/lib/maWorkOrder';
import { MaWorkOrderDocument } from '@/components/ma-work-order';

/**
 * หน้าออกแบบ layout ฟอร์ม TCC — เปิด /dev/ma-work-order-preview
 * ใช้ตรวจสอบก่อน wire PDF export
 */
export default function MaWorkOrderPreviewPage() {
  return (
    <div className="min-h-screen bg-muted">
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">
              MA Work Order — Layout Preview
            </h1>
            <p className="text-xs text-muted-foreground">
              ตัวอย่างฟอร์ม 2 หน้า (ข้อมูล sample) — ขั้นถัดไป: ปุ่ม Download PDF
            </p>
          </div>
          <Link
            href="/calendar"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            กลับ Calendar
          </Link>
        </div>
      </div>

      <MaWorkOrderDocument data={MA_WORK_ORDER_SAMPLE} withPreviewShell />
    </div>
  );
}
