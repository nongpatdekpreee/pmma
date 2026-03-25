"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Trash2 } from "lucide-react";
import DashboardHeader from "@/components/ui/Header";
import { SidebarLayout } from "@/components/sidebar/SidebarLayout";
import { apiUrl, createEmployee, uploadEmployeePhoto } from "@/lib/api";
import { useToast, ToastContainer } from "@/components/ui/Toast";

const AddEmployeePage = () => {
  const router = useRouter();
  const { toasts, removeToast, success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [gmail, setGmail] = useState("");
  const [tel, setTel] = useState("");
  const [positionType, setPositionType] = useState<"Technical" | "Management">("Technical");
  const [employmentType, setEmploymentType] = useState<string>("Full-Time");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [errors, setErrors] = useState<{ name: string; gmail: string; tel: string }>({ name: "", gmail: "", tel: "" });

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
  const validateTel = (val: string): string => {
    const t = val.replace(/\s/g, "");
    if (!t) return "Phone is required.";
    if (!/^\d+$/.test(t)) return "Phone must contain digits only.";
    if (t.length < 4) return "Phone must be at least 4 digits.";
    if (t.length > 10) return "Phone must be at most 10 digits.";
    return "";
  };

  const validateForm = (): string | null => {
    const nameTrim = name.trim();
    const telTrim = tel.trim().replace(/\s/g, "");
    const gmailTrim = gmail.trim();
    if (!nameTrim || !gmailTrim || !telTrim) {
      return "Please fill in Name, Gmail and Phone.";
    }
    if (!/^[a-zA-Z\u0E00-\u0E7F\s]+$/.test(nameTrim)) {
      return "Name must contain letters only (no numbers or special characters).";
    }
    if (nameTrim.length < 10) {
      return "Name must be at least 10 characters.";
    }
    if (!/^\d+$/.test(telTrim)) {
      return "Phone must contain digits only.";
    }
    if (telTrim.length < 4) {
      return "Phone must be at least 4 digits.";
    }
    if (telTrim.length > 10) {
      return "Phone must be at most 10 digits.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmailTrim)) {
      return "Please enter a valid email address.";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameErr = validateName(name);
    const gmailErr = validateGmail(gmail);
    const telErr = validateTel(tel);
    setErrors({ name: nameErr, gmail: gmailErr, tel: telErr });
    if (nameErr || gmailErr || telErr) return;
    const nameTrim = name.trim();
    const telTrim = tel.trim().replace(/\s/g, "");
    setSaving(true);
    try {
      const res = await createEmployee({
        name: nameTrim,
        gmail: gmail.trim(),
        tel: telTrim,
        positionType,
        employmentType,
        photo: photo || undefined,
      });
      if (res.success) {
        toastSuccess("Employee added successfully");
        router.push("/employee");
      } else {
        toastError(res.message || "Employee add failed");
      }
    } catch (err) {
      console.error(err);
      toastError("Error adding employee");
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
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200"
          >
            <ArrowLeft size={22} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Add Employee</h1>
            <p className="text-sm text-indigo-500">Add new employee</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-md min-w-0 overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Profile Picture
              </label>
              <div className="flex items-center gap-4">
                <label className="relative flex h-24 w-24 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-gray-100">
                  {photo ? (
                    <img src={photo.startsWith("http") ? photo : apiUrl(photo)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm text-gray-400 select-none">{photoUploading ? "Uploading..." : "Select Image"}</span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label="Select Profile Picture"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !file.type.startsWith("image/")) {
                        if (file) toastWarning("Please select an image file");
                        return;
                      }
                      setPhotoUploading(true);
                      try {
                        const uploadRes = await uploadEmployeePhoto(file);
                        if (uploadRes.success && uploadRes.path) setPhoto(uploadRes.path);
                        else toastError(uploadRes.message || "Upload image failed");
                      } catch (err) {
                        toastError("Upload image failed");
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
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
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
                className={`w-full max-w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-indigo-500 box-border ${errors.name ? "border-red-400 bg-red-50/50" : "border-gray-300 bg-gray-50"}`}
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Gmail <span className="text-red-500">*</span>
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
                className={`w-full max-w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-indigo-500 box-border ${errors.gmail ? "border-red-400 bg-red-50/50" : "border-gray-300 bg-gray-50"}`}
              />
              {errors.gmail && <p className="mt-1 text-sm text-red-500">{errors.gmail}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={tel}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                  setTel(v);
                  setErrors((prev) => ({ ...prev, tel: validateTel(v) }));
                }}
                onBlur={() => setErrors((prev) => ({ ...prev, tel: validateTel(tel) }))}
                placeholder="Phone Number (4–10 digits)"
                minLength={4}
                maxLength={10}
                className={`w-full max-w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-indigo-500 box-border ${errors.tel ? "border-red-400 bg-red-50/50" : "border-gray-300 bg-gray-50"}`}
              />
              {errors.tel && <p className="mt-1 text-sm text-red-500">{errors.tel}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Position Type
              </label>
              <select
                value={positionType}
                onChange={(e) => setPositionType(e.target.value as "Technical" | "Management")}
                className="w-full rounded-xl border-2 border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-500"
              >
                <option value="Technical">Technical</option>
                <option value="Management">Management</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Employment Type
              </label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-300 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-indigo-500"
              >
                <option value="Full-Time">Full-Time</option>
                <option value="Contract">Contract</option>
                <option value="Part-Time">Part-Time</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/employee")}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
