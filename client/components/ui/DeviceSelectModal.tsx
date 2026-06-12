'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search } from 'lucide-react';
import { apiUrl } from '@/lib/api';

export interface DeviceSelectModalDevice {
  id: string;
  name: string;
  type?: string;
  serialNumber?: string;
  site?: string;
  assetNumber?: string;
  role?: string;
  manufacturer?: string;
}

export interface DeviceSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (selectedIds: string[]) => void;
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
  onConfirm,
  title = 'Select Device',
  devices,
  selectedIds,
  filter,
  onFilterChange,
  onSelectAll,
  onClearAll,
  onToggleDevice,
}: DeviceSelectModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('');
  const [manufacturers, setManufacturers] = useState<Array<{ Mid: number; name: string; slug: string }>>([]);
  const [loadingManufacturers, setLoadingManufacturers] = useState(false);
  
  useEffect(() => setMounted(true), []);
  
  // Load manufacturers from API when modal opens
  useEffect(() => {
    if (isOpen && manufacturers.length === 0) {
      const loadManufacturers = async () => {
        setLoadingManufacturers(true);
        try {
          const res = await fetch(apiUrl('/api/manufacturers'));
          const json = await res.json();
          if (res.ok && json.success && json.data) {
            setManufacturers(json.data);
          }
        } catch (error) {
          console.error('Error loading manufacturers:', error);
        } finally {
          setLoadingManufacturers(false);
        }
      };
      loadManufacturers();
    }
  }, [isOpen, manufacturers.length]);
  
  // Reset filters when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedRole('');
      setSelectedModel('');
      setSelectedManufacturer('');
    }
  }, [isOpen]);

  // First filter by text search only (for dropdown options)
  const textFilteredDevices = devices.filter((d) => {
    if (!filter.trim()) return true;
    const filterLower = filter.toLowerCase();
    return (
      d.name.toLowerCase().includes(filterLower) ||
      d.assetNumber?.toLowerCase().includes(filterLower) ||
      d.id.includes(filter) ||
      d.type?.toLowerCase().includes(filterLower) ||
      d.serialNumber?.toLowerCase().includes(filterLower) ||
      d.manufacturer?.toLowerCase().includes(filterLower)
    );
  });

  // Extract unique roles and models from ALL devices (not filtered)
  // For manufacturers, use data from API (database) instead of devices
  const uniqueRoles = Array.from(new Set(devices.map(d => d.role).filter(Boolean))).sort();
  const uniqueModels = Array.from(new Set(devices.map(d => d.type).filter(Boolean))).sort();

  // Manufacturer options should only include values that can yield results,
  // based on current text search + role/model filters (but not manufacturer itself).
  const devicesForManufacturerOptions = textFilteredDevices.filter((d) => {
    if (selectedRole && d.role !== selectedRole) return false;
    if (selectedModel && d.type !== selectedModel) return false;
    return true;
  });
  const manufacturerSet = new Set(
    devicesForManufacturerOptions
      .map((d) => (d.manufacturer || '').trim())
      .filter(Boolean)
  );
  // Use manufacturers from API (database), but only those present in current device list
  const uniqueManufacturers = manufacturers
    .map((m) => m.name)
    .filter((name) => manufacturerSet.has(String(name).trim()))
    .sort();

  // Reset selected filters if they're no longer available in the full devices list
  useEffect(() => {
    if (selectedRole && !uniqueRoles.includes(selectedRole)) {
      setSelectedRole('');
    }
    if (selectedModel && !uniqueModels.includes(selectedModel)) {
      setSelectedModel('');
    }
    // If manufacturer is no longer selectable (would yield 0 devices), reset it.
    if (selectedManufacturer && !uniqueManufacturers.includes(selectedManufacturer)) {
      setSelectedManufacturer('');
    }
  }, [uniqueRoles, uniqueModels, uniqueManufacturers, selectedRole, selectedModel, selectedManufacturer]);

  if (!isOpen) return null;

  // Final filter: text search + role + model + manufacturer
  const filteredDevices = textFilteredDevices.filter((d) => {
    // Role filter
    if (selectedRole && d.role !== selectedRole) return false;

    // Model filter
    if (selectedModel && d.type !== selectedModel) return false;

    // Manufacturer filter
    if (selectedManufacturer && d.manufacturer !== selectedManufacturer) return false;

    return true;
  });

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl shadow-slate-900/20 ring-1 ring-white/60 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-border/70 bg-gradient-to-r from-white via-sky-50/30 to-indigo-50/25 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
            <span className="text-xl">📱</span>
            <span>{title}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-card/80 p-2 text-muted-foreground shadow-sm transition-all hover:border-border hover:bg-muted hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center justify-between border-b border-border/70 px-6 py-3 bg-gradient-to-r from-sky-50/50 via-white to-indigo-50/40">
          <div className="flex items-center gap-2">
            {(() => {
              const allSelected = filteredDevices.length > 0 && filteredDevices.every((d) => selectedIds.includes(d.id));
              const anySelectedInFilter = filteredDevices.some((d) => selectedIds.includes(d.id));
              // Get selected filter name for display
              const selectedFilterName = selectedRole || selectedModel || selectedManufacturer || '';
              const selectAllText = selectedFilterName 
                ? `Select All of ${selectedFilterName}` 
                : 'Select All';
              // โทนกลางเมื่อมีรายการแต่ยังไม่เลือก; สีฟ้าเมื่อเลือกบางส่วน; กด Select All จนครบ = ฟ้าเข้ม + ✓
              const bluePartial = filteredDevices.length > 0 && anySelectedInFilter && !allSelected;
              const blueAllDone = allSelected;
              
              return (
                <button
                  type="button"
                  onClick={onSelectAll}
                  disabled={filteredDevices.length === 0}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-all ${
                    blueAllDone
                      ? 'bg-gradient-to-r from-sky-600 to-cyan-700 text-white shadow-md shadow-sky-900/20 hover:from-sky-700 hover:to-cyan-800 hover:shadow-md'
                      : bluePartial
                        ? 'bg-gradient-to-r from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-900/15 hover:from-sky-600 hover:to-cyan-700 hover:shadow-md'
                        : 'border border-border bg-card/80 text-muted-foreground hover:border-border hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
                  }`}
                >
                  <span>{allSelected ? '✓' : '✅'}</span>
                  <span>{selectAllText}</span>
                </button>
              );
            })()}
            <button
              type="button"
              onClick={onClearAll}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card/80 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm transition-all hover:border-border hover:bg-muted"
            >
              <span>🗑️</span>
              <span>Clear All</span>
            </button>
          </div>
          {(() => {
            // Count only selected items that are in filteredDevices
            const selectedFilteredCount = filteredDevices.filter((d) => selectedIds.includes(d.id)).length;
            return (
              <span className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card/90 px-4 py-2 text-xs font-semibold text-muted-foreground shadow-sm ring-1 ring-border">
                <span className="text-sky-600">📋</span>
                <span>{selectedFilteredCount} / {filteredDevices.length} items</span>
              </span>
            );
          })()}
        </div>
        <div className="space-y-3 border-b border-border/70 bg-muted/40 px-6 py-3">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filter}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="Search Device..."
              className="w-full rounded-xl border border-border/90 bg-card pl-10 pr-3 py-2 text-sm text-foreground shadow-sm shadow-slate-900/[0.03] outline-none transition-all placeholder:text-muted-foreground focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">⚙️</span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className={`w-full rounded-xl border bg-card pl-9 pr-3 py-2 text-sm outline-none transition-all shadow-sm ${
                  selectedRole
                    ? 'border-sky-400 bg-sky-50/60 ring-2 ring-sky-200/80'
                    : 'border-border/90 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15'
                }`}
              >
                <option value="">All Role</option>
                {uniqueRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">📱</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={`w-full rounded-xl border bg-card pl-9 pr-3 py-2 text-sm outline-none transition-all shadow-sm ${
                  selectedModel
                    ? 'border-sky-400 bg-sky-50/60 ring-2 ring-sky-200/80'
                    : 'border-border/90 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15'
                }`}
              >
                <option value="">All Model</option>
                {uniqueModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🏭</span>
              <select
                value={selectedManufacturer}
                onChange={(e) => setSelectedManufacturer(e.target.value)}
                disabled={loadingManufacturers}
                className={`w-full rounded-xl border bg-card pl-9 pr-3 py-2 text-sm outline-none transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedManufacturer
                    ? 'border-sky-400 bg-sky-50/60 ring-2 ring-sky-200/80'
                    : 'border-border/90 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15'
                }`}
              >
                <option value="">All Manufacturer</option>
                {loadingManufacturers ? (
                  <option disabled>Loading...</option>
                ) : (
                  uniqueManufacturers.map((manufacturer) => (
                    <option key={manufacturer} value={manufacturer}>
                      {manufacturer}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto bg-gradient-to-b from-white to-slate-50/30 px-6 py-4">
          {filteredDevices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {filter ? 'No devices found matching the search' : 'No devices'}
            </p>
          ) : (
            filteredDevices.map((d) => {
              const isSelected = selectedIds.includes(d.id);
              return (
                <label
                  key={d.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 shadow-sm transition-all ${
                    isSelected
                      ? 'border-sky-400 bg-sky-50/40 shadow-md ring-2 ring-sky-200/70'
                      : 'border-border bg-card/90 hover:border-sky-300 hover:bg-sky-50/25 hover:shadow-md'
                  }`}
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{d.name}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {/* Model/Serial badge */}
                      {d.serialNumber && 
                       d.name && 
                       !d.name.includes(d.serialNumber) && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                          <span className="text-sm">📱</span>
                          <span className="font-semibold">Model/Serial:</span>
                          <span className="font-mono">{[d.type, d.serialNumber].filter(Boolean).join(' / ')}</span>
                        </span>
                      )}
                      {/* Model only badge */}
                      {!d.serialNumber && d.type && d.name && !d.name.includes(d.type) && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">
                          <span className="text-sm">🔧</span>
                          <span className="font-semibold">Model:</span>
                          <span>{d.type}</span>
                        </span>
                      )}
                      {/* Role badge with color coding and different emojis */}
                      {d.role && (() => {
                        const roleLower = d.role.toLowerCase();
                        let emoji = '⚙️'; // default
                        let className = 'bg-muted text-muted-foreground ring-slate-600/20';
                        
                        if (roleLower.includes('router')) {
                          emoji = '🌐';
                          className = 'bg-orange-50 text-orange-700 ring-orange-600/20';
                        } else if (roleLower.includes('switch')) {
                          emoji = '🔀';
                          className = 'bg-indigo-50 text-indigo-700 ring-indigo-600/20';
                        } else if (roleLower.includes('server')) {
                          emoji = '🖥️';
                          className = 'bg-green-50 text-green-700 ring-green-600/20';
                        } else if (roleLower.includes('access point') || roleLower.includes('ap')) {
                          emoji = '📡';
                          className = 'bg-cyan-50 text-cyan-700 ring-cyan-600/20';
                        } else if (roleLower.includes('firewall')) {
                          emoji = '🛡️';
                          className = 'bg-red-50 text-red-700 ring-red-600/20';
                        } else if (roleLower.includes('storage') || roleLower.includes('nas')) {
                          emoji = '💾';
                          className = 'bg-purple-50 text-purple-700 ring-purple-600/20';
                        } else if (roleLower.includes('ups') || roleLower.includes('power')) {
                          emoji = '🔌';
                          className = 'bg-yellow-50 text-yellow-700 ring-yellow-600/20';
                        } else if (roleLower.includes('printer')) {
                          emoji = '🖨️';
                          className = 'bg-pink-50 text-pink-700 ring-pink-600/20';
                        }
                        
                        return (
                          <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>
                            <span className="text-sm">{emoji}</span>
                           
                            <span className="font-bold">{d.role}</span>
                          </span>
                        );
                      })()}
                      {/* Manufacturer badge */}
                      {d.manufacturer && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                          <span className="text-sm">🏭</span>
            
                          <span className="font-bold">{d.manufacturer}</span>
                        </span>
                      )}
                      {/* Asset badge */}
                      {d.assetNumber && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                          <span className="text-sm">🏷️</span>
                          <span className="font-semibold">Asset:</span>
                          <span className="font-mono font-bold">{d.assetNumber}</span>
                        </span>
                      )}
                      {/* Site badge */}
                      {d.site && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20">
                          <span className="text-sm">📍</span>
                          <span className="font-semibold">Site:</span>
                          <span>{d.site}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleDevice(d.id)}
                    className="h-5 w-5 cursor-pointer accent-sky-600"
                  />
                </label>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border/70 bg-gradient-to-r from-slate-50/80 via-white to-sky-50/30 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:bg-muted"
          >
            <span>❌</span>
            <span>Close</span>
          </button>
          {(() => {
            // Count only selected items that are in filteredDevices (matching the display above)
            const selectedFilteredCount = filteredDevices.filter((d) => selectedIds.includes(d.id)).length;
            // Check if there are any active filters (role, model, manufacturer, or search)
            const hasActiveFilter = selectedRole || selectedModel || selectedManufacturer || filter.trim();
            
            // Get filtered device IDs
            const filteredDeviceIds = new Set(filteredDevices.map((d) => d.id));
            // Get selected IDs that are in the filtered devices list
            const selectedFilteredIds = selectedIds.filter((id) => filteredDeviceIds.has(id));
            
            // If there's an active filter, only keep devices in the filtered list that are selected
            // Otherwise, keep all selected devices
            const finalSelectedIds = hasActiveFilter 
              ? selectedFilteredIds 
              : selectedIds;
            
            const handleConfirm = () => {
              if (onConfirm) {
                // If filter is active, only pass devices in filtered list that are selected
                // Otherwise, pass all selected devices
                onConfirm(finalSelectedIds);
              }
              onClose();
            };
            
            return (
              <button
                type="button"
                onClick={handleConfirm}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-900/20 ring-1 ring-sky-400/25 transition-all hover:from-sky-600 hover:via-blue-700 hover:to-indigo-700 hover:shadow-xl"
              >
                <span>✓</span>
                <span>Confirm ({selectedFilteredCount})</span>
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return null;
}
