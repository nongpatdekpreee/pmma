/** PM Inspection document — backup map + maintenance photo checklist */

export interface PmBackupRecord {
  serialNumber: string;
  equipmentType?: string;
  equipmentLocation?: string;
  hostname?: string;
  product?: string;
  model?: string;
  rackRu?: string;
  osVersion?: string;
  ipAddress?: string;
  stackNo?: string;
  stackRole?: string;
  cpuProcessor?: string;
  memoryUtilization?: string;
  temperature?: string;
  environmentAlarm?: string;
  powerSupply?: string;
  fan?: string;
  systemUptime?: string;
  backupConfig?: string;
  hardwareCleaning?: string;
}

export interface PmInspectionSection {
  documentTitle: string;
  projectName: string;
  location: string;
  pmNo: string;
  pmDate: string;
  contactName: string;
  contactTel: string;
  equipmentType: string;
  equipmentLocation: string;
  hostname: string;
  product: string;
  model: string;
  rackRu: string;
  osVersion: string;
  ipAddress: string;
  serialNumber: string;
  stackNo: string;
  stackRole: string;
  cpuProcessor: string;
  memoryUtilization: string;
  temperature: string;
  environmentAlarm: string;
  powerSupply: string;
  fan: string;
  systemUptime: string;
  backupConfig: string;
  hardwareCleaning: string;
  comment: string;
}

export interface PmMaintenanceItemRow {
  id: string;
  no: number;
  location: string;
  rack: string;
  beforePhotoSrc?: string | null;
  afterPhotoSrc?: string | null;
  remark: string;
}

export interface PmMaintenanceChecklistSection {
  date: string;
  site: string;
  rows: PmMaintenanceItemRow[];
}

export interface PmFullDocument {
  inspections: PmInspectionSection[];
  maintenanceChecklist: PmMaintenanceChecklistSection;
}

/** Draft row in wizard — holds File + preview before upload */
export interface PmMaintenanceItemDraft {
  id: string;
  deviceDid?: number;
  deviceLabel?: string;
  location: string;
  rack: string;
  beforeFile?: File | null;
  beforePreview?: string | null;
  afterFile?: File | null;
  afterPreview?: string | null;
  remark: string;
  /** Notes from Technician — แยกต่อ device */
  technicianNote?: string;
}

export interface PmTaskContext {
  taskId?: number | string;
  siteName?: string;
  location?: string;
  pmDate?: string;
  technicianName?: string;
  contactName?: string;
  contactTel?: string;
  projectName?: string;
  pmNo?: string;
  deviceSerial?: string;
  deviceModel?: string;
  deviceLocation?: string;
  deviceType?: string;
}
