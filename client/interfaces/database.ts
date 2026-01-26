// ============================================
// Database Type Definitions
// Using naming: did (device), sid (site), sname (site name)
// ============================================

// ============================================
// 1. SITES
// ============================================
export interface Site {
  sid: string; // Site ID
  sname: string; // Site Name
  location?: string;
  status?: 'Active' | 'Inactive' | 'Maintenance';
  created_at?: Date;
  updated_at?: Date;
}

// ============================================
// 2. DEVICES
// ============================================
export type DeviceStatus = 'Active' | 'Inactive' | 'Maintenance';
export type DeviceType = 
  | 'Router'
  | 'Switch'
  | 'Firewall'
  | 'Server'
  | 'Storage System'
  | 'UPS'
  | 'Access Point'
  | 'Network Switch';

export interface Device {
  did: string; // Device ID
  device_name: string;
  device_type: DeviceType;
  sid: string; // Site ID - Foreign Key
  location?: string;
  vendor?: string;
  model?: string;
  serial_number?: string;
  status: DeviceStatus;
  last_pm_date?: Date | null;
  next_pm_date?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

// Extended Device with site information
export interface DeviceWithSite extends Device {
  sname?: string; // Site Name (joined from sites table)
  site_location?: string;
}

// ============================================
// 3. EMPLOYEES
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
// 4. TASKS (PM and MA)
// ============================================
export type TaskType = 'PM' | 'MA';
export type TaskPriority = 'Low' | 'Medium' | 'High';
export type TaskStatus = 'Scheduled' | 'In Progress' | 'Done' | 'Failed' | 'Not Started';
export type TravelMethod = 'airplane' | 'bus' | 'private-car' | 'train' | 'other';

export interface Task {
  task_id: string;
  task_type: TaskType;
  title: string;
  sid: string; // Site ID
  sname: string; // Site Name
  start_date: Date;
  end_date: Date;
  priority: TaskPriority;
  coverage_scope?: string;
  travel_method?: TravelMethod | null;
  travel_cost?: number | null;
  status: TaskStatus;
  actually_went?: boolean;
  notes?: string;
  // MA Contract specific fields
  vendor_name?: string | null;
  sla_term?: string | null;
  duration_months?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

// Extended Task with relations
export interface TaskWithRelations extends Task {
  assigned_engineers?: Employee[];
  assigned_devices?: Device[];
  site?: Site;
}

// ============================================
// 5. TASK ASSIGNMENTS
// ============================================
export interface TaskAssignment {
  assignment_id: number;
  task_id: string;
  employee_id: string;
  assigned_at?: Date;
}

// ============================================
// 6. TASK DEVICES
// ============================================
export interface TaskDevice {
  task_device_id: number;
  task_id: string;
  did: string; // Device ID
  created_at?: Date;
}

// ============================================
// 7. PM HISTORY
// ============================================
export type PMHistoryStatus = 'Done' | 'In Progress' | 'Failed' | 'Scheduled';

export interface PMHistory {
  pm_history_id: string;
  did: string; // Device ID
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
  device?: Device;
  task?: Task;
  technician?: Employee;
}

// ============================================
// VIEW TYPES
// ============================================

// View: Device with Site Information
export interface DeviceSiteView {
  did: string;
  device_name: string;
  device_type: DeviceType;
  sid: string;
  sname: string;
  site_location?: string;
  device_location?: string;
  vendor?: string;
  model?: string;
  serial_number?: string;
  status: DeviceStatus;
  last_pm_date?: Date | null;
  next_pm_date?: Date | null;
}

// View: Task with Site and Device Information
export interface TaskDetailsView {
  task_id: string;
  task_type: TaskType;
  title: string;
  sid: string;
  sname: string;
  start_date: Date;
  end_date: Date;
  priority: TaskPriority;
  status: TaskStatus;
  vendor_name?: string | null;
  sla_term?: string | null;
  duration_months?: number | null;
  assigned_engineers?: string; // Comma-separated names
  assigned_devices?: string; // Comma-separated device names
}
