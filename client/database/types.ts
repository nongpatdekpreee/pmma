// ============================================
// Database Type Definitions
// TypeScript types matching the database schema
// ============================================

// ============================================
// 1. SITES
// ============================================
export interface Site {
  site_id: string;
  site_name: string;
  created_at?: Date;
  updated_at?: Date;
}

// ============================================
// 2. EMPLOYEES
// ============================================
export type PositionType = 'Technical' | 'Management';
export type EmploymentType = 'Full-time' | 'Contract' | 'Part-time';

export interface Employee {
  employee_id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  department: string;
  position: string;
  position_type: PositionType;
  employment_type: EmploymentType;
  created_at?: Date;
  updated_at?: Date;
}

// ============================================
// 3. VENDORS
// ============================================
export interface Vendor {
  vendor_id: number;
  vendor_name: string;
  created_at?: Date;
  updated_at?: Date;
}

// ============================================
// 4. DEVICE TYPES
// ============================================
export interface DeviceType {
  device_type_id: number;
  device_type_name: string;
}

// ============================================
// 5. ASSETS/DEVICES
// ============================================
export type AssetStatus = 'Active' | 'Inactive' | 'Maintenance';
export type DeviceTypeName = 
  | 'Network Switch'
  | 'Router'
  | 'Firewall'
  | 'Server'
  | 'Storage System'
  | 'UPS'
  | 'Access Point';

