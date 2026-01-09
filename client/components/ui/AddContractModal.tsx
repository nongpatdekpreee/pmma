'use client';
import { X, Paperclip, Link as LinkIcon } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddContractModal({ isOpen, onClose }: Props) {

  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (startDate && duration) {
      const start = new Date(startDate);
      const months = parseInt(duration, 10);

      const end = new Date(start);
      end.setMonth(end.getMonth() + months);

      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [startDate, duration]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-[2.5rem] p-8 relative shadow-2xl flex flex-col">
        
        {/* Header & Close Button */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-extrabold text-slate-800">Add Contract</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Vendor Name *</label>
            <input type="text" placeholder="Enter vendor name" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">SLA Term *</label>
            <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-500">
              <option>Design</option>
              <option>Standard</option>
              <option>Premium</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold mb-2 uppercase">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 border"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-2 uppercase">
                ช่วงเวลา (เดือน)
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 border"
              >
                <option value="">chosse</option>
                <option value="3">3 </option>
                <option value="6">6</option>
                <option value="9">9</option>
                <option value="12">12</option>
                <option value="24">24</option>
                <option value="36">36</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-2 uppercase">หมดอายุ</label>
              <input
                type="date"
                value={endDate}
                readOnly
                className="w-full p-3 rounded-xl bg-slate-100 border cursor-not-allowed"
              />
            </div>
          </div>
            <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Priority *</label>
            <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-500">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
                    <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Asset Binding *</label>
            <input type="text" placeholder="Enter vendor name" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Coverage Scope *</label>
            <textarea rows={4} placeholder="Add some description of the task" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"></textarea>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-8">
          <div className="flex gap-2">
            <button className="p-3 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100"><Paperclip size={20} /></button>
            <button className="p-3 bg-cyan-50 text-cyan-600 rounded-xl hover:bg-cyan-100"><LinkIcon size={20} /></button>
          </div>
          <button className="px-8 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-600 transition-all">
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
}
