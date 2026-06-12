'use client';
import { X } from 'lucide-react';
import type { DeviceItem } from '../../app/contract_editer/add/types';

interface DeviceSelectorProps {
  selectedSiteId: string;
  devicesLoading: boolean;
  devicesBySite: DeviceItem[];
  selectedDeviceIds: string[];
  deviceInput: string;
  showDeviceDropdown: boolean;
  filteredDevices: DeviceItem[];
  deviceInputRef: React.RefObject<HTMLInputElement | null>;
  onSiteChange: (siteId: string) => void;
  onDeviceInputChange: (value: string) => void;
  onDeviceInputFocus: () => void;
  onDeviceInputBlur: () => void;
  onDeviceInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onAddDevice: (d: DeviceItem) => void;
  onRemoveDevice: (id: string) => void;
  getDeviceLabel: (id: string) => string;
  sitesLocation: { SLid: number; SiteName: string; Location2: string }[];
  dataLoading: boolean;
}

const inputBase = 'w-full rounded-xl border border-border bg-muted/80 p-3 text-sm outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

function getSelectedDevices(devicesBySite: DeviceItem[], selectedDeviceIds: string[]): DeviceItem[] {
  return devicesBySite.filter((d) => selectedDeviceIds.includes(String(d.Did)));
}

export function DeviceSelector({
  selectedSiteId,
  devicesLoading,
  devicesBySite,
  selectedDeviceIds,
  deviceInput,
  showDeviceDropdown,
  filteredDevices,
  deviceInputRef,
  onSiteChange,
  onDeviceInputChange,
  onDeviceInputFocus,
  onDeviceInputBlur,
  onDeviceInputKeyDown,
  onAddDevice,
  onRemoveDevice,
  getDeviceLabel,
  sitesLocation,
  dataLoading,
}: DeviceSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Site (Location)
        </label>
        <select
          value={selectedSiteId}
          onChange={(e) => onSiteChange(e.target.value)}
          className={inputBase}
          disabled={dataLoading}
        >
          <option value="">-- Select Site --</option>
          {sitesLocation.map((s) => (
            <option key={s.SLid} value={String(s.SLid)}>
              {s.SiteName} – {s.Location2}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Device <span className="font-normal text-muted-foreground">({selectedDeviceIds.length} items)</span>
        </label>
        {!selectedSiteId ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/50 py-8 text-center text-sm text-muted-foreground">
            <span>Select Site before viewing device list</span>
          </div>
        ) : devicesLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 py-8 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <span>Loading devices...</span>
          </div>
        ) : devicesBySite.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/50 py-8 text-center text-sm text-muted-foreground">
            <span>No devices in this site</span>
          </div>
        ) : (
          <div className={`relative z-50 space-y-3 ${showDeviceDropdown ? 'mb-72' : ''}`}>
            <div
              className={`min-h-[3rem] w-full rounded-xl border bg-card px-3 py-2.5 transition-all ${
                showDeviceDropdown && filteredDevices.length > 0
                  ? 'border-blue-400 ring-2 ring-blue-100'
                  : 'border-border bg-muted/80'
              }`}
              onClick={() => deviceInputRef.current?.focus()}
            >
              <input
                ref={deviceInputRef}
                type="text"
                value={deviceInput}
                onChange={(e) => onDeviceInputChange(e.target.value)}
                onFocus={onDeviceInputFocus}
                onBlur={onDeviceInputBlur}
                onKeyDown={onDeviceInputKeyDown}
                placeholder={selectedDeviceIds.length === 0 ? 'Type to search or select device...' : 'Type to search for more...'}
                className="min-h-[2rem] w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            {selectedDeviceIds.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/80">
                        <th className="px-4 py-3 font-semibold text-muted-foreground">Order</th>
                        <th className="px-4 py-3 font-semibold text-muted-foreground">Device Name</th>
                        <th className="px-4 py-3 font-semibold text-muted-foreground">Asset Number</th>
                        <th className="w-14 px-4 py-3 text-center font-semibold text-muted-foreground">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSelectedDevices(devicesBySite, selectedDeviceIds).map((d, i) => (
                        <tr
                          key={d.Did}
                          className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {d.CI_Name || d.Asset_Number || `Did ${d.Did}`}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">{d.Asset_Number ?? '–'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => onRemoveDevice(String(d.Did))}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                              title="Delete"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {showDeviceDropdown && filteredDevices.length > 0 && (
              <div className="absolute left-0 right-0 z-[9999] mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-blue-300 bg-card shadow-2xl">
                <div className="sticky top-0 z-10 border-b border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold uppercase text-blue-700">
                  Select Device ({filteredDevices.length} items)
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredDevices.map((d) => (
                    <div
                      key={d.Did}
                      onClick={() => onAddDevice(d)}
                      className="cursor-pointer px-4 py-2.5 transition-colors hover:bg-blue-50"
                    >
                      <p className="text-sm font-medium text-muted-foreground">
                        {d.CI_Name || d.Asset_Number || `Did ${d.Did}`}
                      </p>
                      {d.Asset_Number && d.CI_Name && (
                        <p className="mt-0.5 text-xs text-muted-foreground">Asset: {d.Asset_Number}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {showDeviceDropdown && filteredDevices.length === 0 && deviceInput && (
              <div className="absolute left-0 right-0 z-[9999] mt-2 w-full rounded-xl border border-amber-300 bg-card p-3 shadow-xl">
                <p className="text-sm text-amber-600">
                  No devices found matching the search
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
