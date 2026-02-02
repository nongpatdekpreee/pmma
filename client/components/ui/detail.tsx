'use client';

import { X, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Device {
  id: string;
  name: string;
  type: string;
  serialNumber?: string;
  site?: string;
}

interface Engineer {
  id: string;
  name: string;
  lastName?: string;
}

interface TaskDetail {
  id: string;
  taskType?: 'PM' | 'MA';
  title: string;
  time: string;
  color?: string;
  startDay?: number;
  endDay?: number;
  month?: number;
  year?: number;
  Sid?: string;
  Sname?: string;
  Eng_ids?: Engineer[];
  lastName?: string;
  engineer?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  coverageScope?: string;
  assets?: Device[];
  vendorName?: string;
  slaTerm?: string;
  duration?: string;
  assetBinding?: string;
  travelMethod?: string;
  travelCost?: string;
  contractId?: string | number;
  replacementDeviceId?: string | number;
  // Status fields
  actuallyWent?: boolean;
  photos?: string[]; // Array of base64 or URLs
  notes?: string;
  status?: 'done' | 'working' | 'stuck' | 'not-started';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDetail | null;
  onUpdate?: (updatedTask: TaskDetail) => void;
  onEdit?: (task: TaskDetail) => void;
  onDelete?: (taskId: string) => void;
}

export function TaskDetailModal({ isOpen, onClose, task, onUpdate, onEdit, onDelete }: Props) {
  const [status, setStatus] = useState<'done' | 'working' | 'stuck' | 'not-started'>(task?.status || 'not-started');

  // Update local state when task changes
  useEffect(() => {
    if (task) {
      setStatus(task.status || 'not-started');
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const handleSave = () => {
    const updatedTask: TaskDetail = {
      ...task,
      status,
    };

    onUpdate?.(updatedTask);
    onClose();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-extrabold text-slate-800">Task Details</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {task.taskType === 'MA' ? 'Maintenance Agreement' : 'Preventive Maintenance'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white rounded-full hover:bg-slate-100 transition-colors shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Basic Information */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-blue-500" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-500">Task Type</label>
                <p className="text-sm font-medium text-slate-800 mt-1">
                  {task.taskType === 'MA' ? 'Maintenance Agreement (MA)' : 'Preventive Maintenance (PM)'}
                </p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-500">Title</label>
                <p className="text-sm font-medium text-slate-800 mt-1">{task.title}</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-slate-500">Time</label>
                <p className="text-sm font-medium text-slate-800 mt-1">{task.time}</p>
              </div>
              {task.Sid && (
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Site ID</label>
                  <p className="text-sm font-medium text-slate-800 mt-1">{task.Sid}</p>
                </div>
              )}
              {task.startDate && (
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Start Date</label>
                  <p className="text-sm font-medium text-slate-800 mt-1">{formatDate(task.startDate)}</p>
                </div>
              )}
              {task.endDate && (
                
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">End Date</label>
                  <p className="text-sm font-medium text-slate-800 mt-1">{formatDate(task.endDate)}</p>
                </div>
              )}
              {task.Sname && (
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Site Name</label>
                  <p className="text-sm font-medium text-slate-800 mt-1">{task.Sname}</p>
                </div>
              )}
              
              {task.priority && (
                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500">Priority</label>
                  <p className="text-sm font-medium text-slate-800 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      task.priority === 'High' ? 'bg-red-100 text-red-700' :
                      task.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {task.priority}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Engineers */}
          {(task.Eng_ids && task.Eng_ids.length > 0) || task.engineer ? (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Assigned Engineers</h3>
              <div className="flex flex-wrap gap-2">
                {task.Eng_ids?.map((eng) => (
                  <span
                    key={eng.id}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                  >
                    {eng.name}{eng.lastName ? ' ' + eng.lastName : ''}
                  </span>
                ))}
                {!task.Eng_ids && task.engineer && (
                  <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                    {task.engineer}
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {/* MA Contract Information */}
          {task.taskType === 'MA' && (task.vendorName || task.slaTerm || task.duration || task.assetBinding) && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Contract Information</h3>
              <div className="grid grid-cols-2 gap-3">
                {task.vendorName && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-500">Vendor Name</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{task.vendorName}</p>
                  </div>
                )}
                {task.slaTerm && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-500">SLA Term</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{task.slaTerm}</p>
                  </div>
                )}
                {task.duration && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-500">Duration</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{task.duration} months</p>
                  </div>
                )}
                {task.assetBinding && (
                  <div className="col-span-2">
                    <label className="text-[10px] font-semibold uppercase text-slate-500">Asset Binding</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{task.assetBinding}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Assets */}
          {(task.assets && task.assets.length > 0) && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3">
                Selected Assets ({task.assets.length})
              </h3>
              <div className="space-y-2">
                {task.assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-2.5 bg-white rounded-lg border border-slate-200"
                  >
                    <p className="text-xs font-medium text-slate-800">{asset.name}</p>
                    <div className="flex gap-2 text-[10px] text-slate-500 mt-1">
                      <span>Type: {asset.type}</span>
                      {asset.serialNumber && <span>| SN: {asset.serialNumber}</span>}
                      {asset.site && <span>| Site: {asset.site}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coverage Scope */}
          {task.coverageScope && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Coverage Scope</h3>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.coverageScope}</p>
            </div>
          )}

          {/* Travel Information */}
          {(task.travelMethod || task.travelCost) && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Travel Information</h3>
              <div className="grid grid-cols-2 gap-3">
                {task.travelMethod && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-500">Travel Method</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">{task.travelMethod}</p>
                  </div>
                )}
                {task.travelCost && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-500">Travel Cost</label>
                    <p className="text-sm font-medium text-slate-800 mt-1">
                      {parseFloat(task.travelCost).toLocaleString('th-TH')} THB
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Task Status Section */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Task Status</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStatus('done')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  status === 'done'
                    ? 'bg-green-500 text-white shadow-md'
                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-green-300'
                }`}
              >
                Done
              </button>
              <button
                onClick={() => setStatus('working')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  status === 'working'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-orange-300'
                }`}
              >
                Working on it
              </button>
              <button
                onClick={() => setStatus('stuck')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  status === 'stuck'
                    ? 'bg-red-500 text-white shadow-md'
                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-red-300'
                }`}
              >
                Stuck
              </button>
              <button
                onClick={() => setStatus('not-started')}
                className={`py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                  status === 'not-started'
                    ? 'bg-gray-400 text-white shadow-md'
                    : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-gray-300'
                }`}
              >
                Not Started
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-3 px-6 py-4 border-t bg-slate-50">
          <div className="flex gap-3">
            {onEdit && (
              <button
                onClick={() => {
                  if (task && onEdit) {
                    // Ensure dates are in YYYY-MM-DD format for date inputs
                    const formatDateForInput = (dateString?: string): string => {
                      if (!dateString) return '';
                      const date = new Date(dateString);
                      if (isNaN(date.getTime())) return '';
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      return `${year}-${month}-${day}`;
                    };

                    const taskToEdit = {
                      ...task,
                      startDate: formatDateForInput(task.startDate),
                      endDate: formatDateForInput(task.endDate),
                      // Ensure contractId is included (check multiple possible field names)
                      contractId: task.contractId || (task as any).contract_id || undefined,
                      // Ensure replacementDeviceId is included
                      replacementDeviceId: task.replacementDeviceId || (task as any).replacement_device_id || undefined,
                      // Ensure assets are included
                      assets: task.assets || [],
                      // Ensure SLA term is included for MA tasks
                      slaTerm: task.slaTerm || (task as any).sla_term || undefined,
                      // Ensure vendorName is included for MA tasks
                      vendorName: task.vendorName || (task as any).vendor_name || undefined,
                      // Ensure duration is included for MA tasks
                      duration: task.duration || undefined,
                    };
                    onEdit(taskToEdit);
                  }
                }}
                className="px-6 py-2.5 bg-purple-500 text-white rounded-xl font-semibold text-sm hover:bg-purple-600 transition-colors shadow-md"
              >
                Edit
              </button>
            )}
            {onDelete && task && (
              <button
                onClick={() => {
                  if (task && onDelete && confirm('คุณแน่ใจหรือไม่ว่าต้องการลบ Task นี้?')) {
                    onDelete(task.id);
                  }
                }}
                className="px-6 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors shadow-md flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-3 ml-auto">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-blue-500 text-white rounded-xl font-semibold text-sm hover:bg-blue-600 transition-colors shadow-md"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
