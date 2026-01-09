export default function Sidebar() {
  const menuItems = [
    "Dashboard",
    "Projects",
    "Calendar",
    "Vacations",
    "Employees",
    "Messenger",
    "Info Portal",
  ];

  return (
    <aside className="flex h-screen w-64 flex-col justify-between bg-white px-6 py-8 shadow-lg">
      <div>
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500 text-white text-xl font-semibold">
            d
          </div>
          <span className="text-sm font-semibold text-gray-800">Dashboard</span>
        </div>

        <nav className="space-y-1 text-sm">
          {menuItems.map((item, index) => {
            const isActive = index === 0;
            return (
              <button
                key={item}
                className={`flex w-full items-center rounded-xl px-3 py-2 text-left transition ${
                  isActive
                    ? "bg-indigo-50 font-semibold text-indigo-600"
                    : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-600"
                }`}
              >
                <span className="ml-2">{item}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-4">
        <button className="flex w-full items-center gap-3 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-medium text-white shadow-md">
          <span>Support</span>
        </button>

        <button className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50">
          Logout
        </button>
      </div>
    </aside>
  );
}

