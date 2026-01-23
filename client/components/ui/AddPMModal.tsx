'use client';
import { X, Paperclip, Link as LinkIcon } from 'lucide-react';
import { useState, useEffect } from 'react';

interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  color: string;
  startDay: number;
  endDay: number;
  month: number;
  year: number;
  engineer: string;
  vendorName?: string;
  slaTerm?: string;
  priority?: string;
  assetBinding?: string;
  coverageScope?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (data: any) => void;
  editingEvent?: CalendarEvent | null;
}

export function AddPMModal({ isOpen, onClose, onSave, editingEvent }: Props) {

  const [vendorName, setVendorName] = useState('');
  const [slaTerm, setSlaTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [duration, setDuration] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState('');
  const [assetBinding, setAssetBinding] = useState('');
  const [coverageScope, setCoverageScope] = useState('');

  // Load editing event data when modal opens or editingEvent changes
  useEffect(() => {
    if (editingEvent && isOpen) {
      setVendorName(editingEvent.vendorName || editingEvent.title.replace('PM: ', '') || '');
      setSlaTerm(editingEvent.slaTerm || '');
      setPriority(editingEvent.priority || '');
      setAssetBinding(editingEvent.assetBinding || '');
      setCoverageScope(editingEvent.coverageScope || '');
      
      // Convert event dates to date format
      const eventStartDate = new Date(editingEvent.year, editingEvent.month, editingEvent.startDay);
      const eventEndDate = new Date(editingEvent.year, editingEvent.month, editingEvent.endDay);
      setStartDate(eventStartDate.toISOString().split('T')[0]);
      setEndDate(eventEndDate.toISOString().split('T')[0]);
      
      // Calculate duration in months
      const monthsDiff = (eventEndDate.getFullYear() - eventStartDate.getFullYear()) * 12 + 
                         (eventEndDate.getMonth() - eventStartDate.getMonth());
      setDuration(monthsDiff.toString());
    } else if (!editingEvent && isOpen) {
      // Reset form when adding new event
      setVendorName('');
      setSlaTerm('');
      setStartDate('');
      setDuration('');
      setEndDate('');
      setPriority('');
      setAssetBinding('');
      setCoverageScope('');
    }
  }, [editingEvent, isOpen]);

  useEffect(() => {
    if (startDate && duration && !isNaN(parseInt(duration, 10))) {
      const start = new Date(startDate);
      const months = parseInt(duration, 10);

      const end = new Date(start);
      end.setMonth(end.getMonth() + months);

      setEndDate(end.toISOString().split('T')[0]);
    }
  }, [startDate, duration]);

  const handleSave = () => {
    if (!startDate || !endDate || !vendorName) {
      alert('Please fill in required fields (Vendor Name, Start Date, and Duration)');
      return;
    }

    const data = {
      vendorName,
      slaTerm,
      startDate,
      endDate,
      duration,
      priority,
      assetBinding,
      coverageScope,
      time: '09:00 AM',
      color: 'border-blue-500',
    };

    if (onSave) {
      onSave(data);
    }

    // Reset form
    setVendorName('');
    setSlaTerm('');
    setStartDate('');
    setDuration('');
    setEndDate('');
    setPriority('');
    setAssetBinding('');
    setCoverageScope('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-xl max-h-[120vh] rounded-[2.5rem] p-8 relative shadow-2xl flex flex-col transform scale-[0.8] origin-center
 ">
        
        {/* Header & Close Button */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-extrabold text-slate-800">
            {editingEvent ? 'Edit Plan' : 'Add Contract'}
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Vendor Name *</label>
            <input 
              type="text" 
              placeholder="Enter vendor name" 
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">SLA Term *</label>
            <select 
              value={slaTerm}
              onChange={(e) => setSlaTerm(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-500"
            >
              <option value="">Select...</option>
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
                <option value="">choose</option>
                <option value="3">3</option>
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
            <select 
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-500"
            >
              <option value="">Select...</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
                    <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Asset Binding *</label>
            <input 
              type="text" 
              placeholder="Enter asset binding" 
              value={assetBinding}
              onChange={(e) => setAssetBinding(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase">Coverage Scope *</label>
            <textarea 
              rows={4} 
              placeholder="Add some description of the task" 
              value={coverageScope}
              onChange={(e) => setCoverageScope(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            ></textarea>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-8">
          <div className="flex gap-2">
            <button className="p-3 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100"><Paperclip size={20} /></button>
            <button className="p-3 bg-cyan-50 text-cyan-600 rounded-xl hover:bg-cyan-100"><LinkIcon size={20} /></button>
          </div>
          <button 
            onClick={handleSave}
            className="px-8 py-3 bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-600 transition-all"
          >
            {editingEvent ? 'Update Plan' : 'Save Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
