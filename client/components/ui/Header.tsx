import { Bell, ChevronDown, Search } from "lucide-react";

export default function DashboardHeader() {
  return (
    <header className="flex shrink-0 items-center justify-end pt-5 pb-4 sm:pt-6 sm:pb-5 lg:pt-7 lg:pb-5">
      {/* <div className="relative w-96 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-muted-foreground sm:left-9 lg:left-11" size={18} />
        <input
          type="text"
          placeholder="Search"
          className="w-full pl-10 pr-4 py-2 bg-card rounded-xl border-none focus:ring-2 focus:ring-blue-500 shadow-sm"
        />
      </div> */}
      <div className="flex items-center gap-4 px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        {/* <div className="p-2 bg-card rounded-full shadow-sm cursor-pointer relative">
          <Bell size={20} className="text-muted-foreground" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-card"></span>
        </div>
        <div className="flex items-center gap-2 bg-card p-1 pr-4 rounded-full shadow-sm cursor-pointer">
          <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Piyapat" className="w-8 h-8 rounded-full bg-orange-100" />
          <span className="text-sm font-bold text-muted-foreground uppercase">Piyapat</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </div> */}
      </div>
    </header>
  );
}
