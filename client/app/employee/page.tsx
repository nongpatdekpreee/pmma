"use client";

import React, { useMemo, useState, useEffect } from "react";
import { LucideIcon, UserCheck, UserRoundCog, Wrench, Search, UserPlus, X, FileUp } from "lucide-react";
import { apiUrl, createEmployee, importEmployees } from "@/lib/api";
import DashboardHeader from "@/components/ui/Header";
import { SidebarLayout } from "@/components/sidebar/SidebarLayout";   

/* ================= summary ================= */
interface SummaryEM {
  label: string;
  value: string;
  icon: LucideIcon;
  growth?: string;
}

const ITEMS_PER_PAGE = 8;

interface Employee {
  id: string;
  name: string;
  gmail: string;
  tel: string;
  positionType: string;
  employmentType: string;
}

const extractNumber = (id: string) =>
  Number(id.replace(/\D/g, ""));

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] =
    useState<"newest" | "oldest">("newest");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    gmail: "",
    tel: "",
    positionType: "Technical" as "Technical" | "Management",
    employmentType: "Full-Time",
  });
  const [addModalTab, setAddModalTab] = useState<"form" | "import">("form");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<Array<{ name: string; gmail: string; tel: string; positionType: string; employmentType: string }>>([]);
  const [importSaving, setImportSaving] = useState(false);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const url = apiUrl('/api/employees?limit=1000');
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.success && data.data && Array.isArray(data.data)) {
        setEmployees(data.data);
      } else {
        setEmployees([]);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.gmail.trim() || !addForm.tel.trim()) {
      alert("กรุณากรอก Name, Gmail และ Phone ให้ครบ");
      return;
    }
    setAddSaving(true);
    try {
      const res = await createEmployee({
        name: addForm.name.trim(),
        gmail: addForm.gmail.trim(),
        tel: addForm.tel.trim(),
        positionType: addForm.positionType,
        employmentType: addForm.employmentType,
      });
      if (res.success) {
        setAddModalOpen(false);
        setAddForm({ name: "", gmail: "", tel: "", positionType: "Technical", employmentType: "Full-Time" });
        await fetchEmployees();
        alert("เพิ่มพนักงานสำเร็จ");
      } else {
        alert(res.message || "เพิ่มพนักงานไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setAddSaving(false);
    }
  };

  // Parse CSV: คาดหวัง header name,gmail,tel,positionType,employmentType (หรือไม่มี header ก็ใช้คอลัมน์ตามลำดับ)
  const parseCSV = (text: string): Array<{ name: string; gmail: string; tel: string; positionType: string; employmentType: string }> => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const rows: Array<{ name: string; gmail: string; tel: string; positionType: string; employmentType: string }> = [];
    const first = lines[0].toLowerCase();
    const hasHeader = first.includes("name") && (first.includes("gmail") || first.includes("email"));
    const start = hasHeader ? 1 : 0;
    for (let i = start; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.replace(/^"|"$/g, "").trim());
      const name = parts[0] ?? "";
      const gmail = parts[1] ?? "";
      const tel = parts[2] ?? "";
      const positionType = (parts[3] ?? "Technical").trim() || "Technical";
      const employmentType = (parts[4] ?? "Full-Time").trim() || "Full-Time";
      if (name || gmail || tel) rows.push({ name, gmail, tel, positionType, employmentType });
    }
    return rows;
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportRows([]);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setImportRows(parseCSV(text));
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImportSubmit = async () => {
    if (importRows.length === 0) {
      alert("ไม่มีข้อมูลที่จะ Import กรุณาเลือกไฟล์ CSV");
      return;
    }
    const valid = importRows.filter((r) => r.name.trim() && r.gmail.trim() && r.tel.trim());
    if (valid.length === 0) {
      alert("ไม่มีแถวที่ครบ name, gmail, tel");
      return;
    }
    setImportSaving(true);
    try {
      const res = await importEmployees(
        valid.map((r) => ({
          name: r.name.trim(),
          gmail: r.gmail.trim(),
          tel: r.tel.trim(),
          positionType: r.positionType || "Technical",
          employmentType: r.employmentType || "Full-Time",
        }))
      );
      if (res.success && res.data) {
        setAddModalOpen(false);
        setAddModalTab("form");
        setImportFile(null);
        setImportRows([]);
        await fetchEmployees();
        alert(res.message || `Import สำเร็จ: สร้าง ${res.data.created} คน${res.data.failed ? `, ล้มเหลว ${res.data.failed}` : ""}`);
      } else {
        alert(res.message || "Import ไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setImportSaving(false);
    }
  };

  /* ================= filter ================= */
  const filteredEmployees = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        (emp.name ?? '').toLowerCase().includes(q) ||
        (emp.gmail ?? '').toLowerCase().includes(q) ||
        (emp.tel ?? '').toLowerCase().includes(q) ||
        (emp.employmentType ?? '').toLowerCase().includes(q) ||
        (emp.id ?? '').toLowerCase().includes(q)
    );
  }, [searchTerm, employees]);

  /* ================= sort ================= */
  const sortedEmployees = useMemo(() => {
    const copy = [...filteredEmployees];
    copy.sort((a, b) => {
      const idA = extractNumber(a.id);
      const idB = extractNumber(b.id);
      return sortOrder === "newest" ? idB - idA : idA - idB;
    });
    return copy;
  }, [filteredEmployees, sortOrder]);

  /* ================= pagination ================= */
  const totalItems = sortedEmployees.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedEmployees = sortedEmployees.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const getEmploymentTypeColor = (type: string) => {
    const normalizedType = type?.toLowerCase() || '';
    if (normalizedType.includes('full')) {
      return "bg-green-100 text-green-700";
    } else if (normalizedType.includes('contract')) {
      return "bg-blue-100 text-blue-700";
    } else if (normalizedType.includes('part')) {
      return "bg-yellow-100 text-yellow-700";
    }
    return "bg-gray-100 text-gray-700";
  };

  const getPositionTypeColor = (type: string) =>
    type === "Management"
      ? "bg-purple-100 text-purple-700"
      : "bg-gray-100 text-gray-700";

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const total = employees.length;
    const technical = employees.filter(emp => emp.positionType === 'Technical').length;
    const management = employees.filter(emp => emp.positionType === 'Management').length;
    
    return {
      total: total.toString(),
      technical: technical.toString(),
      management: management.toString(),
    };
  }, [employees]);

  const SUMMARY_CARDS_EM: SummaryEM[] = [
    { label: "TOTAL EMPLOYEES", value: summaryStats.total, icon: UserCheck },
    { label: "TECHNICAL", value: summaryStats.technical, icon: UserRoundCog },
    { label: "MANAGEMENT", value: summaryStats.management, icon: Wrench },
  ];

  return (
    <SidebarLayout>
      <DashboardHeader />

      <main className="mx-auto w-full max-w-6xl space-y-6 px-8 py-6 md:mt-0 mt-16">
          {/* ================= Summary Cards ================= */}
          <section className="grid gap-6 md:grid-cols-3">
            {SUMMARY_CARDS_EM.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.label}
                  className="flex flex-col items-center justify-between rounded-2xl bg-white px-6 py-5 shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-500">
                      <Icon className="h-7 w-7 text-blue-900" />
                    </div>
                    <div>
                      <p className="text-xs uppercase text-gray-400">
                        {card.label}
                      </p>
                      <div className="text-3xl font-semibold">
                        {loading ? "..." : card.value}
                      </div>
                    </div>
                  </div>

                  {card.growth && (
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs text-green-600">
                      {card.growth}
                    </span>
                  )}
                </article>
              );
            })}
          </section>

          {/* ================= Table Card ================= */}
          <div className="rounded-2xl bg-white p-6 shadow-md">
            {/* Header */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  All Employees
                </h2>
                <p className="text-sm text-indigo-500">
                  Active Members
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-10 items-center gap-2 rounded-full bg-gray-100 px-4 text-sm text-gray-500">
                  <Search size={18} className="text-gray-400 flex-shrink-0" />
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
                <button
                  type="button"
                  onClick={() => { setAddModalOpen(true); setAddModalTab("form"); setImportFile(null); setImportRows([]); }}
                  className="flex h-10 items-center gap-2 rounded-full bg-indigo-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
                >
                  <UserPlus size={18} />
                  Add Employee
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-400">???????????????...</div>
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                    <tr>
                      <th className="px-6 py-4 text-center">ID</th>
                      <th className="px-6 py-4 text-center">Username</th>
                      <th className="px-6 py-4 text-center">Gmail</th>
                      <th className="px-6 py-4 text-center">Phone</th>
                      <th className="px-6 py-4 text-center">Type</th>
                      <th className="px-6 py-4 text-center">Employment</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                          ??????????? Employee
                        </td>
                      </tr>
                    ) : (
                      paginatedEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="px-6 py-4">{emp.id}</td>
                          <td className="px-6 py-4 font-medium">
                            {emp.name ?? '-'}
                          </td>
                          <td className="px-6 py-4">{emp.gmail || '-'}</td>
                          <td className="px-6 py-4">{emp.tel || '-'}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs ${getPositionTypeColor(
                                emp.positionType
                              )}`}
                            >
                              {emp.positionType}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs ${getEmploymentTypeColor(
                                emp.employmentType
                              )}`}
                            >
                              {emp.employmentType}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
              <span>
                Showing {startIndex + 1}-
                {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of{" "}
                {totalItems}
              </span>

              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 rounded-lg ${
                        page === currentPage
                          ? "bg-indigo-500 text-white"
                          : "border bg-white"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Add Employee Modal */}
          {addModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => !addSaving && !importSaving && setAddModalOpen(false)} />
              <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="mb-4 flex items-center justify-between flex-shrink-0">
                  <h3 className="text-lg font-semibold text-gray-900">Add Employee</h3>
                  <button
                    type="button"
                    onClick={() => !addSaving && !importSaving && setAddModalOpen(false)}
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex gap-2 mb-4 border-b border-gray-200 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setAddModalTab("form")}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg ${addModalTab === "form" ? "bg-indigo-50 text-indigo-600 border-b-2 border-indigo-500" : "text-gray-500 hover:bg-gray-50"}`}
                  >
                    Add one
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddModalTab("import")}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg flex items-center gap-1.5 ${addModalTab === "import" ? "bg-indigo-50 text-indigo-600 border-b-2 border-indigo-500" : "text-gray-500 hover:bg-gray-50"}`}
                  >
                    <FileUp size={16} />
                    Import
                  </button>
                </div>
                {addModalTab === "form" && (
                <form onSubmit={handleAddSubmit} className="space-y-4 overflow-y-auto">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="ชื่อ-นามสกุล"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Gmail *</label>
                    <input
                      type="email"
                      value={addForm.gmail}
                      onChange={(e) => setAddForm((f) => ({ ...f, gmail: e.target.value }))}
                      placeholder="example@gmail.com"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Phone *</label>
                    <input
                      type="tel"
                      value={addForm.tel}
                      onChange={(e) => setAddForm((f) => ({ ...f, tel: e.target.value }))}
                      placeholder="เบอร์โทรศัพท์"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Position Type</label>
                    <select
                      value={addForm.positionType}
                      onChange={(e) => setAddForm((f) => ({ ...f, positionType: e.target.value as "Technical" | "Management" }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Technical">Technical</option>
                      <option value="Management">Management</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Employment Type</label>
                    <select
                      value={addForm.employmentType}
                      onChange={(e) => setAddForm((f) => ({ ...f, employmentType: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Full-Time">Full-Time</option>
                      <option value="Contract">Contract</option>
                      <option value="Part-Time">Part-Time</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => !addSaving && setAddModalOpen(false)}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addSaving}
                      className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
                    >
                      <UserPlus size={16} />
                      {addSaving ? "กำลังบันทึก..." : "Add Employee"}
                    </button>
                  </div>
                </form>
                )}
                {addModalTab === "import" && (
                  <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
                    <p className="text-sm text-gray-500">
                      อัปโหลดไฟล์ CSV มีคอลัมน์: name, gmail, tel, positionType, employmentType (บรรทัดแรกเป็น header ได้)
                    </p>
                    <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-6 cursor-pointer hover:bg-gray-100">
                      <FileUp size={28} className="text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">เลือกไฟล์ CSV</span>
                      <input
                        type="file"
                        accept=".csv,.txt"
                        onChange={handleImportFileChange}
                        className="hidden"
                      />
                    </label>
                    {importFile && <p className="text-xs text-gray-500 truncate w-full">ไฟล์: {importFile.name}</p>}
                    {importRows.length > 0 && (
                      <>
                        <p className="text-sm font-medium text-gray-700">Preview ({importRows.length} แถว)</p>
                        <div className="border border-gray-200 rounded-xl overflow-auto max-h-40">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left">Name</th>
                                <th className="px-3 py-2 text-left">Gmail</th>
                                <th className="px-3 py-2 text-left">Tel</th>
                                <th className="px-3 py-2 text-left">Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importRows.slice(0, 10).map((r, i) => (
                                <tr key={i} className="border-t border-gray-100">
                                  <td className="px-3 py-1.5">{r.name || "-"}</td>
                                  <td className="px-3 py-1.5">{r.gmail || "-"}</td>
                                  <td className="px-3 py-1.5">{r.tel || "-"}</td>
                                  <td className="px-3 py-1.5">{r.positionType} / {r.employmentType}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {importRows.length > 10 && <p className="px-3 py-2 text-gray-400 text-xs">... และอีก {importRows.length - 10} แถว</p>}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => !importSaving && setAddModalOpen(false)}
                            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleImportSubmit}
                            disabled={importSaving}
                            className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
                          >
                            <FileUp size={16} />
                            {importSaving ? "กำลัง Import..." : `Import ${importRows.filter((r) => r.name.trim() && r.gmail.trim() && r.tel.trim()).length} คน`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
    </SidebarLayout>
  );
};

export default EmployeeManagement;
