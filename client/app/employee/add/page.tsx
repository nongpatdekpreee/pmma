"use client";

import React, { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Trash2, Eye, EyeOff } from "lucide-react";
import DashboardHeader from "@/components/ui/Header";
import { SidebarLayout } from "@/components/sidebar/SidebarLayout";
import { createEmployee, uploadEmployeePhoto } from "@/lib/api";
import {
  formatTelLineForDb,
  formatTenDigitUsDisplay,
  PHONE_EXT_MAX_DIGITS,
  PHONE_MAIN_MAX_DIGITS,
  validateEmployeePhoneInline,
  validateEmployeePhoneSubmit,
} from "@/lib/phoneFormat";
import {
  EMPLOYEE_PHOTO_ACCEPT,
  EMPLOYEE_PHOTO_EXTENSIONS_LABEL,
  EMPLOYEE_PHOTO_MAX_SIZE_LABEL,
  employeePhotoExtensionErrorMessage,
  employeePhotoSizeErrorMessage,
  employeePhotoSrc,
  isAllowedEmployeePhotoFile,
  isEmployeePhotoOverSize,
} from "@/lib/employeePhoto";
import { useToast, ToastContainer } from "@/components/ui/Toast";
import { getErrorMessage } from "@/lib/unknownUtil";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { AppRole } from "@/lib/auth/types";

