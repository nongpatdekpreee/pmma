'use client';

import { PM_WORK_ORDER_LOGO_SRC, TCC_COMPANY_HEADER } from '@/lib/pmWorkOrder/constants';

export function PmWorkOrderHeader() {
  return (
    <header className="pm-wo-header">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PM_WORK_ORDER_LOGO_SRC}
          alt="TCC Technology"
          className="pm-wo-logo-img"
          width={88}
          height={52}
          draggable={false}
        />
      </div>
      <div>
        <p className="pm-wo-company-name">{TCC_COMPANY_HEADER.nameTh}</p>
        {TCC_COMPANY_HEADER.addressLines.map((line) => (
          <p key={line} className="pm-wo-company-lines">
            {line}
          </p>
        ))}
      </div>
    </header>
  );
}
