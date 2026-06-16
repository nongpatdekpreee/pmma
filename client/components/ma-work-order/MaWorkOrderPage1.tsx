'use client';

import { MA_ASSIGNED_SERVICE_OPTIONS, MA_WORK_ORDER_TITLE } from '@/lib/maWorkOrder';
import type { MaWorkOrderData } from '@/lib/maWorkOrder';
import { MaWorkOrderHeader } from './MaWorkOrderHeader';
import {
  MaWoCheckbox,
  MaWoDottedValue,
  MaWoFieldRow,
  MaWoHardwareRow,
  MaWoRuledLine,
  MaWoSectionBar,
} from './primitives';

export function MaWorkOrderPage1({ data }: { data: MaWorkOrderData }) {
  const { issueDate } = data;

  return (
    <section className="ma-wo-page" aria-label="ใบแจ้งซ่อม หน้า 1">
      <MaWorkOrderHeader documentVersion={data.documentVersion} />

      <h1 className="ma-wo-title">{MA_WORK_ORDER_TITLE}</h1>

      <p className="ma-wo-date-line">
        <span className="ma-wo-date-sep">วันที่</span>
        <MaWoDottedValue value={issueDate.day} className="inline" minWidth={28} />
        <span className="ma-wo-date-sep">เดือน</span>
        <MaWoDottedValue value={issueDate.month} className="inline" minWidth={72} />
        <span className="ma-wo-date-sep">พ.ศ.</span>
        <MaWoDottedValue value={issueDate.yearBe} className="inline" minWidth={40} />
      </p>

      <MaWoSectionBar>ส่วนที่ 1 ข้อมูลลูกค้า</MaWoSectionBar>

      <MaWoFieldRow label="ชื่อ-สกุล">
        <MaWoDottedValue value={data.customerName} />
      </MaWoFieldRow>
      <MaWoFieldRow label="ตำแหน่ง">
        <MaWoDottedValue value={data.customerPosition} />
      </MaWoFieldRow>
      <MaWoFieldRow label="หน่วยงาน">
        <MaWoDottedValue value={data.customerDepartment} />
      </MaWoFieldRow>
      <MaWoFieldRow label="หมายเลขโทรศัพท์ติดต่อ">
        <MaWoDottedValue value={data.customerPhone} />
      </MaWoFieldRow>
      <MaWoFieldRow label="ชื่อบริษัท">
        <MaWoDottedValue value={data.companyName} />
      </MaWoFieldRow>

      <MaWoFieldRow label="Reference TCCtech ticket request with ID :">
        <MaWoDottedValue value={data.ticketId} />
      </MaWoFieldRow>
      <MaWoFieldRow label="Reference SOF TCCtech :">
        <MaWoDottedValue value={data.referSof} />
      </MaWoFieldRow>

      <div className="ma-wo-service-options">
        {MA_ASSIGNED_SERVICE_OPTIONS.map((opt) => (
          <MaWoCheckbox
            key={opt}
            checked={data.assignedService === opt}
            label={opt}
          />
        ))}
      </div>

      <p style={{ fontWeight: 600, margin: '10px 0 6px' }}>แจ้งปัญหา</p>
      <MaWoFieldRow label="ตำแหน่งที่ตั้ง/สถานที่">
        <MaWoDottedValue value={data.problemLocation} />
      </MaWoFieldRow>

      <div style={{ marginTop: 8 }}>
        {data.brokenHardware.map((row, i) => (
          <MaWoHardwareRow
            key={i}
            checked={row.checked}
            model={row.model}
            serialNumber={row.serialNumber}
            isOther={row.isOther}
          />
        ))}
      </div>

      <div className="ma-wo-asset-owner-row">
        <span className="ma-wo-asset-owner-label">เจ้าของทรัพย์สิน:</span>
        <MaWoCheckbox checked={data.assetOwner === 'customer'} label="ลูกค้า" />
        <MaWoCheckbox
          checked={data.assetOwner === 'tcc'}
          label="TCC Technology Co., Ltd."
        />
      </div>

      <p style={{ fontWeight: 600, margin: '8px 0 4px' }}>รายละเอียดของปัญหา</p>
      <div className="ma-wo-problem-lines">
        <MaWoRuledLine value={data.problemDescription} />
        <MaWoRuledLine />
        <MaWoRuledLine />
      </div>
    </section>
  );
}
