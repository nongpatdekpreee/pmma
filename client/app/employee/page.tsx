"use client";

import React, { useMemo, useState } from "react";
import { LucideIcon, UserCheck, UserRoundCog, Wrench } from "lucide-react";
import { EMPLOYEE_DATA } from "@/data/employee.mock";
import DashboardHeader from "@/components/ui/Header";
import { SidebarLayout } from "@/components/sidebar/SidebarLayout";   

/* ================= summary ================= */
interface SummaryEM {
  label: string;
  value: string;
  icon: LucideIcon;
  growth?: string;
}

const SUMMARY_CARDS_EM: SummaryEM[] = [
  { label: "TOTAL EMPLOYEES", value: "100", icon: UserCheck },
  { label: "TECHNICAL", value: "500", icon: UserRoundCog, growth: "+8% this month" },
  { label: "MANAGEMENT", value: "189", icon: Wrench  },
];

const ITEMS_PER_PAGE = 8;

/* ================= prepare data ================= */
const employees = EMPLOYEE_DATA.employees.map((emp) => ({
  id: emp.id,
  name: emp.displayName,
  gmail: emp.gmail,
  tel: emp.tel,
  positionType: emp.positionType,
  employmentType: emp.employmentType,
}));

const extractNumber = (id: string) =>
  Number(id.replace(/\D/g, ""));

const EmployeeManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] =
    useState<"newest" | "oldest">("newest");

  /* ================= filter ================= */
  const filteredEmployees = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.gmail.toLowerCase().includes(q) ||
        emp.tel.toLowerCase().includes(q) ||
        emp.employmentType.toLowerCase().includes(q) ||
        emp.id.toLowerCase().includes(q)
    );
  }, [searchTerm]);

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
    switch (type) {
      case "Full-time":
        return "bg-green-100 text-green-700";
      case "Contract":
        return "bg-blue-100 text-blue-700";
      case "Part-time":
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getPositionTypeColor = (type: string) =>
    type === "Management"
      ? "bg-purple-100 text-purple-700"
      : "bg-gray-100 text-gray-700";

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
                        {card.value}
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

                <select
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value as "newest" | "oldest")
                  }
                  className="h-10 rounded-full border bg-white px-4 text-sm shadow-sm"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-400">
                  <tr>
                    <th className="px-6 py-4 text-center">ID</th>
                    <th className="px-6 py-4 text-center">Name</th>
                    <th className="px-6 py-4 text-center">Gmail</th>
                    <th className="px-6 py-4 text-center">Phone</th>
                    <th className="px-6 py-4 text-center">Type</th>
                    <th className="px-6 py-4 text-center">Employment</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      className="border-t hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">{emp.id}</td>
                      <td className="px-6 py-4 font-medium">
                        {emp.name}
                      </td>
                      <td className="px-6 py-4">{emp.gmail}</td>
                      <td className="px-6 py-4">{emp.tel}</td>
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
                  ))}
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
        </main>
    </SidebarLayout>
  );
};

export default EmployeeManagement;
