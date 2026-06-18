'use client';

import type { PmFullDocument } from '@/lib/pmWorkOrder/types';
import './pm-work-order.css';
import { PmInspectionPage } from './PmInspectionPage';
import { PmMaintenanceChecklistPage } from './PmMaintenanceChecklistPage';

export type PmWorkOrderDocumentProps = {
  data: PmFullDocument;
  withPreviewShell?: boolean;
  className?: string;
};

export function PmWorkOrderDocument({
  data,
  withPreviewShell = false,
  className = '',
}: PmWorkOrderDocumentProps) {
  const inner = (
    <div className={`pm-wo-root ${className}`.trim()} id="pm-work-order-document">
      {data.inspections.map((inspection, idx) => (
        <PmInspectionPage key={`inspection-${idx}-${inspection.serialNumber}`} data={inspection} />
      ))}
      <PmMaintenanceChecklistPage data={data.maintenanceChecklist} />
    </div>
  );

  if (withPreviewShell) {
    return <div className="pm-wo-preview-shell">{inner}</div>;
  }

  return inner;
}
