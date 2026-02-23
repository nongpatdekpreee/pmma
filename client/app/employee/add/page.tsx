"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";
import DashboardHeader from "@/components/ui/Header";
import { SidebarLayout } from "@/components/sidebar/SidebarLayout";
import { createEmployee } from "@/lib/api";

const AddEmployeePage = () => {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [gmail, setGmail] = useState("");
  const [tel, setTel] = useState("");
  const [positionType, setPositionType] = useState<"Technical" | "Management">("Technical");
  const [employmentType, setEmploymentType] = useState<string>("Full-Time");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !gmail.trim() || !tel.trim()) {
      alert("กรุณากรอก Name, Gmail และ Phone ให้ครบ");
      return;
    }
    setSaving(true);
    try {
      const res = await createEmployee({
        name: name.trim(),
        gmail: gmail.trim(),
        tel: tel.trim(),
        positionType,
        employmentType,
      });
      if (res.success) {
        alert("เพิ่มพนักงานสำเร็จ");
        router.push("/employee");
      } else {
        alert(res.message || "เพิ่มพนักงานไม่สำเร็จ");
      }
    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาด");
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
            <p className="text-sm text-indigo-500">เพิ่มพนักงานใหม่</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อ-นามสกุล"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Gmail *
              </label>
              <input
                type="email"
                value={gmail}
                onChange={(e) => setGmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Phone *
              </label>
              <input
                type="tel"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                placeholder="เบอร์โทรศัพท์"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Position Type
              </label>
              <select
                value={positionType}
                onChange={(e) => setPositionType(e.target.value as "Technical" | "Management")}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
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
                {saving ? "กำลังบันทึก..." : "Add Employee"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </SidebarLayout>
  );
};

export default AddEmployeePage;
