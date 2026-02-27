// components/ui/FolderCard.tsx
import { Folder } from 'lucide-react';

interface FolderCardProps {
  title: string;
  pages: number;
  color: string;
}

// ต้องมีคำว่า export ตรงนี้ครับ!
export function FolderCard({ title, pages, color }: FolderCardProps) {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50 hover:shadow-md transition-all cursor-pointer group">
      <div className={`${color} mb-4 p-3 bg-opacity-10 rounded-2xl w-fit`}>
        <Folder size={32} fill="currentColor" fillOpacity={0.2} />
      </div>
      <h4 className="font-bold text-slate-800 text-sm mb-1 group-hover:text-blue-600 transition-colors">
        {title}
      </h4>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
        {pages} pages
      </p>
    </div>
  );
}