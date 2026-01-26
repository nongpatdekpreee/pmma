"use client";

import { useMemo, useState } from "react";

/* =======================
   TYPES
======================= */
export type ContractStatus =
  | "Done"
  | "In Progress"
  | "Not Started"
  | "Scheduled";

export type ContractRow = {
  assetName: string;
  site: string;
  vendor: string;
  pmDate: string;
  status: ContractStatus;
  responsibleBy: string;
};

type ContractTableProps = {
  rows: ContractRow[];
};

/* =======================
   CONSTANT
======================= */
const ITEMS_PER_PAGE = 8;

/* =======================
   STATUS BADGE
======================= */
export function StatusBadge({ status }: { status: ContractStatus }) {
  const map: Record<ContractStatus, string> = {
    Done: "bg-green-100 text-green-700",
    "In Progress": "bg-yellow-100 text-yellow-700",
    "Not Started": "bg-red-100 text-red-700",
    Scheduled: "bg-indigo-100 text-indigo-700",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs ${map[status]}`}>
      {status}
    </span>
  );
}

/* =======================
   CONTRACT TABLE
======================= */
export function ContractTable({ rows }: ContractTableProps) {
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [currentPage, setCurrentPage] = useState(1);

  /* ---------- filter ---------- */
  const filteredRows = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return rows;

    return rows.filter((row) =>
      [row.assetName, row.site, row.vendor, row.pmDate, row.status]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, rows]);

  /* ---------- sort ---------- */
  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];

    copy.sort((a, b) => {
      const dateA = new Date(a.pmDate).getTime();
      const dateB = new Date(b.pmDate).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return copy;
  }, [filteredRows, sortOrder]);

  /* ---------- pagination ---------- */
  const totalItems = sortedRows.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRows = sortedRows.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  /* reset page เมื่อ search */
  const handleSearch = (value: string) => {
    setQuery(value);
    setCurrentPage(1);
  };
// console.log("rows:", rows.length);
// console.log("totalPages:", totalPages);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-md">
      {/* header */}
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
          {/* search */}
          <div className="flex h-9 items-center rounded-full bg-[#F5F7FB] px-3 text-xs text-gray-500">
            <span className="mr-1 text-sm">🔍</span>
            <input
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search"
              className="w-32 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 md:w-40"
            />
          </div>

          {/* sort */}
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 shadow-sm">
            <span>Sort by :</span>
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

      {/* table */}
      <div className="overflow-x-auto border border-gray-100">
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
            {paginatedRows.map((row, index) => (
              <tr
                key={`${row.assetName}-${index}`}
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

      {/* pagination */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-400">
        <span>
          Showing data {startIndex + 1} to{" "}
          {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of {totalItems} contract
        </span>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition ${
                page === currentPage
                  ? "bg-indigo-500 text-white"
                  : "bg-white text-gray-500 shadow-sm hover:bg-gray-100"
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
