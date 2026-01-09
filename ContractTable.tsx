"use client";

import { useMemo, useState } from "react";
import { ContractRow } from "../interfaces/dashboard";
import StatusBadge from "./StatusBadge";

type Props = {
  rows: ContractRow[];
};

export default function ContractTable({ rows }: Props) {
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const filteredRows = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return rows;

    return rows.filter((row) => {
      return (
        row.assetName.toLowerCase().includes(q) ||
        row.site.toLowerCase().includes(q) ||
        row.vendor.toLowerCase().includes(q) ||
        row.pmDate.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q)
      );
    });
  }, [query, rows]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];

    copy.sort((a, b) => {
      const dateA = new Date(a.pmDate).getTime();
      const dateB = new Date(b.pmDate).getTime();

      if (sortOrder === "newest") {
        return dateB - dateA; // วันที่ใหม่สุดก่อน
      }

      return dateA - dateB; // วันที่เก่าสุดก่อน
    });

    return copy;
  }, [filteredRows, sortOrder]);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            All Contract
          </h2>
          <button className="mt-1 text-xs font-medium text-indigo-500">
            Active Members
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-9 items-center rounded-full bg-[#F5F7FB] px-3 text-xs text-gray-500">
            <span className="mr-1 text-sm">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="w-32 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 md:w-40"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-sm">
            <span className="whitespace-nowrap">Sort by :</span>
            <select
              value={sortOrder}
              onChange={(e) =>
                setSortOrder(e.target.value as "newest" | "oldest")
              }
              className="bg-transparent text-xs text-gray-700 outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-6 py-3 text-left">Asset Name</th>
              <th className="px-6 py-3 text-left">Site</th>
              <th className="px-6 py-3 text-left">Vendor</th>
              <th className="px-6 py-3 text-left">PM Date</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white text-[13px]">
            {sortedRows.map((row, index) => (
              <tr
                key={row.assetName}
                className={index % 2 === 0 ? "bg-white" : "bg-[#F9FBFF]"}
              >
                <td className="px-6 py-3">{row.assetName}</td>
                <td className="px-6 py-3">{row.site}</td>
                <td className="px-6 py-3">{row.vendor}</td>
                <td className="px-6 py-3">{row.pmDate}</td>
                <td className="px-6 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-6 py-3 text-right">
                  <button className="rounded-xl bg-indigo-50 px-4 py-1.5 text-xs font-medium text-indigo-600">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-400">
        <span>Showing data 1 to 8 of 1000 contract</span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((page) => (
            <button
              key={page}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs ${
                page === 1
                  ? "bg-indigo-500 text-white"
                  : "bg-white text-gray-500 shadow-sm"
              }`}
            >
              {page}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
