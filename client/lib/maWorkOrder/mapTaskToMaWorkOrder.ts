import {
  MA_BROKEN_HARDWARE_ROW_COUNT,
  MA_REPLACEMENT_HARDWARE_ROW_COUNT,
  MA_WORK_ORDER_DOCUMENT_VERSION,
} from './constants';
import { formatDisplayDate, toThaiDateParts } from './formatThaiDate';
import type {
  MaAssetOwner,
  MaResolutionOutcome,
  MaWorkOrderData,
  MaWorkOrderDeviceInput,
  MaWorkOrderHardwareRow,
  MaWorkOrderMapContext,
  MaWorkOrderTaskInput,
} from './types';

function padHardwareRows(
  rows: MaWorkOrderHardwareRow[],
  count: number,
  lastIsOther = false
): MaWorkOrderHardwareRow[] {
  const out = [...rows];
  while (out.length < count) {
    const isLastSlot = out.length === count - 1 && lastIsOther;
    out.push({
      checked: false,
      model: '',
      serialNumber: '',
      isOther: isLastSlot,
    });
  }
  return out.slice(0, count).map((row, i) => ({
    ...row,
    isOther: lastIsOther && i === count - 1 ? true : row.isOther,
  }));
}

function resolveDevice(
  asset: MaWorkOrderDeviceInput,
  resolved?: Record<string, MaWorkOrderDeviceInput>
): MaWorkOrderDeviceInput {
  const key = asset.id != null ? String(asset.id) : '';
  const fromApi = key && resolved?.[key] ? resolved[key] : {};
  return {
    ...asset,
    ...fromApi,
    name: fromApi.name || asset.name || fromApi.model || asset.model || '',
    model: fromApi.model || asset.model || fromApi.name || asset.name || '',
    serialNumber: fromApi.serialNumber || asset.serialNumber || '',
  };
}

function mapAssetOwner(assetBinding?: string | null): MaAssetOwner {
  const s = (assetBinding ?? '').trim().toLowerCase();
  if (!s) return null;
  if (s.includes('customer') || s.includes('ลูกค้า')) return 'customer';
  if (s.includes('tcc')) return 'tcc';
  return null;
}

function inferResolutionOutcome(
  task: MaWorkOrderTaskInput,
  hasReplacement: boolean
): MaResolutionOutcome {
  const status = (task.status ?? '').toLowerCase();
  const resolution = (task.resolution ?? '').trim();
  const rootCause = (task.rootCause ?? '').trim();

  if (status === 'stuck' || /Cannot|failed|unresolved/i.test(resolution)) {
    return 'unresolved';
  }
  if (hasReplacement) return 'resolved_with_replace';
  if (resolution || status === 'done') return 'resolved_no_replace';
  if (rootCause && !resolution) return null;
  return null;
}

function buildBrokenRows(
  assets: MaWorkOrderDeviceInput[],
  resolved?: Record<string, MaWorkOrderDeviceInput>
): MaWorkOrderHardwareRow[] {
  const rows: MaWorkOrderHardwareRow[] = assets.map((asset) => {
    const d = resolveDevice(asset, resolved);
    return {
      checked: true,
      model: d.model || d.name || '',
      serialNumber: d.serialNumber || '',
    };
  });
  return padHardwareRows(rows, MA_BROKEN_HARDWARE_ROW_COUNT, true);
}

function buildReplacementRows(
  assets: MaWorkOrderDeviceInput[],
  resolvedDevices?: Record<string, MaWorkOrderDeviceInput>,
  resolvedReplacements?: Record<string, MaWorkOrderDeviceInput>,
  fallbackReplacementId?: string | number | null
): MaWorkOrderHardwareRow[] {
  const rows: MaWorkOrderHardwareRow[] = [];

  for (const asset of assets) {
    const repId =
      asset.replacementDeviceId ??
      (assets.length === 1 ? fallbackReplacementId : null);
    if (repId == null) continue;
    const rep =
      resolvedReplacements?.[String(repId)] ??
      ({
        id: repId,
        model: '',
        serialNumber: '',
      } as MaWorkOrderDeviceInput);
    const broken = resolveDevice(asset, resolvedDevices);
    rows.push({
      checked: true,
      model: rep.model || rep.name || broken.model || broken.name || '',
      serialNumber: rep.serialNumber || '',
    });
  }

  return padHardwareRows(rows, MA_REPLACEMENT_HARDWARE_ROW_COUNT, true);
}

/**
 * แปลง task MA → โมเดลฟอร์ม (sync)
 * ส่ง referSof / resolvedDevices / resolvedReplacements จาก caller หลัง fetch API
 */
export function mapTaskToMaWorkOrder(
  task: MaWorkOrderTaskInput,
  context: MaWorkOrderMapContext = {}
): MaWorkOrderData {
  const assets = Array.isArray(task.assets) ? task.assets : [];
  const companyOrSite = (task.Sname ?? '').trim();
  const hasReplacement = assets.some((a) => a.replacementDeviceId != null) || task.replacementDeviceId != null;

  const brokenHardware = buildBrokenRows(assets, context.resolvedDevices);
  const replacementHardware = buildReplacementRows(
    assets,
    context.resolvedDevices,
    context.resolvedReplacements,
    task.replacementDeviceId
  );

  const resolutionOutcome = inferResolutionOutcome(task, hasReplacement);
  const problemDescription =
    (task.rootCause ?? '').trim() ||
    (task.notes ?? '').trim() ||
    'Device is not working';

  return {
    documentVersion: MA_WORK_ORDER_DOCUMENT_VERSION,
    issueDate: toThaiDateParts(context.issueDate ?? task.startDate ?? new Date()),

    customerName: (task.reporterName ?? '').trim(),
    customerPosition: (task.reporterPosition ?? task.reporter_position ?? '').trim(),
    customerDepartment: companyOrSite,
    customerPhone: (task.reporterTel ?? '').trim(),
    companyName: companyOrSite,
    ticketId: (task.ticket ?? '').trim(),
    referSof: (context.referSof ?? '').trim(),
    assignedService: (task.assignedService ?? '').trim() || null,

    problemLocation: (task.location || task.Sname || '').trim(),
    brokenHardware,
    assetOwner: mapAssetOwner(task.assetBinding),
    problemDescription,

    resolutionOutcome,
    unresolvedReason:
      resolutionOutcome === 'unresolved'
        ? (task.rootCause ?? task.resolution ?? '').trim()
        : '',
    replacementHardware,

    installDate: formatDisplayDate(task.uptimeDate ?? task.endDate),
    returnDate: formatDisplayDate(task.downtimeDate),
    warrantyFrom: '',
    warrantyTo: '',

    signatures: {
      deliverer: { label: 'ลงชื่อ(ผู้ส่งมอบ/เปลี่ยน TCCTech)' },
      documentAuditor: { label: 'ลงชื่อ(ผู้ตรวจสอบเอกสาร)' },
      customerReporter: { label: 'ลงชื่อ(ผู้แจ้งซ่อม ลูกค้า)' },
      approver: { label: 'ลงชื่อ(ผู้อนุมัติ)' },
    },
  };
}
