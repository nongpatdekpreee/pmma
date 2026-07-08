import type { MaAssignedServiceType } from './types';

export const TCC_COMPANY_HEADER = {
  nameTh: 'บริษัท ที.ซี.ซี. เทคโนโลยี จำกัด',
  addressLines: [
    '2 อาคารสีลมเอจ ชั้นที่ 15 เลขที่ 1501-1504 ถนน สีลม แขวง สุริยวงศ์ เขตบางรัก กรุงเทพมหานคร 10500',
    'Tel:(+66)2-080-9737 Fax: (+66)2-838-8889 เลขประจำตัวผู้เสียภาษี 0105544075556',
    'Document version 1.0/15 May 2023'

  ],
} as const;

export const MA_WORK_ORDER_TITLE = 'ใบแจ้งซ่อม/เปลี่ยนอุปกรณ์';

export const MA_ASSIGNED_SERVICE_OPTIONS: MaAssignedServiceType[] = [
  'Device Network Manage Service',
  'Network as a Service',
  'Device Network Rental Service',
];

/** จำนวนแถว hardware ตามฟอร์ม TCC */
export const MA_BROKEN_HARDWARE_ROW_COUNT = 6;
export const MA_REPLACEMENT_HARDWARE_ROW_COUNT = 8;



/** โลโก้ TCC ใน header ฟอร์ม (public path) */
export const MA_WORK_ORDER_LOGO_SRC = '/ma-work-order/tcc-logo.png';
