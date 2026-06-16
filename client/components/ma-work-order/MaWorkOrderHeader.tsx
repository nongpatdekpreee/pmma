'use client';

import { MA_WORK_ORDER_LOGO_SRC, TCC_COMPANY_HEADER } from '@/lib/maWorkOrder';

export function MaWorkOrderHeader({ documentVersion }: { documentVersion?: string }) {
  return (
    <>
      <div className="ma-wo-original-badge">
        <span className="ma-wo-original-badge-text">ต้นฉบับ</span>
      </div>
      <header className="ma-wo-header">
        <div className="ma-wo-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MA_WORK_ORDER_LOGO_SRC}
            alt="TCC Technology"
            className="ma-wo-logo-img"
            width={88}
            height={52}
            draggable={false}
            style={{ paddingTop: 14 }}
          />
        </div>
        <div>
          <p className="ma-wo-company-name">{TCC_COMPANY_HEADER.nameTh}</p>
          {TCC_COMPANY_HEADER.addressLines.map((line) => (
            <p key={line} className="ma-wo-company-lines">
              {line}
            </p>
          ))}
        </div>
      </header>
      {documentVersion ? (
        <p className="ma-wo-doc-version">{documentVersion}</p>
      ) : null}
    </>
  );
}
