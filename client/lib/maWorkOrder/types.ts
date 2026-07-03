/** ข้อมูลที่ใช้ render ใบแจ้งซ่อม/เปลี่ยนอุปกรณ์ TCC — แยกจาก task/API เพื่อออกแบบ UI/PDF ก่อน */

export type MaAssignedServiceType =
  | 'Device Network Manage Service'
  | 'Network as a Service'
  | 'Device Network Rental Service';

export type MaAssetOwner = 'customer' | 'tcc' | null;

export type MaResolutionOutcome =
  | 'resolved_no_replace'
  | 'resolved_with_replace'
  | 'unresolved'
  | null;

export interface MaWorkOrderHardwareRow {
  checked: boolean;
  model: string;
  serialNumber: string;
  /** แถวสุดท้าย "อื่นๆ" */
  isOther?: boolean;
}

export interface MaWorkOrderThaiDate {
  day: string;
  month: string;
  yearBe: string;
}

export interface MaWorkOrderSignatureBlock {
  label: string;
  name?: string;
  date?: string;
}

/** โมเดลข้อมูลฟอร์มครบ 2 หน้า — ใช้ร่วมกับ MaWorkOrderDocument และ PDF generator ภายหลัง */
export interface MaWorkOrderData {
  documentVersion?: string;

  issueDate: MaWorkOrderThaiDate;

  /** ส่วนที่ 1 — ข้อมูลลูกค้า */
  customerName: string;
  customerPosition: string;
  customerDepartment: string;
  customerPhone: string;
  companyName: string;
  ticketId: string;
  referSof: string;
  assignedService: MaAssignedServiceType | string | null;

  problemLocation: string;
  brokenHardware: MaWorkOrderHardwareRow[];
  assetOwner: MaAssetOwner;
  problemDescription: string;

  /** ส่วนที่ 2 — การดำเนินการ */
  resolutionOutcome: MaResolutionOutcome;
  unresolvedReason: string;
  replacementHardware: MaWorkOrderHardwareRow[];

  /** ส่วนที่ 3 */
  installDate: string;
  returnDate: string;
  warrantyFrom: string;
  warrantyTo: string;

  signatures: {
    deliverer: MaWorkOrderSignatureBlock;
    documentAuditor: MaWorkOrderSignatureBlock;
    customerReporter: MaWorkOrderSignatureBlock;
    approver: MaWorkOrderSignatureBlock;
  };
}

/** อุปกรณ์ที่ resolve แล้วจาก API / task.assets */
export interface MaWorkOrderDeviceInput {
  id?: string | number;
  name?: string;
  model?: string;
  serialNumber?: string;
  replacementDeviceId?: string | number | null;
}

export interface MaWorkOrderTaskInput {
  id?: string | number;
  taskType?: string;
  Sname?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  vendorName?: string;
  vendorTel?: string;
  reporterName?: string;
  reporterTel?: string;
  reporterPosition?: string;
  reporter_position?: string;
  reporterEmail?: string;
  reporter_email?: string;
  ticket?: string;
  assignedService?: string | null;
  assetBinding?: string | null;
  rootCause?: string;
  resolution?: string;
  notes?: string;
  status?: string;
  contractId?: string | number | null;
  replacementDeviceId?: string | number | null;
  downtimeDate?: string | null;
  uptimeDate?: string | null;
  assets?: MaWorkOrderDeviceInput[];
}

export interface MaWorkOrderMapContext {
  referSof?: string;
  resolvedDevices?: Record<string, MaWorkOrderDeviceInput>;
  resolvedReplacements?: Record<string, MaWorkOrderDeviceInput>;
  issueDate?: Date;
}