export interface Asset {
  device_id: string;
  device_name: string;
  device_type_id: number;
  site_id: string;
  location?: string;
  vendor_id?: number;
  model?: string;
  serial_number?: string;
  status: AssetStatus;
  last_pm_date?: Date | null;
  next_pm_date?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

// Extended Asset with relations
export interface AssetWithRelations extends Asset {
  device_type?: DeviceType;
  site?: Site;
  vendor?: Vendor;
}

// ============================================
// 6. CONTRACTS (MA)
// ============================================
export type SLATerm = 'Design' | 'Standard' | 'Premium';
export type ContractStatus = 'Active' | 'Expired' | 'Terminated';

export interface Contract {
  contract_id: string;
  vendor_id: number;
  site_id: string;
  contract_name?: string;
  sla_term: SLATerm;
  start_date: Date;
  end_date: Date;
  duration_months: number;
  status: ContractStatus;
  sla_percentage?: number;
  created_at?: Date;
  updated_at?: Date;
}

// Extended Contract with relations
export interface ContractWithRelations extends Contract {
  vendor?: Vendor;
  site?: Site;
  bound_assets?: Asset[];
}

// ============================================
// 7. CONTRACT ASSET BINDINGS
// ============================================
export interface ContractAssetBinding {
  binding_id: number;
  contract_id: string;
  device_id: string;
  created_at?: Date;
}

// ============================================
// 8. TASKS (PM and MA)
// ============================================
export type TaskType = 'PM' | 'MA';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Scheduled' | 'In Progress' | 'Done' | 'Failed' | 'Not Started';
export type TravelMethod = 'airplane' | 'bus' | 'private-car' | 'train' | 'other';

export interface Task {
  task_id: string;
  task_type: TaskType;
  title: string;
  site_id: string;
  contract_id?: string | null;
  start_date: Date;
  end_date: Date;
  priority: TaskPriority;
  coverage_scope?: string;
  travel_method?: TravelMethod | null;
  travel_cost?: number | null;
  status: TaskStatus;
  actually_went?: boolean;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

// Extended Task with relations
export interface TaskWithRelations extends Task {
  site?: Site;
  contract?: Contract;
  assigned_engineers?: Employee[];
  assigned_assets?: Asset[];
  /** path บนเซิร์ฟเวอร์ เช่น /uploads/tasks/... (เก็บเป็น JSON array ของ string) */
  photos?: string[];
}

// ============================================
// 9. TASK ASSIGNMENTS
// ============================================
export interface TaskAssignment {
  assignment_id: number;
  task_id: string;
  employee_id: string;
  assigned_at?: Date;
}

// ============================================
// 10. TASK ASSETS
// ============================================
export interface TaskAsset {
  task_asset_id: number;
  task_id: string;
  device_id: string;
  created_at?: Date;
}

// ============================================
// 11. PM HISTORY
// ============================================
export type PMHistoryStatus = 'Done' | 'In Progress' | 'Failed' | 'Scheduled';

export interface PMHistory {
  pm_history_id: string;
  device_id: string;
  task_id?: string | null;
  pm_date: Date;
  technician_id: string;
  status: PMHistoryStatus;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

// Extended PM History with relations
export interface PMHistoryWithRelations extends PMHistory {
  device?: Asset;
  task?: Task;
  technician?: Employee;
}

// ============================================
// 12. TASK PHOTOS
// ============================================
export type PhotoType = 'base64' | 'url' | 'file_path';

export interface TaskPhoto {
  photo_id: number;
  task_id: string;
  photo_url: string;
  photo_type: PhotoType;
  uploaded_at?: Date;
}

// ============================================
// 13. SLA COMPLIANCE
// ============================================
export type SLAComplianceStatus = 'Pass' | 'Partial' | 'Miss' | 'Active';

export interface SLACompliance {
  compliance_id: number;
  contract_id: string;
  vendor_id: number;
  site_id: string;
  sla_percentage: number;
  status: SLAComplianceStatus;
  measured_date: Date;
  created_at?: Date;
}

// Extended SLA Compliance with relations
export interface SLAComplianceWithRelations extends SLACompliance {
  contract?: Contract;
  vendor?: Vendor;
  site?: Site;
}

// ============================================
// 14. DEPARTMENTS
// ============================================
export interface Department {
  department_id: number;
  department_name: string;
}

// ============================================
// 15. POSITIONS
// ============================================
export interface Position {
  position_id: number;
  position_name: string;
  position_type: PositionType;
}

// ============================================
// VIEW TYPES
// ============================================

// View: Task Details
export interface TaskDetailsView {
  task_id: string;
  task_type: TaskType;
  title: string;
  start_date: Date;
  end_date: Date;
  priority: TaskPriority;
  status: TaskStatus;
  site_name: string;
  site_id: string;
  contract_id?: string;
  vendor_id?: number;
  vendor_name?: string;
  assigned_engineers?: string;
  assigned_assets?: string;
}

// View: Asset PM Summary
export interface AssetPMSummaryView {
  device_id: string;
  device_name: string;
  device_type_id: number;
  device_type_name: string;
  site_id: string;
  site_name: string;
  vendor_id?: number;
  vendor_name?: string;
  last_pm_date?: Date | null;
  next_pm_date?: Date | null;
  status: AssetStatus;
  total_pm_count: number;
  latest_pm_date?: Date | null;
}

// View: Contract SLA Summary
export interface ContractSLASummaryView {
  contract_id: string;
  contract_name?: string;
  vendor_name: string;
  site_name: string;
  sla_term: SLATerm;
  start_date: Date;
  end_date: Date;
  contract_status: ContractStatus;
  sla_percentage?: number;
  sla_status?: SLAComplianceStatus;
  measured_date?: Date;
  bound_asset_count: number;
}

// ============================================
// CALENDAR EVENT (Combined from Task)
// ============================================
export interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  color: string;
  startDay: number;
  endDay: number;
  month: number;
  year: number;
  engineer: string;
  // Extended fields for full task data
  taskType?: TaskType;
  Sid?: string;
  Sname?: string;
  Eng_ids?: Employee[];
  startDate?: string;
  endDate?: string;
  priority?: TaskPriority;
  coverageScope?: string;
  assets?: Asset[];
  vendorName?: string;
  slaTerm?: SLATerm;
  duration?: string;
  assetBinding?: string;
  travelMethod?: TravelMethod;
  travelCost?: string;
  actuallyWent?: boolean;
  photos?: string[];
  notes?: string;
}
