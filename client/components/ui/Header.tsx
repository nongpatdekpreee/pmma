import { Bell, ChevronDown, Search } from "lucide-react";
export default function DashboardHeader() {
  return (
     <header className="flex items-center justify-end ">
          {/* <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input  
              type="text" 
              placeholder="Search" 
              className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div> */}
          <div className="flex items-center gap-4 p-6">
            {/* <div className="p-2 bg-white rounded-full shadow-sm cursor-pointer relative">
              <Bell size={20} className="text-gray-600" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </div>
            <div className="flex items-center gap-2 bg-white p-1 pr-4 rounded-full shadow-sm cursor-pointer">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Piyapat" className="w-8 h-8 rounded-full bg-orange-100" />
              <span className="text-sm font-bold text-gray-700 uppercase">Piyapat</span>
              <ChevronDown size={14} className="text-gray-400" />
            </div> */}
          </div>
        </header>
  );
}