const AddEmployeePage = () => {
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { toasts, removeToast, success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [gmail, setGmail] = useState("");
  const [tel, setTel] = useState("");
  const [telExt, setTelExt] = useState("");
  const [positionType, setPositionType] = useState<"Technical" | "Management" | "Engineer">("Technical");
  const [employmentType, setEmploymentType] = useState<string>("Full-Time");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("USER");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [errors, setErrors] = useState<{
    name: string;
    gmail: string;
    tel: string;
    username: string;
    password: string;
    adminPassword: string;
  }>({ name: "", gmail: "", tel: "", username: "", password: "", adminPassword: "" });
  const mainDigitsOverflowWarned = useRef(false);
  const extDigitsOverflowWarned = useRef(false);

  const validateName = (val: string): string => {
    const t = val.trim();
    if (!t) return "Name is required.";
    if (!/^[a-zA-Z\u0E00-\u0E7F\s]+$/.test(t)) return "Name must contain letters only.";
    if (t.length < 10) return "Name must be at least 10 characters.";
    return "";
  };
  const validateGmail = (val: string): string => {
    const t = val.trim();
    if (!t) return "Email is required.";
    if (!/^[^\s@]+@tcc-technology\.com$/.test(t)) return "Please enter a valid email address.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateName(name);
    const gmailErr = validateGmail(gmail);
    const telErr = validateEmployeePhoneSubmit(tel, telExt);
    const usernameTrim = username.trim();
    const usernameErr = !usernameTrim ? "Username is required for login." : "";
    const passwordErr = !password
      ? "Password is required for login."
      : password.length < 6
        ? "Password must be at least 6 characters."
        : "";
    const adminPasswordErr =
      isAdmin && role === "ADMIN" && !adminPassword.trim()
        ? "Enter your password to grant ADMIN role."
        : "";
    setErrors({
      name: nameErr,
      gmail: gmailErr,
      tel: telErr,
      username: usernameErr,
      password: passwordErr,
      adminPassword: adminPasswordErr,
    });
    if (nameErr || gmailErr || telErr || usernameErr || passwordErr || adminPasswordErr) return;
    const nameTrim = name.trim();
    const telForDb = formatTelLineForDb(tel, telExt);
    setSaving(true);
    try {
      const res = await createEmployee({
        name: nameTrim,
        gmail: gmail.trim(),
        tel: telForDb,
        positionType,
        employmentType,
        photo: photo || undefined,
        Username: usernameTrim,
        Password: password,
        Role: isAdmin ? role : "USER",
        adminPassword: isAdmin && role === "ADMIN" ? adminPassword : undefined,
      });
      if (res.success) {
        toastSuccess("Employee added successfully");
        router.push("/employee");
      } else {
        toastError(res.message || "Employee add failed");
      }
    } catch (err) {
      console.error(err);
      toastError(getErrorMessage(err) || "Error adding employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidebarLayout>
      <DashboardHeader />

      <main className="mx-auto w-full max-w-2xl space-y-6 px-8 py-6 md:mt-0 mt-16">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/employee")}
            className="p-2.5 hover:bg-muted rounded-xl transition-colors border border-border"
          >
            <ArrowLeft size={22} className="text-muted-foreground" />
          </button>
          <div>
            <h1 className="page-heading">Add Employee</h1>
            <p className="text-sm text-indigo-500">Add new employee</p>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-6 shadow-md min-w-0 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Profile Picture
              </label>
              <div className="flex items-center gap-4">
                <label className="relative flex h-24 w-24 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted hover:border-indigo-300 hover:bg-muted">
                  {photo ? (
                    <Image
                      src={employeePhotoSrc(photo) ?? ''}
                      alt=""
                      width={96}
                      height={96}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground select-none">{photoUploading ? "Uploading..." : "Select Image"}</span>
                  )}
                  <input
                    type="file"
                    accept={EMPLOYEE_PHOTO_ACCEPT}
                    className="sr-only"
                    aria-label="Select Profile Picture"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!isAllowedEmployeePhotoFile(file)) {
                        toastError(employeePhotoExtensionErrorMessage());
                        e.target.value = "";
                        return;
                      }
                      if (isEmployeePhotoOverSize(file)) {
                        toastError(employeePhotoSizeErrorMessage());
                        e.target.value = "";
                        return;
                      }
                      setPhotoUploading(true);
                      try {
                        const uploadRes = await uploadEmployeePhoto(file);
                        if (uploadRes.success && uploadRes.path) setPhoto(uploadRes.path);
                        else toastError(uploadRes.message || "Upload image failed");
                      } catch (error) {
                        toastError(getErrorMessage(error) || "Upload image failed");
                      } finally {
                        setPhotoUploading(false);
                      }
                    }}
                    disabled={photoUploading}
                  />
                </label>
                {photo && (
                  <button type="button" onClick={() => setPhoto(null)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" title="Remove photo">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Max {EMPLOYEE_PHOTO_MAX_SIZE_LABEL} · {EMPLOYEE_PHOTO_EXTENSIONS_LABEL}
              </p>
              <p className="mt-1 text-xs font-medium text-red-500">
                Warning: Only {EMPLOYEE_PHOTO_EXTENSIONS_LABEL} files are allowed and size must not exceed {EMPLOYEE_PHOTO_MAX_SIZE_LABEL}.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^a-zA-Z\u0E00-\u0E7F\s]/g, "");
                  setName(v);
                  setErrors((prev) => ({ ...prev, name: validateName(v) }));
                }}
                onBlur={() => setErrors((prev) => ({ ...prev, name: validateName(name) }))}
                placeholder="First Name Last Name (letters only, min 10)"
                minLength={10}
                className={`w-full max-w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-indigo-500 box-border ${errors.name ? "border-red-400 bg-red-50/50" : "border-border bg-muted"}`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={gmail}
                onChange={(ev) => {
                  const v = ev.target.value;
                  setGmail(v);
                  setErrors((prev) => ({ ...prev, gmail: validateGmail(v) }));
                }}
                onBlur={() => setErrors((prev) => ({ ...prev, gmail: validateGmail(gmail) }))}
                placeholder="example@tcc-technology.com"
                className={`w-full max-w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-indigo-500 box-border ${errors.gmail ? "border-red-400 bg-red-50/50" : "border-border bg-muted"}`}
              />
              {errors.gmail && <p className="mt-1 text-sm text-red-500">{errors.gmail}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Phone <span className="text-red-500">*</span>
              </label>
              <div className="flex min-w-0 items-center gap-1 sm:gap-2">
                <div className="relative min-w-0 flex-1">
                  <input
                    type="text"
                    inputMode="tel"
                    value={tel}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const n = raw.replace(/\D/g, "").length;
                      if (n > PHONE_MAIN_MAX_DIGITS) {
                        if (!mainDigitsOverflowWarned.current) {
                          mainDigitsOverflowWarned.current = true;
                          toastWarning(
                            `Phone main must be at most ${PHONE_MAIN_MAX_DIGITS} digits (already full)`,
                            2600
                          );
                        }
                      } else {
                        mainDigitsOverflowWarned.current = false;
                      }
                      const v = formatTenDigitUsDisplay(raw);
                      setTel(v);
                      setErrors((prev) => ({ ...prev, tel: validateEmployeePhoneInline(v, telExt) }));
                    }}
                    onBlur={() => setErrors((prev) => ({ ...prev, tel: validateEmployeePhoneInline(tel, telExt) }))}
                    placeholder="0xx-xxx-xxxx"
                    autoComplete="tel"
                    className={`w-full max-w-full rounded-xl border-2 px-4 py-3 text-sm tabular-nums outline-none focus:border-indigo-500 box-border ${errors.tel ? "border-red-400 bg-red-50/50" : "border-border bg-muted"}`}
                  />
                </div>
                <span className="shrink-0 select-none text-base font-medium text-muted-foreground" aria-hidden>
                  -
                </span>
                <div className="relative w-[4.5rem] shrink-0 sm:w-24">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={telExt}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const n = raw.replace(/\D/g, "").length;
                      if (n > PHONE_EXT_MAX_DIGITS) {
                        if (!extDigitsOverflowWarned.current) {
                          extDigitsOverflowWarned.current = true;
                          toastWarning(
                            `Extension must be at most ${PHONE_EXT_MAX_DIGITS} digits (already full)`,
                            2600
                          );
                        }
                      } else {
                        extDigitsOverflowWarned.current = false;
                      }
                      const v = raw.replace(/\D/g, "").slice(0, PHONE_EXT_MAX_DIGITS);
                      setTelExt(v);
                      setErrors((prev) => ({ ...prev, tel: validateEmployeePhoneInline(tel, v) }));
                    }}
                    onBlur={() => setErrors((prev) => ({ ...prev, tel: validateEmployeePhoneInline(tel, telExt) }))}
                    placeholder="Ext"
                    autoComplete="off"
                    aria-label="Extension (max 6 digits)"
                    title="Extension (max 6 digits)"
                    className={`w-full rounded-xl border-2 px-2.5 py-3 text-left text-sm tabular-nums outline-none focus:border-indigo-500 box-border ${errors.tel ? "border-red-400 bg-red-50/50" : "border-border bg-muted"}`}
                  />
                </div>
              </div>
              {errors.tel && <p className="mt-1 text-sm text-red-500">{errors.tel}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Position Type
              </label>
              <select
                value={positionType}
                onChange={(e) => setPositionType(e.target.value as "Technical" | "Management" | "Engineer")}
                className="w-full rounded-xl border-2 border-border bg-muted px-4 py-3 text-sm outline-none focus:border-indigo-500"
              >
                <option value="Technical">Technical</option>
                <option value="Management">Management</option>
                <option value="Engineer">Engineer</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Employment Type
              </label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full rounded-xl border-2 border-border bg-muted px-4 py-3 text-sm outline-none focus:border-indigo-500"
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Contract">Contract</option>
                <option value="Part-Time">Part-Time</option>
              </select>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Login account (required)
              </p>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  value={username}
                  onChange={(e) => {
                    const v = e.target.value;
                    setUsername(v);
                    setErrors((prev) => ({
                      ...prev,
                      username: v.trim() ? "" : "Username is required for login.",
                    }));
                  }}
                  placeholder="Login username"
                  className={`w-full max-w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-indigo-500 box-border ${errors.username ? "border-red-400 bg-red-50/50" : "border-border bg-muted"}`}
                />
                {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPassword(v);
                      setErrors((prev) => ({
                        ...prev,
                        password: !v
                          ? "Password is required for login."
                          : v.length < 6
                            ? "Password must be at least 6 characters."
                            : "",
                      }));
                    }}
                    placeholder="At least 6 characters"
                    className={`w-full max-w-full rounded-xl border-2 px-4 py-3 pr-10 text-sm outline-none focus:border-indigo-500 box-border ${errors.password ? "border-red-400 bg-red-50/50" : "border-border bg-muted"}`}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
              </div>
              {isAdmin ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Role</label>
                  <select
                    value={role}
                    onChange={(e) => {
                      const next = e.target.value as AppRole;
                      setRole(next);
                      if (next !== "ADMIN") {
                        setAdminPassword("");
                        setErrors((prev) => ({ ...prev, adminPassword: "" }));
                      }
                    }}
                    className="w-full rounded-xl border-2 border-border bg-muted px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  {role === "ADMIN" && (
                    <div className="mt-3">
                      <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                        Confirm with your password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showAdminPassword ? "text" : "password"}
                          value={adminPassword}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAdminPassword(v);
                            setErrors((prev) => ({
                              ...prev,
                              adminPassword: v.trim() ? "" : "Enter your password to grant ADMIN role.",
                            }));
                          }}
                          placeholder="Your admin password"
                          className={`w-full max-w-full rounded-xl border-2 px-4 py-3 pr-10 text-sm outline-none focus:border-indigo-500 box-border ${errors.adminPassword ? "border-red-400 bg-red-50/50" : "border-border bg-muted"}`}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowAdminPassword((v) => !v)}
                          aria-label={showAdminPassword ? "Hide password" : "Show password"}
                        >
                          {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.adminPassword && (
                        <p className="mt-1 text-sm text-red-500">{errors.adminPassword}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/employee")}
                className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
              >
                <UserPlus size={18} />
                {saving ? "Saving..." : "Add Employee"}
              </button>
            </div>
          </form>
        </div>
      </main>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </SidebarLayout>
  );
};

export default AddEmployeePage;
