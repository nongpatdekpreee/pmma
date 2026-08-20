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
import { modelCandidatesFromDevice } from './normalizeMatch';

export type PmWizardDevice = {
  Did: number;
  CI_Name?: string;
  serial?: string;
  model?: string;
  Asset_Number?: string;
  Sitename?: string;
};

/** Location/rack only from matched location file row — empty when no match */
export function resolveMaintenanceLocationAndRack(
  _device: PmWizardDevice,
  loc: PmLocationRecord | null | undefined
): { location: string; rack: string } {
  if (!loc) return { location: '', rack: '' };
  return {
    location: buildLocationDisplayText(loc),
    rack: buildRackDisplayText(loc),
  };
}

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

    if (!serial) {
      unmapped.push(`${label}: no serial in task — add serial to task assets`);
      locationByDid.set(device.Did, null);
      continue;
    }

    const loc = findLocationForDevice(locationRecords, device);
    if (loc) {
      mappedCount += 1;
      locationByDid.set(device.Did, loc);
    } else {
      const models = modelCandidatesFromDevice(device);
      const modelHint = models[0] || '(no model)';
      unmapped.push(
        `${label}: no location row with Serial ${serial}` +
          (models.length ? ` (task model ${modelHint})` : '')
      );
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
      unmapped.push(
        `${label}: no backup row with Serial ${loc.serialNumber} + Model ${loc.model} — optional`
      );
      backupByDid.set(device.Did, null);
    }
  }

  return { backupByDid, mappedCount, unmapped };
}

/** Step 4 rows: every device that matched a location file row */
export function buildMaintenanceRowsFromMaps(
  devices: PmWizardDevice[],
  locationByDid: Map<number, PmLocationRecord | null>,
  _backupByDid: Map<number, PmBackupRecord | null>,
  monitoringByDid?: Map<number, PmMonitoringBackupRecord | null>
): PmMaintenanceItemDraft[] {
  return devices
    .filter((d) => locationByDid.get(d.Did) != null)
    .map((d) => {
      const loc = locationByDid.get(d.Did)!;
      const mon = monitoringByDid?.get(d.Did);
      const { location, rack } = resolveMaintenanceLocationAndRack(d, loc);
      return {
        id: `row-${d.Did}`,
        deviceDid: d.Did,
        deviceLabel: deviceLabelFromParts({
          Did: d.Did,
          CI_Name: d.CI_Name,
          model: d.model || loc.model,
          serial: d.serial || loc.serialNumber,
        }),
        location: location || loc.hostname || '',
        rack,
        remark: mon?.remark?.trim() || '',
        technicianNote: '',
      };
    });
}

export function mergeMaintenanceRowsWithPhotos(
  previous: PmMaintenanceItemDraft[],
  fresh: PmMaintenanceItemDraft[]
): PmMaintenanceItemDraft[] {
  const prevByDid = new Map(
    previous.filter((r) => r.deviceDid != null).map((r) => [r.deviceDid as number, r])
  );

  const mergedDeviceRows = fresh.map((row) => {
    const prev = row.deviceDid != null ? prevByDid.get(row.deviceDid) : undefined;
    if (!prev) return row;
    return {
      ...row,
      location: row.location,
      rack: row.rack,
      remark: prev.remark.trim() ? prev.remark : row.remark,
      technicianNote: prev.technicianNote ?? row.technicianNote,
      beforeFile: prev.beforeFile,
      beforePreview: prev.beforePreview,
      afterFile: prev.afterFile,
      afterPreview: prev.afterPreview,
    };
  });

  const manualRows = previous.filter((r) => r.deviceDid == null);
  return [...mergedDeviceRows, ...manualRows];
}

export function allDevicesMapped(
  devices: PmWizardDevice[],
  map: Map<number, PmLocationRecord | PmBackupRecord | null>
): boolean {
  return devices.length > 0 && devices.every((d) => map.get(d.Did) != null);
}
