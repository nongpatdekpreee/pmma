'use client';

import { MaWorkOrderHeader } from '@/components/ma-work-order/MaWorkOrderHeader';
import { PM_PERMIT_REQUEST_SUBJECT } from '@/lib/pmPermitRequest/constants';
import type { PmPermitRequestData } from '@/lib/pmPermitRequest/types';

export function PmPermitRequestDocument({ data }: { data: PmPermitRequestData }) {
  const clientLabel = data.clientCompanyName && data.clientCompanyName !== '—'
    ? `(บริษัท ${data.clientCompanyName})`
    : '(บริษัท ……………………………………………………………………………)';

  return (
    <div id="pm-permit-request-document" className="ma-wo-root pm-pr-root">
      <section className="ma-wo-page pm-pr-page" aria-label="ใบขออนุญาตเข้าพื้นที่ PM">
        <MaWorkOrderHeader />

        <p className="pm-pr-subject">{PM_PERMIT_REQUEST_SUBJECT}</p>
        <p className="pm-pr-line">เรียน ท่านผู้เกี่ยวข้อง</p>
        <p className="pm-pr-line pm-pr-client">{clientLabel}</p>

        <div className="pm-pr-body">
          <p className="pm-pr-line">
            อ้างถึง ใบเสนอราคา บริษัท T.C.C. Technology Company Limited เลขที่{' '}
            <span className="pm-pr-inline-value">{data.referSof || '…………………………'}</span>{' '}
            
          </p>
          <p className="pm-pr-line">
          สิ่งที่ส่งมาด้วย แผนการเข้าบำรุงรักษา (Preventive Maintenance)
          </p>
          <p className="pm-pr-paragraph">
            ตามที่{' '}
            <span className="pm-pr-inline-value">
              {data.clientCompanyName && data.clientCompanyName !== '—'
                ? `บริษัท ${data.clientCompanyName}`
                : 'บริษัท ……………………………………………………………………………'}
            </span>{' '}
            ได้ทำการซื้อบริการดูแลและบำรุงรักษา Maintenance Service Agreement (MA) อุปกรณ์เครือข่าย Network กับบริษัท T.C.C. Technology Company Limited อุปกรณ์เครือข่าย Network กับบริษัท T.C.C. Technology Company Limited
          </p>
          <p className="pm-pr-paragraph">
            บริษัท T.C.C. Technology Company Limited ขออนุญาตเข้าพื้นที่เพื่อปฏิบัติงาน Preventive Maintenance
            ตามรายละเอียดดังต่อไปนี้
          </p>
        </div>

        <p className="pm-pr-table-title">แผนเข้าปฏิบัติงาน Preventive Maintenance</p>
        <table className="pm-pr-table">
          <colgroup>
            <col className="pm-pr-col-no" />
            <col className="pm-pr-col-location" />
            <col className="pm-pr-col-province" />
            <col className="pm-pr-col-devices" />
            <col className="pm-pr-col-date" />
            <col className="pm-pr-col-date" />
            <col className="pm-pr-col-staff" />
          </colgroup>
          <thead>
            <tr>
              <th>No.</th>
              <th>สถานที่</th>
              <th>จังหวัด</th>
              <th>จำนวนอุปกรณ์</th>
              <th className="pm-pr-th-date">วันที่เริ่มดำเนินการ</th>
              <th className="pm-pr-th-date">วันที่ดำเนินการเสร็จ</th>
              <th>รายชื่อเจ้าหน้าที่</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.no}>
                <td>{row.no}</td>
                <td className="pm-pr-location">{row.location}</td>
                <td>{row.province}</td>
                <td className="pm-pr-num">{row.deviceCount}</td>
                <td className="pm-pr-date">{row.startDate}</td>
                <td className="pm-pr-date">{row.endDate}</td>
                <td className="pm-pr-staff">
                  {row.staffNames.map((name, idx) => (
                    <span key={`${row.no}-${idx}-${name}`} className="pm-pr-staff-name">
                      {name}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        

        <div className="pm-pr-signatures">
          <div className="pm-pr-sign-col">
            <p className="pm-pr-sign-line">ลงชื่อ ……………………………………………………………</p>
            <p className="pm-pr-sign-line">วันที่ ………………เดือน………………………………พ.ศ………………</p>
            <p className="pm-pr-sign-line">ตำแหน่ง ……………………………………………………………</p>
            <p className="pm-pr-sign-company">T.C.C. Technology Company Limited</p>
          </div>
          <div className="pm-pr-sign-col">
            <p className="pm-pr-sign-line">ลงชื่อ ……………………………………………………………</p>
            <p className="pm-pr-sign-line">วันที่ ………………เดือน………………………………พ.ศ………………</p>
            <p className="pm-pr-sign-line">ตำแหน่ง ……………………………………………………………</p>
            <p className="pm-pr-sign-company">
              {data.clientCompanyName && data.clientCompanyName !== '—'
                ? data.clientCompanyName
                : '…………………………………………………………………………'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
