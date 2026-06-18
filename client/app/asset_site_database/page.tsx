"use client";

import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Server, Network, Shield, HardDrive, Zap, Radio, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Search, X, Calendar, MapPin, History, Loader2 } from "lucide-react";
import DashboardHeader from "@/components/ui/Header";
import { SidebarLayout } from "@/components/sidebar/SidebarLayout";
import { getDevicesWithPM } from "@/lib/api";

interface PMHistory {
  id: string;
  date: string;
  status: "Done" | "In Progress" | "Failed" | "Scheduled";
  technician: string;
  notes?: string | null;
}

interface AssetDevice {
  Did?: number; // เพิ่ม Did เพื่อใช้เป็น unique key
  deviceId: string;
  deviceName: string;
  deviceRole: "Network Switch" | "Router" | "Firewall" | "Server" | "Storage System" | "UPS" | "Access Point" | string;
  site: string;
  location: string;
  vendor: string;
  model: string;
  serialNumber: string;
  lastPM: string | null;
  nextPM: string | null;
  pmHistory: PMHistory[];
  status: "Active" | "Inactive" | "Maintenance";
}

// Summary cards will be calculated from API data
const ITEMS_PER_PAGE = 10;

/* ================= Helper Functions ================= */
const formatDate = (dateString: string | null) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const getDaysUntilPM = (dateString: string | null) => {
  if (!dateString) return null;
  const today = new Date();
  const pmDate = new Date(dateString);
  const diffTime = pmDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getDeviceRoleIcon = (type: AssetDevice["deviceRole"]) => {
  switch (type) {
    case "Network Switch":
    case "Router":
      return Network;
    case "Firewall":
      return Shield;
    case "Server":
      return Server;
    case "Storage System":
      return HardDrive;
    case "UPS":
      return Zap;
    case "Access Point":
      return Radio;
    default:
      return Server;
  }
};

const getStatusColor = (status: AssetDevice["status"]) => {
  switch (status) {
    case "Active":
      return "bg-green-100 text-green-700";
    case "Inactive":
      return "bg-muted text-muted-foreground";
    case "Maintenance":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const AssetSiteDatabase = () => {
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<"deviceId" | "site" | "lastPM" | "nextPM">("deviceId");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterDeviceRole, setFilterDeviceRole] = useState<string>("all");
  const [filterSite, setFilterSite] = useState<string>("all");
  const [selectedDevice, setSelectedDevice] = useState<AssetDevice | null>(null);
  const [showPMHistory, setShowPMHistory] = useState(false);
  const [devices, setDevices] = useState<AssetDevice[]>([]);
  const [allDevices, setAllDevices] = useState<AssetDevice[]>([]); // เก็บ devices ทั้งหมดสำหรับ client-side filtering
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    totalDevices: 0,
    activeDevices: 0,
    upcomingPM: 0
  });

  // โหลดข้อมูลทั้งหมดตอนแรกเพื่อใช้สำหรับ client-side filtering
  useEffect(() => {
    const loadAllDevices = async () => {
      try {
        const response = await getDevicesWithPM({
          deviceRole: filterDeviceRole !== 'all' ? filterDeviceRole : undefined,
          site: filterSite !== 'all' ? filterSite : undefined,
        });
        
        if (response && response.success !== false && response.data) {
          setAllDevices(response.data);
        }
      } catch (error) {
        console.error('Error loading all devices:', error);
      }
    };

    loadAllDevices();
  }, [filterDeviceRole, filterSite]);

  // Debounce input ก่อนค่อยยิง search (ลดเวลาเพื่อให้เร็วขึ้น)
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 300); // ลดจาก 500ms เป็น 300ms เพื่อให้เร็วขึ้น

    return () => clearTimeout(handler);
  }, [inputValue]);

  // Load devices from API
  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoading(true);
        const response = await getDevicesWithPM({
          search: searchTerm || undefined,
          deviceRole: filterDeviceRole !== 'all' ? filterDeviceRole : undefined,
          site: filterSite !== 'all' ? filterSite : undefined,
        });
        
        if (response && response.success !== false && response.data) {
          setDevices(response.data);
          if (response.statistics) {
            setStatistics(response.statistics);
          }
        } else {
          setDevices([]);
          if (response?.statistics) {
            setStatistics(response.statistics);
          }
        }
      } catch (error) {
        console.error('Error loading devices:', error);
        setDevices([]);
      } finally {
        setLoading(false);
      }
    };

    loadDevices();
  }, [searchTerm, filterDeviceRole, filterSite]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDeviceRole, filterSite]);

  /* ================= Get unique values for filters ================= */
  const deviceRoles = useMemo(() => {
    const roles = Array.from(new Set(devices.map(d => d.deviceRole)));
    return roles.sort();
  }, [devices]);

  const sites = useMemo(() => {
    const siteList = Array.from(new Set(devices.map(d => d.site)));
    return siteList.sort();
  }, [devices]);

  /* ================= Filter ================= */
  // Client-side filtering ขณะพิมพ์ (ใช้ inputValue เพื่อ filter ทันที)
  const filteredDevices = useMemo(() => {
    // ถ้าไม่มี inputValue ให้แสดง devices ที่ได้จาก API
    if (!inputValue.trim()) {
      return devices;
    }

    // ใช้ allDevices สำหรับ client-side filtering (ถ้ามีข้อมูล)
    const sourceDevices = allDevices.length > 0 ? allDevices : devices;

    // Filter จาก sourceDevices โดยใช้ inputValue (filter ทันทีขณะพิมพ์)
    const searchLower = inputValue.toLowerCase();
    return sourceDevices.filter(device => {
      const deviceName = (device.deviceName || '').toLowerCase();
      const deviceId = (device.deviceId || '').toLowerCase();
      const serialNumber = (device.serialNumber || '').toLowerCase();
      const vendor = (device.vendor || '').toLowerCase();
      
      return deviceName.includes(searchLower) ||
             deviceId.includes(searchLower) ||
             serialNumber.includes(searchLower) ||
             vendor.includes(searchLower);
    });
  }, [devices, allDevices, inputValue]);

  /* ================= Sort ================= */
  const sortedDevices = useMemo(() => {
    const copy = [...filteredDevices];
    copy.sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      switch (sortField) {
        case "deviceId":
          aValue = a.deviceId;
          bValue = b.deviceId;
          break;
        case "site":
          aValue = a.site;
          bValue = b.site;
          break;
        case "lastPM":
          aValue = a.lastPM ? new Date(a.lastPM).getTime() : 0;
          bValue = b.lastPM ? new Date(b.lastPM).getTime() : 0;
          break;
        case "nextPM":
          aValue = a.nextPM ? new Date(a.nextPM).getTime() : 0;
          bValue = b.nextPM ? new Date(b.nextPM).getTime() : 0;
          break;
        default:
          aValue = a.deviceId;
          bValue = b.deviceId;
      }

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortOrder === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortOrder === "asc"
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });
    return copy;
  }, [filteredDevices, sortField, sortOrder]);

  /* ================= Pagination ================= */
  const totalItems = sortedDevices.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDevices = sortedDevices.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  /* ================= Sort Handler ================= */
  const handleSort = (field: "deviceId" | "site" | "lastPM" | "nextPM") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="ml-1 h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3" />
    );
  };

  /* ================= Reset Filters ================= */
  const resetFilters = () => {
    setFilterDeviceRole("all");
    setFilterSite("all");
    setInputValue("");
    setCurrentPage(1);
  };

  const hasActiveFilters = filterDeviceRole !== "all" || filterSite !== "all" || inputValue !== "";

  return (
    <SidebarLayout>
      <DashboardHeader />

      <main className="mx-auto w-full max-w-full space-y-6 px-4 md:px-6 lg:px-8 py-6 md:mt-0 mt-16">
        {/* ================= Summary Cards ================= */}
        <section className="grid gap-6 md:grid-cols-3">
          <article className="flex flex-col items-center justify-between rounded-2xl bg-card border border-border px-6 py-5 shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500">
                <Server className="h-7 w-7 text-blue-900" />
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">
                  TOTAL DEVICES
                </p>
                <div className="text-3xl font-semibold">
                  {loading ? "..." : statistics.totalDevices}
                </div>
              </div>
            </div>
          </article>

          <article className="flex flex-col items-center justify-between rounded-2xl bg-card border border-border px-6 py-5 shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500">
                <Network className="h-7 w-7 text-blue-900" />
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">
                  ACTIVE DEVICES
                </p>
                <div className="text-3xl font-semibold">  
                  {loading ? "..." : statistics.activeDevices}
                </div>
              </div>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-600">
              
            </span>
          </article>

          <article className="flex flex-col items-center justify-between rounded-2xl bg-card border border-border px-6 py-5 shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500">
                <Calendar className="h-7 w-7 text-blue-900" />
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">
                  UPCOMING PM
                </p>
                <div className="text-3xl font-semibold">
                  {loading ? "..." : statistics.upcomingPM}
                </div>
              </div>
            </div>
          </article>
        </section>

        {/* ================= Table Card ================= */}
        <div className="rounded-xl bg-card p-4 md:p-6 shadow-md overflow-hidden">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Asset & Site 
              </h2>
              <p className="text-sm text-indigo-500">
                Network Equipment Inventory
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="flex h-10 items-center gap-2 rounded-full bg-muted px-4 text-sm text-muted-foreground">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 text-muted-foreground" />
                )}
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setCurrentPage(1);
                  }}
                  onKeyDown={(e) => {
                    // Prevent form submission or page reload on Enter
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }}
                  placeholder="Search devices..."
                  className={`bg-transparent outline-none ${loading ? "opacity-70" : ""}`}
                />
              </div>

              {/* Device Role Filter */}
              <select
                value={filterDeviceRole}
                onChange={(e) => {
                  setFilterDeviceRole(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 rounded-full border bg-card px-4 text-sm shadow-sm"
                disabled={loading}
              >
                <option value="all">All Device Roles</option>
                {deviceRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              {/* Site Filter */}
              <select
                value={filterSite}
                onChange={(e) => {
                  setFilterSite(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 rounded-full border bg-card px-4 text-sm shadow-sm"
                disabled={loading}
              >
                <option value="all">All Sites</option>
                {sites.map((site) => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>

              {/* Reset Filters Button */}
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm shadow-sm hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto w-full -mx-4 md:mx-0">
            <table className="w-full text-xs min-w-full">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th
                    className="cursor-pointer px-2 md:px-3 py-3 text-center align-middle hover:bg-muted whitespace-nowrap w-[70px] md:w-[80px]"
                    onClick={() => handleSort("deviceId")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Device ID
                      <SortIcon field="deviceId" />
                    </div>
                  </th>
                  <th className="px-2 md:px-3 py-3 text-center align-middle min-w-[150px] md:min-w-[200px]">Device Name</th>
                  <th className="px-2 md:px-3 py-3 text-center align-middle whitespace-nowrap w-[60px] md:w-[70px]">Role</th>
                  <th
                    className="cursor-pointer px-2 md:px-3 py-3 text-center align-middle hover:bg-muted min-w-[120px] md:min-w-[180px]"
                    onClick={() => handleSort("site")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Site
                      <SortIcon field="site" />
                    </div>
                  </th>
                  <th className="px-2 md:px-3 py-3 text-center align-middle whitespace-nowrap hidden lg:table-cell w-[80px] md:w-[100px]">Location</th>
                  <th
                    className="cursor-pointer px-2 md:px-3 py-3 text-center align-middle hover:bg-muted whitespace-nowrap w-[90px] md:w-auto"
                    onClick={() => handleSort("lastPM")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Last PM
                      <SortIcon field="lastPM" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer px-2 md:px-3 py-3 text-center align-middle hover:bg-muted whitespace-nowrap w-[90px] md:w-auto"
                    onClick={() => handleSort("nextPM")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Next PM
                      <SortIcon field="nextPM" />
                    </div>
                  </th>
                  <th className="px-1 md:px-2 py-3 text-center align-middle whitespace-nowrap w-[60px] md:w-[72px]">Status</th>
                  <th className="px-1 md:px-2 py-3 text-center align-middle whitespace-nowrap w-[50px] md:w-[72px]"></th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-2 md:px-3 py-4 text-center text-muted-foreground">
                      Loading devices...
                    </td>
                  </tr>
                ) : paginatedDevices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-2 md:px-3 py-4 text-center text-muted-foreground">
                      No devices found matching your criteria
                    </td>
                  </tr>
                ) : (
                  paginatedDevices.map((device) => {
                    const DeviceIcon = getDeviceRoleIcon(device.deviceRole);
                    const daysUntilPM = getDaysUntilPM(device.nextPM);
                    const isPMOverdue = daysUntilPM !== null && daysUntilPM < 0;
                    const isPMDueSoon = daysUntilPM !== null && daysUntilPM >= 0 && daysUntilPM <= 7;

                    return (
                      <tr
                        key={device.deviceId}
                        className="border-t hover:bg-muted transition-colors"
                      >
                        <td className="px-2 md:px-3 py-3 align-middle text-center font-medium text-indigo-600 whitespace-nowrap">
                          {device.deviceId}
                        </td>
                        <td className="px-2 md:px-3 py-3 align-middle">
                          <div className="flex items-center gap-2 min-w-0">
                            <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">{device.deviceName?.split('/')[0]?.trim() || device.deviceName}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{device.model} / {device.serialNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 md:px-3 py-3 align-middle text-center">
                          <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 whitespace-nowrap">
                            {device.deviceRole}
                          </span>
                        </td>
                        <td className="px-2 md:px-3 py-3 align-middle">
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="line-clamp-2 break-words">{device.site}</span>
                          </div>
                        </td>
                        <td className="px-2 md:px-3 py-3 align-middle text-muted-foreground hidden lg:table-cell">
                          <span className="line-clamp-2 break-words block">{device.location || 'N/A'}</span>
                        </td>
                        <td className="px-2 md:px-3 py-3 align-middle text-center whitespace-nowrap">
                          {device.lastPM ? (
                            <span className="text-muted-foreground">{formatDate(device.lastPM)}</span>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
                          )}
                        </td>
                        <td className="px-2 md:px-3 py-3 align-middle text-center">
                          {device.nextPM ? (
                            <div className="flex flex-col items-center">
                              <span
                                className={`whitespace-nowrap ${
                                  isPMOverdue
                                    ? "font-semibold text-red-600"
                                    : isPMDueSoon
                                    ? "font-semibold text-orange-600"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {formatDate(device.nextPM)}
                              </span>
                              {daysUntilPM !== null && (
                                <span
                                  className={`text-[11px] ${
                                    isPMOverdue
                                      ? "text-red-500"
                                      : isPMDueSoon
                                      ? "text-orange-500"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {isPMOverdue
                                    ? `${Math.abs(daysUntilPM)}d overdue`
                                    : daysUntilPM === 0
                                    ? "Due today"
                                    : `${daysUntilPM}d left`}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not scheduled</span>
                          )}
                        </td>
                        <td className="px-1 md:px-2 py-3 align-middle text-center">
                          <span
                            className={`inline-block rounded-full px-1.5 py-0.5 text-[11px] ${getStatusColor(device.status)} whitespace-nowrap`}
                          >
                            {device.status}
                          </span>
                        </td>
                        <td className="px-1 md:px-2 py-3 align-middle text-center">
                          <button
                            onClick={() => {
                              setSelectedDevice(device);
                              setShowPMHistory(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-600 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                          >
                            <History className="h-2.5 w-2.5" />
                            History
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination — สไตล์เดียวกับหน้า contract_editer */}
          {totalItems > ITEMS_PER_PAGE && (
            <div className="mt-4 -mx-4 md:-mx-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border bg-muted py-3 px-4 md:px-6">
              <span className="text-sm text-muted-foreground">
                Show {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} from {totalItems} list
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={16} /> Previous Page
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage >= totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-card border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next Page <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PM History Modal - ใช้ Portal ให้ popup อยู่บนสุดและกด backdrop ปิดได้ */}
        {showPMHistory && selectedDevice && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              setShowPMHistory(false);
              setSelectedDevice(null);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pm-history-title"
          >
            <div
              className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h3 id="pm-history-title" className="text-lg font-semibold text-foreground">
                    PM History - {selectedDevice.deviceId}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedDevice.deviceName} • {selectedDevice.site}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPMHistory(false);
                    setSelectedDevice(null);
                  }}
                  className="rounded-lg p-2 hover:bg-muted"
                  aria-label="ปิด"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto px-6 py-4">
                {selectedDevice.pmHistory.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No PM history available for this device
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDevice.pmHistory.map((pm) => (
                      <div
                        key={pm.id}
                        className="rounded-lg border border-border p-4 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-foreground">
                                {formatDate(pm.date)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-1 text-xs ${
                                  pm.status === "Done"
                                    ? "bg-green-100 text-green-700"
                                    : pm.status === "In Progress"
                                    ? "bg-blue-100 text-blue-700"
                                    : pm.status === "Failed"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {pm.status}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Technician: {pm.technician}
                            </p>
                            {pm.notes && (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {pm.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t px-6 py-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Device Role:</span>
                    <span className="ml-2 font-medium">{selectedDevice.deviceRole}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vendor:</span>
                    <span className="ml-2 font-medium">{selectedDevice.vendor}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model:</span>
                    <span className="ml-2 font-medium">{selectedDevice.model}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Serial Number:</span>
                    <span className="ml-2 font-medium">{selectedDevice.serialNumber}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </main>
    </SidebarLayout>
  );
};

export default AssetSiteDatabase;
