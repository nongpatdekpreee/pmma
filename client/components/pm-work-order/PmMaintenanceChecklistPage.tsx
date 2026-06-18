'use client';

import type { PmMaintenanceChecklistSection } from '@/lib/pmWorkOrder/types';
import { PM_MAINTENANCE_CHECKLIST_TITLE } from '@/lib/pmWorkOrder/constants';
import { PmWorkOrderHeader } from './PmWorkOrderHeader';

function PhotoCell({ src, label }: { src?: string | null; label: string }) {
  if (src) {
    return (
      <div className="pm-wo-photo-cell">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} />
      </div>
    );
  }
  return <div className="pm-wo-photo-placeholder">—</div>;
}

export function PmMaintenanceChecklistPage({ data }: { data: PmMaintenanceChecklistSection }) {
  return (
    <section className="pm-wo-page" aria-label="PM Maintenance checklist">
      <PmWorkOrderHeader />
      <h1 className="pm-wo-checklist-page-title">{PM_MAINTENANCE_CHECKLIST_TITLE}</h1>
      <div className="pm-wo-checklist-meta">
        <span>
          <strong>Date :</strong> {data.date}
        </span>
        <span>
          <strong>Site :</strong> {data.site}
        </span>
      </div>

      <table className="pm-wo-maint-table">
        <thead>
          <tr>
            <th className="pm-wo-col-no">No.</th>
            <th className="pm-wo-col-loc">Location</th>
            <th className="pm-wo-col-rack">Rack</th>
            <th className="pm-wo-col-photo">Before</th>
            <th className="pm-wo-col-photo">After</th>
            <th className="pm-wo-col-remark">Remark</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.id}>
              <td>{row.no}</td>
              <td>{row.location || '—'}</td>
              <td>{row.rack || '—'}</td>
              <td>
                <PhotoCell src={row.beforePhotoSrc} label={`Before ${row.no}`} />
              </td>
              <td>
                <PhotoCell src={row.afterPhotoSrc} label={`After ${row.no}`} />
              </td>
              <td>{row.remark || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
