/** PM Inspection document — backup map + maintenance photo checklist */

/** Row from Location Excel (asset register) */
export interface PmLocationRecord {
  serialNumber: string;
  model: string;
  ipAddress: string;
  hostname?: string;
  vendor?: string;
  assetTag?: string;
  serviceTag?: string;
  locationLevel?: string;
  roomNameLevel?: string;
  roomNumber?: string;
  cabinetRackName?: string;
  rackUnit?: string;
  ru?: string;
  slot?: string;
  rackSide?: string;
  subLocation?: string;
  unitName?: string;
  status?: string;
}

/** Row from monitoring / backup Excel (field readings) — matched by Serial + Model */
export interface PmMonitoringBackupRecord {
  serialNumber: string;
  model: string;
  hostname?: string;
  ipAddress?: string;
  osVersion?: string;
  systemUptime?: string;
  stackNo?: string;
  stackRole?: string;
  cpuUsage?: string;
  memoryUtilization?: string;
  environmentAlarm?: string;
  powerSupply?: string;
  temperature?: string;
  fileSizeKb?: string;
  fan?: string;
  backupConfig?: string;
  remark?: string;
  /** Legacy / display */
  equipmentName?: string;
  manufacturer?: string;
  gps?: string;
  substation?: string;
  installationDate?: string;
}

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
  fileSizeKb?: string;
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
  fileSizeKb: string;
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
  technicianName?: string;
  /** Preview URLs (blob:) for technician photos in PDF */
  technicianPhotoSrcs?: string[];
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
