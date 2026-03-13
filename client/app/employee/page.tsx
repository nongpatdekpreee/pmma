"use client";

import React, { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { LucideIcon, UserCheck, UserRoundCog, Wrench, Search, UserPlus, X, FileUp, Edit, Trash2, Download } from "lucide-react";
import { apiUrl, getEmployees, createEmployee, importEmployees, uploadEmployeePhoto, updateEmployee, deleteEmployee } from "@/lib/api";
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
  photo?: string | null;
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
    photo: null as string | null,
  });
  const [addPhotoFile, setAddPhotoFile] = useState<File | null>(null);
  const [addPhotoUploading, setAddPhotoUploading] = useState(false);
  const [addModalTab, setAddModalTab] = useState<"form" | "import">("form");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<Array<{ name: string; gmail: string; tel: string; positionType: string; employmentType: string }>>([]);
  const [importSaving, setImportSaving] = useState(false);
  const [importParsing, setImportParsing] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    gmail: "",
    tel: "",
    positionType: "Technical" as "Technical" | "Management",
    employmentType: "Full-Time",
    photo: null as string | null,
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editPhotoUploading, setEditPhotoUploading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addFormErrors, setAddFormErrors] = useState<{ name: string; gmail: string; tel: string }>({ name: "", gmail: "", tel: "" });
  const [editFormErrors, setEditFormErrors] = useState<{ name: string; gmail: string; tel: string }>({ name: "", gmail: "", tel: "" });
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await getEmployees({ limit: 1000 });
      if (data.success && data.data && Array.isArray(data.data)) {
        setEmployees(data.data);
        setFetchError(null);
      } else {
        setEmployees([]);
        setFetchError((data.message || data.error) ?? null);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setEmployees([]);
      setFetchError(error instanceof Error ? error.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditForm({
      name: emp.name ?? "",
      gmail: emp.gmail ?? "",
      tel: emp.tel ?? "",
      positionType: (emp.positionType === "Management" ? "Management" : "Technical") as "Technical" | "Management",
      employmentType: emp.employmentType ?? "Full-Time",
      photo: emp.photo ?? null,
    });
    setEditFormErrors({ name: "", gmail: "", tel: "" });
  };

  const handleEditPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      if (file) alert("Please select an image file (jpg, png, gif, webp)");
      return;
    }
    setEditPhotoUploading(true);
    try {
      const uploadRes = await uploadEmployeePhoto(file);
      if (uploadRes.success && uploadRes.path) {
        setEditForm((f) => ({ ...f, photo: uploadRes.path ?? null }));
      } else {
        alert(uploadRes.message || "Upload image failed");
      }
    } catch (err) {
      console.error(err);
      alert("Upload image failed");
    } finally {
      setEditPhotoUploading(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!editingEmployee) return;
    if (!confirm(`Delete "${editingEmployee.name}" from the employee list?`)) return;
    setDeleteLoading(true);
    try {
      const res = await deleteEmployee(editingEmployee.id);
      if (res.success) {
        setEditingEmployee(null);
        await fetchEmployees();
        alert("Employee deleted successfully");
      } else {
        alert(res.message || "Delete failed");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    const nameErr = validateEmpName(editForm.name);
    const gmailErr = validateEmpGmail(editForm.gmail);
    const telErr = validateEmpTel(editForm.tel);
    setEditFormErrors({ name: nameErr, gmail: gmailErr, tel: telErr });
    if (nameErr || gmailErr || telErr) return;
    const nameTrim = editForm.name.trim();
    const telTrim = editForm.tel.trim().replace(/\s/g, "");
    const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/png?seed=${editingEmployee.id}`;
    const photoToSend = editForm.photo == null ? defaultAvatar : editForm.photo;
    setEditSaving(true);
    try {
      const res = await updateEmployee(editingEmployee.id, {
        name: nameTrim,
        gmail: editForm.gmail.trim(),
        tel: telTrim,
        positionType: editForm.positionType,
        employmentType: editForm.employmentType,
        // ถ้าลบรูป ให้ส่ง default avatar แทน (รองรับ DB ที่ em_picture = NOT NULL)
        photo: photoToSend,
      });
      if (res.success) {
        setEditingEmployee(null);
        await fetchEmployees();
        alert("Employee updated successfully");
      } else {
        alert(res.message || "Employee update failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating employee");
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      if (file) alert("Please select an image file (jpg, png, gif, webp)");
      return;
    }
    setAddPhotoUploading(true);
    try {
      const uploadRes = await uploadEmployeePhoto(file);
      if (uploadRes.success && uploadRes.path) {
        setAddForm((f) => ({ ...f, photo: uploadRes.path ?? null }));
        setAddPhotoFile(file);
      } else {
        alert(uploadRes.message || "Upload image failed");
      }
    } catch (err) {
      console.error(err);
      alert("Upload image failed");
    } finally {
      setAddPhotoUploading(false);
    }
  };

  const validateEmpName = (val: string): string => {
    const t = val.trim();
    if (!t) return "Name is required.";
    if (!/^[a-zA-Z\u0E00-\u0E7F\s.]+$/.test(t)) return "Name must contain only letters and periods (e.g. Mr.).";
    if (t.length < 10) return "Name must be at least 10 characters.";
    return "";
  };
  const validateEmpGmail = (val: string): string => {
    const t = val.trim();
    if (!t) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Please enter a valid email address.";
    return "";
  };
  const validateEmpTel = (val: string): string => {
    const t = val.replace(/\s/g, "");
    if (!t) return "Phone is required.";
    if (!/^\d+$/.test(t)) return "Phone must contain digits only.";
    if (t.length < 4) return "Phone must be at least 4 digits.";
    if (t.length > 10) return "Phone must be at most 10 digits.";
    return "";
  };

  const validateEmployeeForm = (nameVal: string, gmailVal: string, telVal: string): string | null => {
    const nameErr = validateEmpName(nameVal);
    const gmailErr = validateEmpGmail(gmailVal);
    const telErr = validateEmpTel(telVal);
    if (nameErr || gmailErr || telErr) return nameErr || gmailErr || telErr;
    return null;
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateEmpName(addForm.name);
    const gmailErr = validateEmpGmail(addForm.gmail);
    const telErr = validateEmpTel(addForm.tel);
    setAddFormErrors({ name: nameErr, gmail: gmailErr, tel: telErr });
    if (nameErr || gmailErr || telErr) return;
    const nameTrim = addForm.name.trim();
    const telTrim = addForm.tel.trim().replace(/\s/g, "");
    setAddSaving(true);
    try {
      const res = await createEmployee({
        name: nameTrim,
        gmail: addForm.gmail.trim(),
        tel: telTrim,
        positionType: addForm.positionType,
        employmentType: addForm.employmentType,
        photo: addForm.photo || undefined,
      });
      if (res.success) {
        setAddModalOpen(false);
        setAddForm({ name: "", gmail: "", tel: "", positionType: "Technical", employmentType: "Full-Time", photo: null });
        setAddFormErrors({ name: "", gmail: "", tel: "" });
        setAddPhotoFile(null);
        await fetchEmployees();
        alert("Employee added successfully");
      } else {
        alert(res.message || "Employee add failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding employee");
    } finally {
      setAddSaving(false);
    }
  };

  // Parse CSV: accepts readable headers or no header if columns stay in order
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

  const normalizeHeader = (value: string) => value.toLowerCase().replace(/[\s_-]/g, "");

  const rowsFromSheetData = (jsonData: any[][]): Array<{ name: string; gmail: string; tel: string; positionType: string; employmentType: string }> => {
    if (!jsonData || jsonData.length === 0) return [];
    const rows: Array<{ name: string; gmail: string; tel: string; positionType: string; employmentType: string }> = [];
    const firstRow = (jsonData[0] || []).map((c: any) => String(c ?? "").trim());
    const firstRowLower = firstRow.map((c) => normalizeHeader(c));
    const hasHeader = firstRowLower.some((c) => c === "name") && (firstRowLower.some((c) => c === "gmail") || firstRowLower.some((c) => c === "email"));
    const start = hasHeader ? 1 : 0;

    const nameIdx = hasHeader ? firstRowLower.findIndex((c) => c === "name") : 0;
    const gmailIdx = hasHeader ? firstRowLower.findIndex((c) => c === "gmail" || c === "email") : 1;
    const telIdx = hasHeader ? firstRowLower.findIndex((c) => c === "tel" || c === "phone" || c === "phonenumber") : 2;
    const positionIdx = hasHeader ? firstRowLower.findIndex((c) => c.includes("position") && !c.includes("employment")) : 3;
    const employmentIdx = hasHeader ? firstRowLower.findIndex((c) => /employment/i.test(c.replace(/\s/g, ""))) : 4;

    const safe = (row: any[], i: number, d: string) => (i >= 0 && i < (row || []).length ? String(row[i] ?? "").trim() : "") || d;

    for (let i = start; i < jsonData.length; i++) {
      const row = jsonData[i] || [];
      const name = safe(row, nameIdx >= 0 ? nameIdx : 0, "");
      const gmail = safe(row, gmailIdx >= 0 ? gmailIdx : 1, "");
      const tel = safe(row, telIdx >= 0 ? telIdx : 2, "").replace(/\s/g, "");
      const positionType = safe(row, positionIdx >= 0 ? positionIdx : 3, "Technical") || "Technical";
      const employmentType = safe(row, employmentIdx >= 0 ? employmentIdx : 4, "Full-Time") || "Full-Time";
      if (name || gmail || tel) rows.push({ name, gmail, tel, positionType, employmentType });
    }
    return rows;
  };

  const rowsFromSheetObjects = (objData: Record<string, any>[]): Array<{ name: string; gmail: string; tel: string; positionType: string; employmentType: string }> => {
    const rows: Array<{ name: string; gmail: string; tel: string; positionType: string; employmentType: string }> = [];
    const getVal = (obj: Record<string, any>, ...candidates: string[]) => {
      const lower = candidates.map((c) => normalizeHeader(c));
      const k = Object.keys(obj || {}).find((k) => lower.includes(normalizeHeader(k.trim())));
      return k != null ? String(obj[k] ?? "").trim() : "";
    };
    for (const obj of objData) {
      const name = getVal(obj, "name");
      const gmail = getVal(obj, "gmail", "email");
      const tel = (getVal(obj, "tel", "phone", "phone_number") || "").replace(/\s/g, "");
      const positionType = getVal(obj, "positiontype", "position type", "position_type") || "Technical";
      const employmentType = getVal(obj, "employmenttype", "employment type", "employment_type") || "Full-Time";
      if (name || gmail || tel) rows.push({ name, gmail, tel, positionType: positionType || "Technical", employmentType: employmentType || "Full-Time" });
    }
    return rows;
  };

  const parseImportFile = (file: File): Promise<Array<{ name: string; gmail: string; tel: string; positionType: string; employmentType: string }>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
          if (isExcel) {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array", cellDates: false });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // Use header: 1 to get all rows as array and not miss rows from used range
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", blankrows: true }) as any[][];
            resolve(rowsFromSheetData(jsonData));
          } else {
            const text = String(e.target?.result ?? "");
            resolve(parseCSV(text));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file, "UTF-8");
      }
    });
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validExt = file.name.endsWith(".csv") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (!validExt) {
      alert("Please select a CSV or Excel file (.csv, .xlsx, .xls)");
      return;
    }
    setImportFile(file);
    setImportRows([]);
    setImportParsing(true);
    try {
      const rows = await parseImportFile(file);
      setImportRows(rows);
    } catch (err) {
      console.error(err);
      alert("Failed to parse file. Check format (columns: Name, Email, Phone_Number, Position_Type, Employment_Type).");
    } finally {
      setImportParsing(false);
    }
  };

  const validateImportRows = (rows: Array<{ name: string; gmail: string; tel: string; positionType: string; employmentType: string }>) => {
    const errors: string[] = [];
    const invalidRows = new Set<number>();
    const gmailCount: Record<string, number[]> = {};
    const nameAllowed = /^[a-zA-Z\u0E00-\u0E7F\s.]+$/;
    const telNumbersOnly = /^\d+$/;

    rows.forEach((r, i) => {
      const rowNum = i + 1;
      let hasError = false;
      const name = (r.name ?? "").trim();
      const gmail = (r.gmail ?? "").trim().toLowerCase();
      const tel = (r.tel ?? "").trim().replace(/\s/g, "");

      if (!name) {
        errors.push(`Row ${rowNum}: Please enter a Name`);
        hasError = true;
      } else if (!nameAllowed.test(name)) {
        errors.push(`Row ${rowNum}: Name must not contain numbers or special characters (period allowed, e.g. Mr.)`);
        hasError = true;
      }
      if (!gmail) {
        errors.push(`Row ${rowNum}: Please enter a Gmail`);
        hasError = true;
      } else {
        if (!gmailCount[gmail]) gmailCount[gmail] = [];
        gmailCount[gmail].push(rowNum);
      }
      if (!tel) {
        errors.push(`Row ${rowNum}: Please enter a phone number`);
        hasError = true;
      } else if (!telNumbersOnly.test(tel)) {
        errors.push(`Row ${rowNum}: Phone number must be a number`);
        hasError = true;
      }
      if (hasError) invalidRows.add(i);
    });

    Object.entries(gmailCount).forEach(([email, rowNums]) => {
      if (rowNums.length > 1) {
        errors.push(`Gmail "${email}" is duplicated in rows ${rowNums.join(", ")}`);
        rowNums.forEach((rn) => invalidRows.add(rn - 1));
      }
    });
    return { errors, invalidRows };
  };

  const handleImportSubmit = async () => {
    if (importRows.length === 0) {
      alert("No data to import, please select an Excel or CSV file");
      return;
    }
    const validation = validateImportRows(importRows);
    if (validation.errors.length > 0) {
      alert("Data is not valid:\n\n" + validation.errors.join("\n"));
      return;
    }
    const valid = importRows.filter((r) => r.name.trim() && r.gmail.trim() && r.tel.trim());
    if (valid.length === 0) {
      alert("No row with name, gmail, tel");
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
        const msg = res.message || `Import successful: created ${res.data.created} employees${res.data.failed ? `, failed ${res.data.failed}` : ""}`;
        const errors = res.data.errors && res.data.errors.length > 0
          ? "\n\nFailed rows:\n" + res.data.errors.map((e: { row: number; message: string }) => `Row ${e.row}: ${e.message}`).join("\n")
          : "";
        alert(msg + errors);
      } else {
        alert(res.message || "Import failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error importing employees");
    } finally {
      setImportSaving(false);
    }
  };

  const downloadEmployeeTemplate = () => {
    const header = ["Name", "Email", "Phone_Number", "Position_Type", "Employment_Type"];
    const exampleRow = [" Nena nana", "exampletcc-technology.com", "0812345678", "Technical", "Full-Time"];
    const ws = XLSX.utils.aoa_to_sheet([header, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employee_import_template.xlsx");
  };

  const importValidation = useMemo(() => validateImportRows(importRows), [importRows]);

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
            <div className="mb-6 flex flex-nowrap items-center justify-between gap-4 min-w-0 overflow-x-auto pb-1">
              <div className="min-w-0 shrink-0">
                <h2 className="text-lg font-semibold text-gray-900 truncate">
                  All Employees
                </h2>
                <p className="text-sm text-indigo-500">
                  Active Members
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
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
                  onClick={() => { setAddModalOpen(true); setAddModalTab("form"); setImportFile(null); setImportRows([]); setAddFormErrors({ name: "", gmail: "", tel: "" }); }}
                  className="flex h-10 items-center gap-2 rounded-full bg-indigo-500 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
                >
                  <UserPlus size={18} />
                  Add Employee
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {fetchError && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {fetchError}
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-400">Loading...</div>
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                    <tr>
                      <th className="px-6 py-4 text-center w-14">Picture</th>
                    
                      <th className="px-6 py-4 text-center">Username</th>
                      <th className="px-6 py-4 text-center">Gmail</th>
                      <th className="px-6 py-4 text-center">Phone</th>
                      <th className="px-6 py-4 text-center">Type</th>
                      <th className="px-6 py-4 text-center">Employment</th>
                      <th className="px-6 py-4 text-center w-24">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                         No Employee found
                        </td>
                      </tr>
                    ) : (
                      paginatedEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          className="border-t hover:bg-gray-50"
                        >
                          <td className="px-6 py-4">
                            <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                              {emp.photo ? (
                                <img src={emp.photo.startsWith("http") ? emp.photo : apiUrl(emp.photo)} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <UserRoundCog className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                          </td>
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
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => openEditModal(emp)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
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
              <div className={`relative flex w-full max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-xl min-w-0 ${addModalTab === "import" ? "max-w-3xl" : "max-w-lg"}`}>
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
                <form onSubmit={handleAddSubmit} className="space-y-4 overflow-y-auto overflow-x-hidden min-w-0 pr-8">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Profile Picture</label>
                    <div className="flex items-center gap-4">
                      <label className="relative flex h-20 w-20 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-gray-100">
                        {addForm.photo ? (
                          <img src={addForm.photo.startsWith("http") ? addForm.photo : apiUrl(addForm.photo)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-gray-400 select-none">{addPhotoUploading ? "Uploading..." : "Select Image"}</span>
                        )}
                        <input type="file" accept="image/*" className="sr-only" aria-label="Select profile picture" onChange={handleAddPhotoChange} disabled={addPhotoUploading} />
                      </label>
                      {addForm.photo && (
                        <button type="button" onClick={() => setAddForm((f) => ({ ...f, photo: null }))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" title="Remove photo">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={addForm.name}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^a-zA-Z\u0E00-\u0E7F\s.]/g, "");
                        setAddForm((f) => ({ ...f, name: v }));
                        setAddFormErrors((prev) => ({ ...prev, name: validateEmpName(v) }));
                      }}
                      onBlur={() => setAddFormErrors((prev) => ({ ...prev, name: validateEmpName(addForm.name) }))}
                      placeholder="e.g. Mr. First Name Last Name (letters and period, min 10)"
                      minLength={10}
                      className={`w-full max-w-full rounded-xl border-2 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 box-border ${addFormErrors.name ? "border-red-400 bg-red-50/50" : "border-gray-300 bg-gray-50"}`}
                    />
                    {addFormErrors.name && <p className="mt-1 text-sm text-red-500">{addFormErrors.name}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Gmail <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={addForm.gmail}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAddForm((f) => ({ ...f, gmail: v }));
                        setAddFormErrors((prev) => ({ ...prev, gmail: validateEmpGmail(v) }));
                      }}
                      onBlur={() => setAddFormErrors((prev) => ({ ...prev, gmail: validateEmpGmail(addForm.gmail) }))}
                      placeholder="example@tcc-technology.com"
                      className={`w-full max-w-full rounded-xl border-2 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 box-border ${addFormErrors.gmail ? "border-red-400 bg-red-50/50" : "border-gray-300 bg-gray-50"}`}
                    />
                    {addFormErrors.gmail && <p className="mt-1 text-sm text-red-500">{addFormErrors.gmail}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Phone <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={addForm.tel}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setAddForm((f) => ({ ...f, tel: v }));
                        setAddFormErrors((prev) => ({ ...prev, tel: validateEmpTel(v) }));
                      }}
                      onBlur={() => setAddFormErrors((prev) => ({ ...prev, tel: validateEmpTel(addForm.tel) }))}
                      placeholder="Phone Number (4–10 digits)"
                      minLength={4}
                      maxLength={10}
                      className={`w-full max-w-full rounded-xl border-2 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 box-border ${addFormErrors.tel ? "border-red-400 bg-red-50/50" : "border-gray-300 bg-gray-50"}`}
                    />
                    {addFormErrors.tel && <p className="mt-1 text-sm text-red-500">{addFormErrors.tel}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Position Type</label>
                    <select
                      value={addForm.positionType}
                      onChange={(e) => setAddForm((f) => ({ ...f, positionType: e.target.value as "Technical" | "Management" }))}
                      className="w-full rounded-xl border-2 border-gray-300 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
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
                      className="w-full rounded-xl border-2 border-gray-300 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
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
                      {addSaving ? "Saving..." : "Add Employee"}
                    </button>
                  </div>
                </form>
                )}
                {addModalTab === "import" && (
                  <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
                    {/* File Format Guide */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-blue-800">File Format Guide</h4>
                        <span className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={downloadEmployeeTemplate}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Excel (.xlsx)
                          </button>
                        </span>
                      </div>
                      <div className="text-xs text-blue-700 space-y-1">
                        <p><strong>Required columns in the file:</strong></p>
                        <ul className="ml-4 list-disc space-y-0.5">
                          <li><strong>Name</strong> = employee name</li>
                          <li><strong>Email</strong> = email address</li>
                          <li><strong>Phone_Number</strong> = phone number</li>
                          <li><strong>Position_Type</strong> = Technical or Management</li>
                          <li><strong>Employment_Type</strong> = Full-Time, Contract, or Part-time</li>
                        </ul>
                        <p className="mt-2 text-[10px] text-blue-600">
                          <strong>Note:</strong> If your file includes a header row, use these exact column names: <strong>Name</strong>, <strong>Email</strong>, <strong>Phone_Number</strong>, <strong>Position_Type</strong>, and <strong>Employment_Type</strong>.
                        </p>
                      </div>
                    </div>

                    {/* File Upload */}
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-indigo-400 transition-colors">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleImportFileChange}
                        className="sr-only"
                        aria-label="Select Excel or CSV file"
                        id="employee-excel-file-input"
                        disabled={importParsing}
                      />
                      <label
                        htmlFor="employee-excel-file-input"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <div className="p-3 bg-indigo-100 rounded-full">
                          <Download size={24} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            Click to upload Excel/CSV file
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Supports .xlsx, .xls, and .csv formats
                          </p>
                        </div>
                      </label>
                    </div>

                    {importParsing && <p className="text-xs text-gray-500">Parsing file...</p>}
                    {importFile && !importParsing && <p className="text-xs text-gray-500 truncate w-full">File: {importFile.name}</p>}
                    {importRows.length > 0 && (
                      <>
                        <p className="text-sm font-medium text-slate-700">Preview ({importRows.length} row{importRows.length !== 1 ? "s" : ""})</p>
                        {importValidation.errors.length > 0 && (
                          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                            <p className="font-semibold mb-1">Invalid data:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {importValidation.errors.map((msg, i) => (
                                <li key={i}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className={`border border-slate-200 rounded-lg overflow-auto bg-white ${importRows.length <= 8 ? "min-h-0" : "max-h-[50vh]"} min-h-[140px]`}>
                          <table className="min-w-full text-xs border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                              <tr>
                                <th className="px-3 py-1.5 text-left border-b border-slate-200 font-semibold text-slate-700 whitespace-nowrap">Name</th>
                                <th className="px-3 py-1.5 text-left border-b border-slate-200 font-semibold text-slate-700 whitespace-nowrap">Gmail</th>
                                <th className="px-3 py-1.5 text-left border-b border-slate-200 font-semibold text-slate-700 whitespace-nowrap">Tel</th>
                                <th className="px-3 py-1.5 text-left border-b border-slate-200 font-semibold text-slate-700 whitespace-nowrap">Position</th>
                                <th className="px-3 py-1.5 text-left border-b border-slate-200 font-semibold text-slate-700 whitespace-nowrap">Employment</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importRows.map((r, i) => (
                                <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 ${importValidation.invalidRows.has(i) ? "bg-red-50" : ""}`}>
                                  <td className="px-3 py-1.5 text-slate-800">{r.name || "—"}</td>
                                  <td className="px-3 py-1.5 text-slate-800">{r.gmail || "—"}</td>
                                  <td className="px-3 py-1.5 text-slate-800">{r.tel || "—"}</td>
                                  <td className="px-3 py-1.5 text-slate-700">{r.positionType || "—"}</td>
                                  <td className="px-3 py-1.5 text-slate-700">{r.employmentType || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
                            disabled={importSaving || importValidation.errors.length > 0}
                            className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <FileUp size={16} />
                            {importSaving
                              ? "Importing..."
                              : importValidation.errors.length > 0
                                ? "Fix errors before importing"
                                : `Import ${importRows.filter((r) => r.name.trim() && r.gmail.trim() && r.tel.trim()).length} employees`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Edit Employee Modal */}
          {editingEmployee && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50" onClick={() => !editSaving && setEditingEmployee(null)} />
              <div className="relative flex w-full max-w-lg max-h-[90vh] flex-col rounded-2xl bg-white shadow-xl">
                <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Employee</h3>
                  <button
                    type="button"
                    onClick={() => !editSaving && setEditingEmployee(null)}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleEditSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-6 py-4 pr-8 min-w-0">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Profile Picture</label>
                    <div className="flex items-center gap-4">
                      <label className="relative flex h-20 w-20 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-gray-100">
                        {editForm.photo ? (
                          <img src={editForm.photo.startsWith("http") ? editForm.photo : apiUrl(editForm.photo)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-gray-400 select-none">{editPhotoUploading ? "Uploading..." : "Select Image"}</span>
                        )}
                        <input type="file" accept="image/*" className="sr-only" aria-label="Select Profile Picture" onChange={handleEditPhotoChange} disabled={editPhotoUploading} />
                      </label>
                      {editForm.photo && (
                        <button type="button" onClick={() => setEditForm((f) => ({ ...f, photo: null }))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" title="Remove photo">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^a-zA-Z\u0E00-\u0E7F\s.]/g, "");
                        setEditForm((f) => ({ ...f, name: v }));
                        setEditFormErrors((prev) => ({ ...prev, name: validateEmpName(v) }));
                      }}
                      onBlur={() => setEditFormErrors((prev) => ({ ...prev, name: validateEmpName(editForm.name) }))}
                      placeholder="e.g. Mr. First Name Last Name (letters and period, min 10)"
                      minLength={10}
                      className={`w-full max-w-full rounded-xl border-2 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 box-border ${editFormErrors.name ? "border-red-400 bg-red-50/50" : "border-gray-300 bg-gray-50"}`}
                    />
                    {editFormErrors.name && <p className="mt-1 text-sm text-red-500">{editFormErrors.name}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Gmail <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={editForm.gmail}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditForm((f) => ({ ...f, gmail: v }));
                        setEditFormErrors((prev) => ({ ...prev, gmail: validateEmpGmail(v) }));
                      }}
                      onBlur={() => setEditFormErrors((prev) => ({ ...prev, gmail: validateEmpGmail(editForm.gmail) }))}
                      placeholder="example@tcc-technology.com"
                      className={`w-full max-w-full rounded-xl border-2 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 box-border ${editFormErrors.gmail ? "border-red-400 bg-red-50/50" : "border-gray-300 bg-gray-50"}`}
                    />
                    {editFormErrors.gmail && <p className="mt-1 text-sm text-red-500">{editFormErrors.gmail}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Phone <span className="text-red-500">*</span></label>
                    <input
                      type="tel"
                      value={editForm.tel}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setEditForm((f) => ({ ...f, tel: v }));
                        setEditFormErrors((prev) => ({ ...prev, tel: validateEmpTel(v) }));
                      }}
                      onBlur={() => setEditFormErrors((prev) => ({ ...prev, tel: validateEmpTel(editForm.tel) }))}
                      placeholder="Phone Number (4–10 digits)"
                      minLength={4}
                      maxLength={10}
                      className={`w-full max-w-full rounded-xl border-2 px-4 py-2.5 text-sm outline-none focus:border-indigo-500 box-border ${editFormErrors.tel ? "border-red-400 bg-red-50/50" : "border-gray-300 bg-gray-50"}`}
                    />
                    {editFormErrors.tel && <p className="mt-1 text-sm text-red-500">{editFormErrors.tel}</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Position Type</label>
                    <select
                      value={editForm.positionType}
                      onChange={(e) => setEditForm((f) => ({ ...f, positionType: e.target.value as "Technical" | "Management" }))}
                      className="w-full rounded-xl border-2 border-gray-300 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="Technical">Technical</option>
                      <option value="Management">Management</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Employment Type</label>
                    <select
                      value={editForm.employmentType}
                      onChange={(e) => setEditForm((f) => ({ ...f, employmentType: e.target.value }))}
                      className="w-full rounded-xl border-2 border-gray-300 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
                    >
                      <option value="Full-Time">Full-Time</option>
                      <option value="Contract">Contract</option>
                      <option value="Part-Time">Part-Time</option>
                    </select>
                  </div>
                  </div>
                  <div className="flex flex-shrink-0 justify-between border-t border-gray-100 px-6 py-4">
                    <button
                      type="button"
                      onClick={handleDeleteEmployee}
                      disabled={editSaving || deleteLoading}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                      title="Delete employee"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => !editSaving && !deleteLoading && setEditingEmployee(null)}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={editSaving}
                        className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
                      >
                        <Edit size={16} />
                        {editSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
    </SidebarLayout>
  );
};

export default EmployeeManagement;
