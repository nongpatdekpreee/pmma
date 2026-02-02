'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface DeviceSelectModalDevice {
  id: string;
  name: string;
  type?: string;
  serialNumber?: string;
  site?: string;
  assetNumber?: string;
}

export interface DeviceSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  devices: DeviceSelectModalDevice[];
  selectedIds: string[];
  filter: string;
  onFilterChange: (value: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onToggleDevice: (deviceId: string) => void;
}

export function DeviceSelectModal({
  isOpen,
  onClose,
  title = 'เลือก Device',
  devices,
  selectedIds,
  filter,
  onFilterChange,
  onSelectAll,
  onClearAll,
  onToggleDevice,
}: DeviceSelectModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!isOpen) return null;

  const filteredDevices = devices.filter((d) => {
    if (!filter.trim()) return true;
    const filterLower = filter.toLowerCase();
    return (
      d.name.toLowerCase().includes(filterLower) ||
      d.assetNumber?.toLowerCase().includes(filterLower) ||
      d.id.includes(filter)
    );
  });

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-full bg-slate-100 p-2 hover:bg-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex gap-2">
            <button
              onClick={onSelectAll}
              className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
            >
              เลือกทั้งหมด
            </button>
            <button
              onClick={onClearAll}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold hover:bg-slate-200"
            >
              ล้างทั้งหมด
            </button>
          </div>
          <span className="text-xs text-slate-400">
            {selectedIds.length} / {devices.length} รายการ
          </span>
        </div>
        <div className="border-b px-6 py-3">
          <input
            type="text"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="ค้นหา Device..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
          {filteredDevices.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {filter ? 'ไม่พบ Device ที่ตรงกับคำค้นหา' : 'ไม่มี Device'}
            </p>
          ) : (
            filteredDevices.map((d) => {
              const isSelected = selectedIds.includes(d.id);
              return (
                <label
                  key={d.id}
                  className="flex cursor-pointer items-center justify-between rounded-xl border p-3 transition hover:bg-slate-50"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700">{d.name}</p>
                    <div className="mt-1 flex gap-2 text-xs text-slate-400">
                      {d.assetNumber && <span>Asset: {d.assetNumber}</span>}
                      {d.serialNumber && <span>| SN: {d.serialNumber}</span>}
                      {d.site && <span>| Site: {d.site}</span>}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleDevice(d.id)}
                    className="h-4 w-4 accent-blue-500"
                  />
                </label>
              );
            })
          )}
        </div>
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button onClick={onClose} className="rounded-xl bg-slate-100 px-4 py-2 text-sm hover:bg-slate-200">
            ปิด
          </button>
          <button onClick={onClose} className="rounded-xl bg-blue-500 px-5 py-2 text-sm font-bold text-white hover:bg-blue-600">
            ตกลง ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return null;
}
