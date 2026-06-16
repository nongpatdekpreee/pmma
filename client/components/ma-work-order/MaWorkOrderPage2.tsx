'use client';

import type { MaWorkOrderData } from '@/lib/maWorkOrder';
import { MaWorkOrderHeader } from './MaWorkOrderHeader';
import {
  MaWoDottedValue,
  MaWoFieldRow,
  MaWoHardwareRow,
  MaWoRadio,
  MaWoRuledLine,
  MaWoSectionBar,
} from './primitives';

function SignatureColumn({
  blocks,
}: {
  blocks: Array<{ label: string; name?: string; date?: string }>;
}) {
  return (
    <div className="ma-wo-sign-block">
      {blocks.map((block) => (
        <div key={block.label}>
          <MaWoFieldRow label={block.label}>
            <MaWoDottedValue value={block.name} />
          </MaWoFieldRow>
          <MaWoFieldRow label="วันที่">
            <MaWoDottedValue value={block.date} minWidth={80} />
          </MaWoFieldRow>
        </div>
      ))}
    </div>
  );
}

export function MaWorkOrderPage2({ data }: { data: MaWorkOrderData }) {
  const outcome = data.resolutionOutcome;

  return (
    <section className="ma-wo-page" aria-label="ใบแจ้งซ่อม หน้า 2">
      <MaWorkOrderHeader />
<div style={{ marginTop: 30 }}>
      <MaWoSectionBar>
        ส่วนที่ 2 สำหรับเจ้าหน้าที่ของ บริษัท ที.ซี.ซี. เทคโนโลยี จำกัด
      </MaWoSectionBar>

      <p style={{ fontWeight: 600, margin: '6px 0 8px' }}>การดำเนินการ</p>

      <MaWoRadio
        checked={outcome === 'resolved_no_replace' || outcome === 'resolved_with_replace'}
        label="สามารถแก้ปัญหาอาการเสียสำเร็จ"
      >
        <div className="ma-wo-subsection">

          <MaWoRadio
            checked={outcome === 'resolved_no_replace'}
            label="ไม่ต้องเปลี่ยนอุปกรณ์"
          />
          <MaWoRadio
            checked={outcome === 'resolved_with_replace'}
            label="ต้องเปลี่ยนอุปกรณ์ใหม่ ดังนี้"
          >
            <div style={{ marginTop: 6 }}>
              {data.replacementHardware.map((row, i) => (
                <MaWoHardwareRow
                  key={i}
                  checked={row.checked}
                  model={row.model}
                  serialNumber={row.serialNumber}
                  isOther={row.isOther}
                />
              ))}
            </div>
          </MaWoRadio>
        </div>
      </MaWoRadio>

      <MaWoRadio
        checked={outcome === 'unresolved'}
        label="ไม่สามารรถแก้ปัญหาอาการเสีย สาเหตุ"
      >
        <div className="ma-wo-subsection ma-wo-problem-lines">
          <MaWoRuledLine value={data.unresolvedReason} />
          <MaWoRuledLine />
        </div>
      </MaWoRadio>
      </div>

      <div style={{ marginTop: 30 }}>
        <MaWoSectionBar>
          ส่วนที่ 3 กรณีนำอุปกรณ์เก่ากลับเพื่อเข้าระบบ TCCTech สำหรับ PM ของ บริษัท ที.ซี.ซี.
          เทคโนโลยี จำกัด (MA service)
        </MaWoSectionBar>
      </div>
      <div style={{ marginTop: 14 }}>
        <MaWoFieldRow label="วันที่ติดตั้งอุปกรณ์">
          <MaWoDottedValue value={data.installDate} />
        </MaWoFieldRow>
        <MaWoFieldRow label="วันที่นำอุปกรณ์เดิมกลับ">
          <MaWoDottedValue value={data.returnDate} />
        </MaWoFieldRow>
        <MaWoFieldRow label="รับประกันอุปกรณ์ ตั้งแต่">
          <MaWoDottedValue value={data.warrantyFrom} className="inline" minWidth={100} />
          <span className="ma-wo-label">ถึง</span>
          <MaWoDottedValue value={data.warrantyTo} className="inline" minWidth={100} />
        </MaWoFieldRow>
      </div>
      <div style={{ marginTop: 60 }}>
      <footer className="ma-wo-signatures pt-10">
        <SignatureColumn
          blocks={[data.signatures.deliverer, data.signatures.documentAuditor]}
        />
        <SignatureColumn
          blocks={[data.signatures.customerReporter, data.signatures.approver]}
        />
      </footer>
      </div>
    </section>
  );
}
