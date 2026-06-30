'use client';

import type { PmInspectionSection } from '@/lib/pmWorkOrder/types';
import { PM_INSPECTION_TITLE } from '@/lib/pmWorkOrder/constants';
import { PmWorkOrderHeader } from './PmWorkOrderHeader';

function UnderlinedValue({ value }: { value: string }) {
  return <span className="pm-wo-underline-value">{value?.trim() || '\u00a0'}</span>;
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="pm-wo-field-line">
      <span className="pm-wo-field-line-label">{label}</span>
      <UnderlinedValue value={value} />
    </div>
  );
}

function ChecklistLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="pm-wo-checklist-line">
      <span className="pm-wo-checklist-label">{label}</span>
      <UnderlinedValue value={value} />
    </div>
  );
}

function ChecklistPairItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="pm-wo-checklist-pair-item">
      <span className="pm-wo-checklist-label">{label}</span>
      <UnderlinedValue value={value} />
    </span>
  );
}

function FanChecklistLines({ value }: { value: string }) {
  const lines = value?.trim()
    ? value
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [''];

  return (
    <div className="pm-wo-checklist-line pm-wo-checklist-line-fan">
      <span className="pm-wo-checklist-label">Fan</span>
      <div className="pm-wo-fan-values">
        {lines.map((line, i) => (
          <div key={i} className="pm-wo-fan-value-row">
            <UnderlinedValue value={line} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PmInspectionPage({ data }: { data: PmInspectionSection }) {
  return (
    <section className="pm-wo-page pm-wo-inspection-page" aria-label="PM Inspection page">
      <div className="pm-wo-doc-frame">
        <PmWorkOrderHeader />

        <div className="pm-wo-title-bar">{PM_INSPECTION_TITLE}</div>

        <div className="pm-wo-project-block">
          <FieldLine label="Project name :" value={data.projectName} />
          <FieldLine label="Location :" value={data.location} />
          <div className="pm-wo-split-row">
            <FieldLine label="PM No." value={data.pmNo} />
            <FieldLine label="Date of PM :" value={data.pmDate} />
          </div>
          <div className="pm-wo-split-row">
            <FieldLine label="Contact Name :" value={data.contactName} />
            <FieldLine label="Tel :" value={data.contactTel} />
          </div>
        </div>

        <div className="pm-wo-section-box">
          <div className="pm-wo-section-bar">Network Equipment Information</div>
          <div className="pm-wo-two-col-body">
            <div className="pm-wo-two-col">
              <FieldLine label="Type of equipment" value={data.equipmentType} />
              <FieldLine label="Location" value={data.equipmentLocation} />
              <FieldLine label="Hostname" value={data.hostname} />
              <FieldLine label="Product" value={data.product} />
              <FieldLine label="Model" value={data.model} />
            </div>
            <div className="pm-wo-two-col pm-wo-two-col-right">
              <FieldLine label="Rack/RU" value={data.rackRu} />
              <FieldLine label="Software Version" value={data.osVersion} />
              <FieldLine label="IP address" value={data.ipAddress} />
              <FieldLine label="Serial number" value={data.serialNumber} />
            </div>
          </div>
        </div>

        <div className="pm-wo-section-box">
          <div className="pm-wo-section-bar">Network Equipment Checklist</div>
          <p className="pm-wo-checklist-subtitle">Hardware check</p>
          <div className="pm-wo-checklist-body">
            <div className="pm-wo-checklist-pair-row">
              <ChecklistPairItem label="Stack" value={data.stackNo} />
              <ChecklistPairItem label="Stack Role" value={data.stackRole} />
            </div>
            <ChecklistLine label="CPU processor" value={data.cpuProcessor} />
            <ChecklistLine label="Memory utilization" value={data.memoryUtilization} />
            <ChecklistLine label="Temperature" value={data.temperature} />
            <ChecklistLine label="Environment Alarm" value={data.environmentAlarm} />
            <ChecklistLine label="Power Supply" value={data.powerSupply} />
            <FanChecklistLines value={data.fan} />
            <ChecklistLine label="System Uptime" value={data.systemUptime} />
            <div className="pm-wo-checklist-pair-row">
              <ChecklistPairItem label="Backup Config" value={data.backupConfig} />
              <ChecklistPairItem label="Hardware cleaning" value={data.hardwareCleaning} />
            </div>
          
          </div>
        </div>

        <div className="pm-wo-comment-section">
          <p className="pm-wo-comment-heading">Comment/Remark :</p>
          {data.comment.trim() ? (
            <p className="pm-wo-comment-text">{data.comment}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
