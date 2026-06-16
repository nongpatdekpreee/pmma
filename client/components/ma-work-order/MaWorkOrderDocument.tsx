'use client';

import type { MaWorkOrderData } from '@/lib/maWorkOrder';
import './ma-work-order.css';
import { MaWorkOrderPage1 } from './MaWorkOrderPage1';
import { MaWorkOrderPage2 } from './MaWorkOrderPage2';

export type MaWorkOrderDocumentProps = {
  data: MaWorkOrderData;
  /** ห่อด้วยพื้นหลังเทาเหมือน preview — ปิดเมื่อจะ print */
  withPreviewShell?: boolean;
  className?: string;
};

/**
 * คอมโพเนนต์หลักของฟอร์ม 2 หน้า
 * ใช้ preview ใน browser ก่อน — ภายหลังส่ง DOM เดียวกันไป generate PDF
 */
export function MaWorkOrderDocument({
  data,
  withPreviewShell = false,
  className = '',
}: MaWorkOrderDocumentProps) {
  const inner = (
    <div className={`ma-wo-root ${className}`.trim()} id="ma-work-order-document">
      <MaWorkOrderPage1 data={data} />
      <MaWorkOrderPage2 data={data} />
    </div>
  );

  if (withPreviewShell) {
    return <div className="ma-wo-preview-shell">{inner}</div>;
  }

  return inner;
}
