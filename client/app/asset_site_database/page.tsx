"use client";

import React, { useMemo, useState, useEffect } from "react";
import { LucideIcon, Server, Network, Shield, HardDrive, Zap, Radio, ChevronDown, ChevronUp, Search, Filter, X, Calendar, MapPin, History } from "lucide-react";
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

/* ================= Summary Cards ================= */
interface SummaryCard {
  label: string;
  value: string;
  icon: LucideIcon;
  growth?: string;
}

// Summary cards will be calculated from API data
const ITEMS_PER_PAGE = 10;

/* ================= Helper Functions ================= */
const formatDate = (dateString: string | null) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
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
      return "bg-gray-100 text-gray-700";
    case "Maintenance":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const AssetSiteDatabase = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<"deviceId" | "site" | "lastPM" | "nextPM">("deviceId");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [filterDeviceRole, setFilterDeviceRole] = useState<string>("all");
  const [filterSite, setFilterSite] = useState<string>("all");
  const [selectedDevice, setSelectedDevice] = useState<AssetDevice | null>(null);
  const [showPMHistory, setShowPMHistory] = useState(false);
  const [devices, setDevices] = useState<AssetDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    totalDevices: 0,
    activeDevices: 0,
    upcomingPM: 0
  });

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
        
        console.log('API Response:', response);
        console.log('Response type:', typeof response);
        console.log('Response keys:', response ? Object.keys(response) : 'null');
        
        if (response && response.success !== false && response.data) {
          console.log(`Loaded ${response.data.length} devices`);
          setDevices(response.data);
          if (response.statistics) {
            setStatistics(response.statistics);
          }
        } else {
          const errorResponse = response as any;
          console.warn('API returned unsuccessful response:', response);
          console.warn('Response details:', {
            success: errorResponse?.success,
            hasData: !!errorResponse?.data,
            message: errorResponse?.message,
            error: errorResponse?.error
          });
          // Set empty array but don't treat as critical error
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

    // Debounce search to avoid too many API calls
    const timeoutId = setTimeout(() => {
      loadDevices();
    }, searchTerm ? 300 : 0);

    return () => clearTimeout(timeoutId);
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
  // Devices are already filtered by API, but we can do additional client-side filtering if needed
  const filteredDevices = useMemo(() => {
    return devices;
  }, [devices]);

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
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hasActiveFilters = filterDeviceRole !== "all" || filterSite !== "all" || searchTerm !== "";

  return (
    <SidebarLayout>
      <DashboardHeader />

      <main className="mx-auto w-full max-w-full space-y-6 px-4 md:px-6 lg:px-8 py-6 md:mt-0 mt-16">
        {/* ================= Summary Cards ================= */}
        <section className="grid gap-6 md:grid-cols-3">
          <article className="flex flex-col items-center justify-between rounded-2xl bg-white px-6 py-5 shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500">
                <Server className="h-7 w-7 text-blue-900" />
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">
                  TOTAL DEVICES
                </p>
                <div className="text-3xl font-semibold">
                  {loading ? "..." : statistics.totalDevices}
                </div>
              </div>
            </div>
          </article>

          <article className="flex flex-col items-center justify-between rounded-2xl bg-white px-6 py-5 shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500">
                <Network className="h-7 w-7 text-blue-900" />
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">
                  ACTIVE DEVICES
                </p>
                <div className="text-3xl font-semibold">  
                  {loading ? "..." : statistics.activeDevices}
                </div>
              </div>
            </div>
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-600">
              98% uptime
            </span>
          </article>

          <article className="flex flex-col items-center justify-between rounded-2xl bg-white px-6 py-5 shadow-md">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500">
                <Calendar className="h-7 w-7 text-blue-900" />
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">
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
        <div className="rounded-xl bg-white p-4 md:p-6 shadow-md overflow-hidden">
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Asset & Site Database
              </h2>
              <p className="text-sm text-indigo-500">
                Network Equipment Inventory
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="flex h-10 items-center gap-2 rounded-full bg-gray-100 px-4 text-sm text-gray-500">
                <Search className="h-4 w-4" />
                <input
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search devices..."
                  className="bg-transparent outline-none"
                  disabled={loading}
                />
              </div>

              {/* Device Role Filter */}
              <select
                value={filterDeviceRole}
                onChange={(e) => {
                  setFilterDeviceRole(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 rounded-full border bg-white px-4 text-sm shadow-sm"
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
                className="h-10 rounded-full border bg-white px-4 text-sm shadow-sm"
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
                  className="flex h-10 items-center gap-2 rounded-full border bg-white px-4 text-sm shadow-sm hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-xs table-fixed" style={{ minWidth: '800px' }}>
              <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                <tr>
                  <th
                    className="cursor-pointer px-1.5 py-1.5 text-center hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleSort("deviceId")}
                    style={{ width: '80px' }}
                  >
                    <div className="flex items-center gap-1">
                      Device ID
                      <SortIcon field="deviceId" />
                    </div>
                  </th>
                  <th className="px-2 py-1.5 text-center" style={{ width: '150px', minWidth: '100px' }}>Device Name</th>
                  <th className="px-1 py-1.5 text-center whitespace-nowrap" style={{ width: '80px', minWidth: '70px' }}>Role</th>
                  <th
                    className="cursor-pointer px-2 py-1.5 text-center hover:bg-gray-100"
                    onClick={() => handleSort("site")}
                    style={{ width: '250px', minWidth: '200px' }}
                  >
                    <div className="flex items-center gap-1">
                      Site
                      <SortIcon field="site" /> 
                    </div>
                  </th>
                  <th className="px-2 py-1.5 text-center whitespace-nowrap hidden lg:table-cell" style={{ width: '150px', minWidth: '120px' }}>Location</th>
                  <th
                    className="cursor-pointer px-2 py-1.5 text-center hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleSort("lastPM")}
                  >
                    <div className="flex items-center gap-1">
                      Last PM
                      <SortIcon field="lastPM" />
                    </div>
                  </th>
                  <th
                    className="cursor-pointer px-2 py-1.5 text-center hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleSort("nextPM")}
                  >
                    <div className="flex items-center gap-1">
                      Next PM
                      <SortIcon field="nextPM" />
                    </div>
                  </th>
                  <th className="px-2 py-1.5 text-center whitespace-nowrap">Status</th>
                  <th className="px-2 py-1.5 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-2 py-4 text-center text-gray-500">
                      Loading devices...
                    </td>
                  </tr>
                ) : paginatedDevices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-2 py-4 text-center text-gray-500">
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
                        className="border-t hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-1 py-1.5 font-medium text-indigo-600 whitespace-nowrap" style={{ width: '30px' }}>
                          {device.deviceId}
                        </td>
                        <td className="px-1 py-1.5" style={{ width: '200px', minWidth: '150px' }}>
                          <div className="flex items-start gap-1">
                            <DeviceIcon className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">   {device.deviceName?.split('/')[0]?.trim() || device.deviceName}</span>
                            
                              <span className="text-xs text-gray-500 truncate">
                                {device.model} / {device.serialNumber}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-1 py-1.5" style={{ width: '80px', minWidth: '70px' }}>
                          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700 whitespace-nowrap">
                            {device.deviceRole}
                          </span>
                        </td>
                        <td className="px-2 py-1.5" style={{ width: '250px', minWidth: '200px' }}>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5 text-gray-400 flex-shrink-0" />
                            <span className="break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{device.site}</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 hidden lg:table-cell" style={{ width: '150px', minWidth: '120px', maxWidth: '200px' }}>
                          <span className="block break-words overflow-wrap-anywhere line-clamp-2" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                            {
                             device.location || 'N/A'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {device.lastPM ? (
                            <span className="text-gray-700">
                              {formatDate(device.lastPM)}
                            </span>
                          ) : (
                            <span className="text-gray-400">Never</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {device.nextPM ? (
                            <div className="flex flex-col">
                              <span
                                className={`whitespace-nowrap ${
                                  isPMOverdue
                                    ? "font-semibold text-red-600"
                                    : isPMDueSoon
                                    ? "font-semibold text-orange-600"
                                    : "text-gray-700"
                                }`}
                              >
                                {formatDate(device.nextPM)}
                              </span>
                              {daysUntilPM !== null && (
                                <span
                                  className={`text-xs ${
                                    isPMOverdue
                                      ? "text-red-500"
                                      : isPMDueSoon
                                      ? "text-orange-500"
                                      : "text-gray-400"
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
                            <span className="text-gray-400">Not scheduled</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-xs ${getStatusColor(
                              device.status
                            )} whitespace-nowrap`}
                          >
                            {device.status}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => {
                              setSelectedDevice(device);
                              setShowPMHistory(true);
                            }}
                            className="flex items-center gap-1 rounded-lg bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600 hover:bg-indigo-100 transition-colors whitespace-nowrap"
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

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
            <span>
              Showing {startIndex + 1}–
              {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of{" "}
              {totalItems}
            </span>

            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`h-8 w-8 rounded-lg border ${
                  currentPage === 1
                    ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`h-8 w-8 rounded-lg ${
                      page === currentPage
                        ? "bg-indigo-500 text-white"
                        : "border bg-white hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className={`h-8 w-8 rounded-lg border ${
                  currentPage === totalPages
                    ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* PM History Modal */}
        {showPMHistory && selectedDevice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-6 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    PM History - {selectedDevice.deviceId}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {selectedDevice.deviceName} • {selectedDevice.site}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPMHistory(false);
                    setSelectedDevice(null);
                  }}
                  className="rounded-lg p-2 hover:bg-gray-100"
                >
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto px-6 py-4">
                {selectedDevice.pmHistory.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    No PM history available for this device
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedDevice.pmHistory.map((pm) => (
                      <div
                        key={pm.id}
                        className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-gray-900">
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
                            <p className="mt-1 text-sm text-gray-600">
                              Technician: {pm.technician}
                            </p>
                            {pm.notes && (
                              <p className="mt-2 text-sm text-gray-500">
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
                    <span className="text-gray-500">Device Role:</span>
                    <span className="ml-2 font-medium">{selectedDevice.deviceRole}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Vendor:</span>
                    <span className="ml-2 font-medium">{selectedDevice.vendor}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Model:</span>
                    <span className="ml-2 font-medium">{selectedDevice.model}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Serial Number:</span>
                    <span className="ml-2 font-medium">{selectedDevice.serialNumber}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </SidebarLayout>
  );
};

export default AssetSiteDatabase;
