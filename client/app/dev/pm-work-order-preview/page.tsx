'use client';

import Link from 'next/link';
import { PM_WORK_ORDER_SAMPLE } from '@/lib/pmWorkOrder/sampleData';
import { PmWorkOrderDocument } from '@/components/pm-work-order';

/**
 * หน้าออกแบบ layout ฟอร์ม PM TCC — เปิด /dev/pm-work-order-preview
 */
export default function PmWorkOrderPreviewPage() {
  return (
    <div className="min-h-screen bg-muted">
      <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-foreground">
              PM Work Order — Layout Preview
            </h1>
            <p className="text-xs text-muted-foreground">
              ตัวอย่างฟอร์ม inspection + maintenance checklist (ข้อมูล sample)
            </p>
          </div>
          <Link
            href="/pmchecklist_report/add"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            PM Report
          </Link>
        </div>
      </div>

      <PmWorkOrderDocument data={PM_WORK_ORDER_SAMPLE} withPreviewShell />
    </div>
  );
}
