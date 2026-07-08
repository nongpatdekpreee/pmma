import type { MaWorkOrderThaiDate } from '@/lib/maWorkOrder/types';

export interface PmPermitRequestRow {
  no: string;
  location: string;
  province: string;
  deviceCount: number;
  startDate: string;
  endDate: string;
  staffNames: string[];
}

export interface PmPermitRequestData {
  issueDate: MaWorkOrderThaiDate;
  clientCompanyName: string;
  referSof: string;
  rows: PmPermitRequestRow[];
}

export interface PmPermitRequestTaskInput {
  id?: string | number;
  taskType?: string;
  Sname?: string;
  siteDbName?: string;
  siteName?: string;
  location?: string;
  province?: string;
  startDate?: string;
  endDate?: string;
  engineer?: string;
  Eng_ids?: Array<{ id?: string; name?: string; lastName?: string }>;
  assets?: unknown[];
  contractId?: string | number | null;
  sofName?: string;
}
