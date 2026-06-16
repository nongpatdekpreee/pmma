'use client';

import type { ReactNode } from 'react';

export function MaWoDottedValue({
  value,
  className = '',
  minWidth,
}: {
  value?: string;
  className?: string;
  minWidth?: number;
}) {
  return (
    <span
      className={`ma-wo-dotted ${className}`.trim()}
      style={minWidth ? { minWidth } : undefined}
    >
      {value || '\u00A0'}
    </span>
  );
}

/** เส้นประเต็มความกว้าง — ใช้ในช่องรายละเอียดปัญหา / สาเหตุ */
export function MaWoRuledLine({ value = '' }: { value?: string }) {
  return (
    <div className="ma-wo-ruled-line">
      {value ? <span className="ma-wo-ruled-line-text">{value}</span> : '\u00A0'}
    </div>
  );
}

export function MaWoFieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="ma-wo-field-row">
      <span className="ma-wo-label">{label}</span>
      {children}
    </div>
  );
}

export function MaWoCheckbox({
  checked,
  label,
}: {
  checked?: boolean;
  label: string;
}) {
  return (
    <span className="ma-wo-checkbox">
      <span className={`ma-wo-box${checked ? ' checked' : ''}`} aria-hidden />
      <span className="ma-wo-checkbox-label">{label}</span>
    </span>
  );
}

export function MaWoRadio({
  checked,
  label,
  children,
}: {
  checked?: boolean;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="ma-wo-radio">
      <span className={`ma-wo-radio-circle${checked ? ' checked' : ''}`} aria-hidden />
      <div className="ma-wo-radio-body">
        <div>{label}</div>
        {children}
      </div>
    </div>
  );
}

export function MaWoSectionBar({ children }: { children: ReactNode }) {
  return (
    <div className="ma-wo-section-bar">
      <span className="ma-wo-section-bar-text">{children}</span>
    </div>
  );
}

export function MaWoHardwareRow({
  checked,
  model,
  serialNumber,
  isOther,
}: {
  checked?: boolean;
  model?: string;
  serialNumber?: string;
  isOther?: boolean;
}) {
  return (
    <div className="ma-wo-hw-row">
      <span className={`ma-wo-hw-check ma-wo-box${checked ? ' checked' : ''}`} aria-hidden />
      <div className="ma-wo-hw-cell">
        <span className="ma-wo-hw-label">{isOther ? 'อื่นๆ' : 'Hardware detail :'}</span>
        <MaWoDottedValue value={model} />
      </div>
      <div className="ma-wo-hw-cell">
        <span className="ma-wo-hw-label">Serial Number :</span>
        <MaWoDottedValue value={serialNumber} />
      </div>
    </div>
  );
}
