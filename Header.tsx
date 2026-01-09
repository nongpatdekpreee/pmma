export default function DashboardHeader() {
  return (
    <header className="flex items-center justify-between border-b border-gray-100 bg-white px-8 py-5">
      <div className="flex items-center gap-6 flex-1">
        <div className="hidden md:flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500 text-white text-xl font-semibold">
            d
          </div>
          <span className="text-sm font-semibold text-gray-800">
            Dashboard
          </span>
        </div>

        <div className="flex-1">
          <div className="flex h-11 items-center rounded-full bg-[#F5F7FB] px-4 text-sm text-gray-500 shadow-inner">
            <span className="mr-2 text-lg">🔍</span>
            <input
              type="text"
              placeholder="Search"
              className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="hidden sm:flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-500 shadow-sm">
          <span>📅</span>
          <span>Jun 1, 2025 - Jun 16, 2025</span>
        </button>

        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg text-gray-500 shadow-sm">
          🔔
        </button>

        <div className="h-8 w-px bg-gray-200" />

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-semibold text-gray-800">
              Yotsawan
            </div>
            <div className="text-[11px] text-gray-400">Network Engineer</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            Y
          </div>
        </div>
      </div>
    </header>
  );
}
