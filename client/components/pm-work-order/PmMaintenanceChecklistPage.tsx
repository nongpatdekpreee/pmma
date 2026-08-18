'use client';

import type { PmMaintenanceItemRow, PmMaintenanceChecklistSection } from '@/lib/pmWorkOrder/types';
import { PM_MAINTENANCE_CHECKLIST_TITLE } from '@/lib/pmWorkOrder/constants';
import { PmWorkOrderHeader } from './PmWorkOrderHeader';

/** Rows per A4 page so Before/After photos stay large enough to read. */
const CHECKLIST_ROWS_PER_PAGE = 5;
const CHECKLIST_LAST_PAGE_ROWS_WITH_FOOTER = 5;

function chunkChecklistRows(
  rows: PmMaintenanceItemRow[],
  lastPageMax: number
): PmMaintenanceItemRow[][] {
  if (rows.length === 0) return [[]];
  const perPage = CHECKLIST_ROWS_PER_PAGE;
  const chunks: PmMaintenanceItemRow[][] = [];
  let i = 0;
  while (i < rows.length) {
    const remaining = rows.length - i;
    if (remaining <= lastPageMax) {
      chunks.push(rows.slice(i));
      break;
    }
    const leaveForLast = lastPageMax;
    const take =
      remaining - leaveForLast <= perPage
        ? Math.max(1, remaining - leaveForLast)
        : perPage;
    chunks.push(rows.slice(i, i + take));
    i += take;
  }
  return chunks;
}

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
  const technicianPhotos = (data.technicianPhotoSrcs ?? []).filter((src) => src.trim() !== '');
  const hasTechnicianFooter = true;
  const pages = chunkChecklistRows(
    data.rows,
    hasTechnicianFooter ? CHECKLIST_LAST_PAGE_ROWS_WITH_FOOTER : CHECKLIST_ROWS_PER_PAGE
  );

  return (
    <>
      {pages.map((pageRows, pageIdx) => {
        const isLast = pageIdx === pages.length - 1;
        return (
          <section
            key={`checklist-page-${pageIdx}`}
            className="pm-wo-page pm-wo-checklist-page"
            aria-label={`PM Maintenance checklist page ${pageIdx + 1} of ${pages.length}`}
          >
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
            {pages.length > 1 ? (
              <p className="pm-wo-checklist-page-index">
                Page {pageIdx + 1} / {pages.length}
              </p>
            ) : null}

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
                {pageRows.map((row) => (
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

            {isLast ? (
              <div className="pm-wo-technician-footer">
                <p className="pm-wo-technician-footer-label">Technician / ผู้ปฏิบัติงาน</p>
                {data.technicianName ? (
                  <p className="pm-wo-technician-footer-name">{data.technicianName}</p>
                ) : null}
                {technicianPhotos.length > 0 ? (
                  <div className="pm-wo-technician-photos">
                    {technicianPhotos.map((src, idx) => (
                      <div key={`${src}-${idx}`} className="pm-wo-technician-photo-wrap">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Technician ${idx + 1}`}
                          className="pm-wo-technician-photo"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pm-wo-technician-photo-placeholder">—</div>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
