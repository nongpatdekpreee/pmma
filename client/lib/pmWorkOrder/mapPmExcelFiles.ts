import type { PmBackupRecord, PmLocationRecord, PmMaintenanceItemDraft, PmMonitoringBackupRecord } from './types';
import {
  buildLocationDisplayText,
  buildRackDisplayText,
  findLocationForDevice,
} from './parseLocationFile';
import {
  deviceLabelFromParts,
  findMonitoringForLocation,
  monitoringToPmBackupRecord,
} from './parsePmMonitoringBackupFile';
import { deviceModelKey } from './normalizeMatch';

export type PmWizardDevice = {
  Did: number;
  CI_Name?: string;
  serial?: string;
  model?: string;
  Location2?: string;
  Sitename?: string;
};

export type LocationMapResult = {
  locationByDid: Map<number, PmLocationRecord | null>;
  mappedCount: number;
  unmapped: string[];
};

export type BackupMapResult = {
  backupByDid: Map<number, PmBackupRecord | null>;
  mappedCount: number;
  unmapped: string[];
};

export function mapLocationRecordsToDevices(
  devices: PmWizardDevice[],
  locationRecords: PmLocationRecord[]
): LocationMapResult {
  const locationByDid = new Map<number, PmLocationRecord | null>();
  const unmapped: string[] = [];
  let mappedCount = 0;

  for (const device of devices) {
    const label = deviceLabelFromParts(device);
    const serial = (device.serial ?? '').trim();
    const model = deviceModelKey(device);

    if (!serial) {
      unmapped.push(`${label}: no serial in task`);
      locationByDid.set(device.Did, null);
      continue;
    }
    if (!model) {
      unmapped.push(`${label} (${serial}): no model in task`);
      locationByDid.set(device.Did, null);
      continue;
    }

    const loc = findLocationForDevice(locationRecords, device);
    if (loc) {
      mappedCount += 1;
      locationByDid.set(device.Did, loc);
    } else {
      unmapped.push(`${label} (${serial} / ${model}): not found in location file`);
      locationByDid.set(device.Did, null);
    }
  }

  return { locationByDid, mappedCount, unmapped };
}

export function mapMonitoringBackupToDevices(
  devices: PmWizardDevice[],
  locationByDid: Map<number, PmLocationRecord | null>,
  monitoringRecords: PmMonitoringBackupRecord[]
): BackupMapResult {
  const backupByDid = new Map<number, PmBackupRecord | null>();
  const unmapped: string[] = [];
  let mappedCount = 0;

  for (const device of devices) {
    const label = deviceLabelFromParts(device);
    const loc = locationByDid.get(device.Did);

    if (!loc) {
      unmapped.push(`${label}: no location row — upload location file first`);
      backupByDid.set(device.Did, null);
      continue;
    }

    const mon = findMonitoringForLocation(monitoringRecords, loc);
    if (mon) {
      mappedCount += 1;
      backupByDid.set(
        device.Did,
        monitoringToPmBackupRecord(mon, {
          hostname: loc.hostname,
          vendor: loc.vendor,
          ipAddress: loc.ipAddress,
        })
      );
    } else {
      const ip = loc.ipAddress || '—';
      const model = loc.model || '—';
      unmapped.push(`${label}: no backup row matching IP ${ip} + Model ${model}`);
      backupByDid.set(device.Did, null);
    }
  }

  return { backupByDid, mappedCount, unmapped };
}

export function buildMaintenanceRowsFromMaps(
  devices: PmWizardDevice[],
  locationByDid: Map<number, PmLocationRecord | null>,
  backupByDid: Map<number, PmBackupRecord | null>,
  monitoringByDid?: Map<number, PmMonitoringBackupRecord | null>
): PmMaintenanceItemDraft[] {
  return devices.map((d) => {
    const loc = locationByDid.get(d.Did);
    const backup = backupByDid.get(d.Did);
    const mon = monitoringByDid?.get(d.Did);
    return {
      id: `row-${d.Did}`,
      deviceDid: d.Did,
      deviceLabel: deviceLabelFromParts(d),
      location: loc ? buildLocationDisplayText(loc) : (d.Location2 ?? '').trim(),
      rack: loc ? buildRackDisplayText(loc) : backup?.rackRu || '',
      remark: mon?.remark?.trim() || '',
      technicianNote: '',
    };
  });
}

export function allDevicesMapped(
  devices: PmWizardDevice[],
  map: Map<number, PmLocationRecord | PmBackupRecord | null>
): boolean {
  return devices.length > 0 && devices.every((d) => map.get(d.Did) != null);
}
