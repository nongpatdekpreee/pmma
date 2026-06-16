import type { MaWorkOrderData } from './types';

/** ข้อมูลตัวอย่างจากฟอร์ม TCC — ใช้ preview / ออกแบบ layout */
export const MA_WORK_ORDER_SAMPLE: MaWorkOrderData = {
  documentVersion: 'Document version 1.0 8:25 June 2024',
  issueDate: { day: '27', month: 'พฤษภาคม', yearBe: '2569' },

  customerName: 'Chatchai Chalermrutnukul',
  customerPosition: 'IT',
  customerDepartment: 'TCC-Private Company',
  customerPhone: '090-571-9746',
  companyName: 'TCC-Private Company',
  ticketId: '376652',
  referSof: '8910020956',
  assignedService: 'Device Network Manage Service',

  problemLocation: 'TCC-Private',
  brokenHardware: [
    { checked: true, model: 'AIR-AP1852I-S-K9', serialNumber: 'KWC2447074V' },
    { checked: true, model: 'AIR-AP1852I-S-K9', serialNumber: 'KWC2230004B' },
    { checked: false, model: '', serialNumber: '' },
    { checked: false, model: '', serialNumber: '' },
    { checked: false, model: '', serialNumber: '' },
    { checked: false, model: '', serialNumber: '', isOther: true },
  ],
  assetOwner: null,
  problemDescription: 'Device is not working',

  resolutionOutcome: 'resolved_with_replace',
  unresolvedReason: '',
  replacementHardware: [
    { checked: true, model: 'AIR-AP1852I-S-K9', serialNumber: 'KWC234803SM' },
    { checked: true, model: 'AIR-AP1852I-S-K9', serialNumber: 'KWC234805L6' },
    { checked: true, model: 'AIR-AP1852I-S-K9', serialNumber: '' },
    { checked: false, model: '', serialNumber: '' },
    { checked: false, model: '', serialNumber: '' },
    { checked: false, model: '', serialNumber: '' },
    { checked: false, model: '', serialNumber: '' },
    { checked: false, model: '', serialNumber: '', isOther: true },
  ],

  installDate: '',
  returnDate: '',
  warrantyFrom: '',
  warrantyTo: '',

  signatures: {
    deliverer: { label: 'ลงชื่อ(ผู้ส่งมอบ/เปลี่ยน TCCTech)' },
    documentAuditor: { label: 'ลงชื่อ(ผู้ตรวจสอบเอกสาร)' },
    customerReporter: { label: 'ลงชื่อ(ผู้แจ้งซ่อม ลูกค้า)' },
    approver: { label: 'ลงชื่อ(ผู้อนุมัติ)' },
  },
};
