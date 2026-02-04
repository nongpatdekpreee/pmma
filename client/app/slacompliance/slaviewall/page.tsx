"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardHeader from "@/components/ui/Header";
import { SidebarLayout } from "@/components/sidebar/SidebarLayout";
import * as XLSX from "xlsx";
import { getSlaContracts } from "@/lib/api";

const ITEMS_PER_PAGE = 8;

const sla_Viewall = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sla, setSla] = useState<Array<{ id: string; vendor: string; site: string; sla_percentage: number; status: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getSlaContracts({ months: 6 });
        if (!cancelled && res?.success && res.data) {
          setSla(
            (res.data.contracts || []).map((c) => ({
              id: c.contract_id,
              vendor: c.vendor,
              site: c.site,
              sla_percentage: Number(c.sla_percentage),
              status: c.status,
            }))
          );
        } else if (!cancelled) {
          setError(res?.message || res?.error || "โหลดข้อมูล SLA ไม่สำเร็จ");
          setSla([]);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "โหลดข้อมูล SLA ไม่สำเร็จ");
          setSla([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSite, setSelectedSite] = useState<string>("Bangkok");
  const [vendorFilter, setVendorFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState<"active" | "all">("all");

  // Get unique sites
  const uniqueSites = useMemo(() => {
    const sites = Array.from(new Set(sla.map((item) => item.site)));
    return sites;
  }, [sla]);

  /* ================= filter ================= */
  const filteredsla = useMemo(() => {
    let filtered = sla;

    // Filter by site
    if (selectedSite) {
      filtered = filtered.filter((item) => item.site === selectedSite);
    }

    // Filter by vendor
    if (vendorFilter) {
      filtered = filtered.filter((item) =>
        item.vendor.toLowerCase().includes(vendorFilter.toLowerCase())
      );
    }

    // Filter by search term
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.id.toLowerCase().includes(q) ||
          item.vendor.toLowerCase().includes(q) ||
          item.site.toLowerCase().includes(q) ||
          String(item.sla_percentage).includes(q) ||
          item.status.toLowerCase().includes(q)
      );
    }

    // Filter by active tab (if active tab is selected, show only Active status)
    if (activeTab === "active") {
      filtered = filtered.filter((item) => item.status === "Active");
    }

    return filtered;
  }, [sla, selectedSite, vendorFilter, searchTerm, activeTab]);

  /* ================= sort ================= */
  const sortedsla = useMemo(() => {
    const copy = [...filteredsla];
    copy.sort((a, b) => {
      if (sortOrder === "desc") {
        return b.sla_percentage - a.sla_percentage;
      } else {
        return a.sla_percentage - b.sla_percentage;
      }
    });
    return copy;
  }, [filteredsla, sortOrder]);

  /* ================= pagination ================= */
  const totalItems = sortedsla.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedsla = sortedsla.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pass":
        return "bg-green-100 text-green-700";
      case "Partial":
        return "bg-yellow-100 text-yellow-700";
      case "Miss":
        return "bg-red-100 text-red-700";
      case "Active":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-500 text-white";
    }
  };

  const getSlaPercentageColor = (percentage: number) => {
    if (percentage >= 90) {
      return "bg-green-100 text-green-700";
    } else if (percentage >= 80) {
      return "bg-yellow-100 text-yellow-700";
    } else {
      return "bg-red-100 text-red-700";
    }
  };
 

  const handleExport = () => {
    // Prepare data for export
    const exportData = sortedsla.map((item) => ({
      "Contract ID": item.id,
      Vendor: item.vendor,
      Site: item.site,
      "SLA %": item.sla_percentage,
      Status: item.status,
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Set column widths
    const colWidths = [
      { wch: 15 }, // Contract ID
      { wch: 12 }, // Vendor
      { wch: 15 }, // Site
      { wch: 10 }, // SLA %
      { wch: 12 }, // Status
    ];
    ws["!cols"] = colWidths;

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SLA Compliance");

    // Generate filename with current date
    const date = new Date();
    const dateStr = date.toISOString().split("T")[0];
    const filename = `SLA_Compliance_${dateStr}.xlsx`;

    // Export file
    XLSX.writeFile(wb, filename);
  };


  return (
    <SidebarLayout>
      <DashboardHeader />

        <main className="mx-auto w-full max-w-6xl space-y-6 px-8 py-6">
          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900">
            SLA Compliance by Contract
          </h1>

          {/* ================= Filters ================= */}
          <div className="rounded-2xl bg-white p-6 shadow-md">
            <div className="flex flex-wrap items-center gap-4">
              {/* SITE Dropdown */}
              <div className="flex flex-col">
                <label className="mb-1 text-sm font-medium text-gray-700">
                  SITE
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSite}
                    onChange={(e) => {
                      setSelectedSite(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {uniqueSites.map((site) => (
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}
                  </select>
                  
                </div>
              </div>

              {/* Vendor Input */}
              <div className="flex flex-col">
                <label className="mb-1 text-sm font-medium text-gray-700">
                  Vendor
                </label>
                <input
                  type="text"
                  value={vendorFilter}
                  onChange={(e) => {
                    setVendorFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Vendor"
                  className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Export Button */}
              <div className="ml-auto flex items-end">
                <button
                  onClick={handleExport}
                  className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                >
                  + Export
                </button>
              </div>
            </div>
          </div>

          {/* ================= Table Card ================= */}
          <div className="rounded-2xl bg-white p-6 shadow-md">
            {/* Tabs */}
            <div className="mb-6 flex gap-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab("active")}
                className={`px-4 pb-2 text-sm font-medium transition-colors ${
                  activeTab === "active"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Active Tasks
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 pb-2 text-sm font-medium transition-colors ${
                  activeTab === "all"
                    ? "border-b-2 border-blue-600 text-blue-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All Contract
              </button>
            </div>

            {/* Header */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {activeTab === "all" ? "All Contract" : "Active Tasks"}
                </h2>
                <p className="text-sm text-indigo-500">Active Members</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 items-center gap-2 rounded-full bg-gray-100 px-4 text-sm text-gray-500">
                  🔍
                  <input
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search"
                    className="bg-transparent outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Sort by:</span>
                  <select
                    value={sortOrder}
                    onChange={(e) =>
                      setSortOrder(e.target.value as "asc" | "desc")
                    }
                    className="h-10 rounded-lg border bg-white px-4 text-sm text-gray-700 shadow-sm"
                  >
                    <option value="desc">SLA Level (High to Low)</option>
                    <option value="asc">SLA Level (Low to High)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-6 py-4 text-center">Contract ID</th>
                    <th className="px-6 py-4 text-center">Vendor</th>
                    <th className="px-6 py-4 text-center">Site</th>
                    <th className="px-6 py-4 text-center">SLA %</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedsla.map((devices) => (
                    <tr
                      key={devices.id}
                      className="border-t hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 text-center">
                        {devices.id}
                      </td>
                      <td className="px-6 py-4 text-center font-medium">
                        {devices.vendor}
                      </td>
                      <td className="px-6 py-4 text-center">{devices.site}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getSlaPercentageColor(
                            devices.sla_percentage
                          )}`}
                        >
                          {devices.sla_percentage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                            devices.status
                          )}`}
                        >
                          {devices.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
              <span>
                Showing data {startIndex + 1} to{" "}
                {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of{" "}
                {totalItems} site
              </span>

              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(
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
                {totalPages > 10 && <span className="px-2">...</span>}
              </div>
            </div>
          </div>
        </main>
    </SidebarLayout>
  );
};

export default sla_Viewall;
