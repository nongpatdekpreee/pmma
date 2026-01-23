'use client';

import { useState } from 'react';
import { SidebarLayout } from '@/components/sidebar/SidebarLayout';
import DashboardHeader from '@/components/ui/Header';
import { 
  Upload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  FileText,
  Image as ImageIcon,
  Save,
  Plus,
  Trash2
} from 'lucide-react';

// PM Templates for different equipment types
const PM_TEMPLATES: Record<string, string[]> = {
  'Network Switch': [
    'ตรวจสอบสถานะ LED indicators',
    'ตรวจสอบการเชื่อมต่อสายเคเบิล',
    'ตรวจสอบอุณหภูมิการทำงาน',
    'ตรวจสอบพอร์ตที่ใช้งาน',
    'ตรวจสอบ Firmware version',
    'ตรวจสอบ Log files',
    'ทำความสะอาดอุปกรณ์',
    'ตรวจสอบ Power supply'
  ],
  'Router': [
    'ตรวจสอบสถานะการเชื่อมต่อ',
    'ตรวจสอบ Routing table',
    'ตรวจสอบ CPU และ Memory usage',
    'ตรวจสอบ Interface status',
    'ตรวจสอบ Firmware version',
    'ตรวจสอบ Security logs',
    'ทำความสะอาดอุปกรณ์',
    'ตรวจสอบ Power supply และ Cooling'
  ],
  'Firewall': [
    'ตรวจสอบ Security policies',
    'ตรวจสอบ Firewall rules',
    'ตรวจสอบ VPN connections',
    'ตรวจสอบ Threat detection',
    'ตรวจสอบ Log files',
    'ตรวจสอบ Firmware version',
    'ทำความสะอาดอุปกรณ์',
    'ตรวจสอบ High availability status'
  ],
  'Server': [
    'ตรวจสอบ CPU และ Memory usage',
    'ตรวจสอบ Disk space',
    'ตรวจสอบ System logs',
    'ตรวจสอบ Network connectivity',
    'ตรวจสอบ OS updates',
    'ตรวจสอบ Backup status',
    'ทำความสะอาดภายในเครื่อง',
    'ตรวจสอบ Power supply และ Cooling'
  ],
  'Storage System': [
    'ตรวจสอบ Disk health status',
    'ตรวจสอบ Storage capacity',
    'ตรวจสอบ RAID status',
    'ตรวจสอบ Backup status',
    'ตรวจสอบ Performance metrics',
    'ตรวจสอบ Firmware version',
    'ทำความสะอาดอุปกรณ์',
    'ตรวจสอบ Power supply'
  ],
  'UPS': [
    'ตรวจสอบ Battery status',
    'ทดสอบ Battery backup',
    'ตรวจสอบ Load capacity',
    'ตรวจสอบ Voltage output',
    'ตรวจสอบ Display และ Alarms',
    'ทำความสะอาดอุปกรณ์',
    'ตรวจสอบ Ventilation',
    'ตรวจสอบ Connection points'
  ]
};

interface ChecklistItem {
  id: string;
  task: string;
  status: 'pending' | 'pass' | 'warning' | 'fail';
  notes?: string;
}

interface UploadedFile {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'other';
  file: File;
  preview?: string;
}

export default function PMChecklistReportPage() {
  const [equipmentType, setEquipmentType] = useState<string>('');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [pmResult, setPmResult] = useState<'pass' | 'warning' | 'fail' | ''>('');
  const [comment, setComment] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [pmDate, setPmDate] = useState(new Date().toISOString().split('T')[0]);

  // Initialize checklist when equipment type changes
  const handleEquipmentTypeChange = (type: string) => {
    setEquipmentType(type);
    const template = PM_TEMPLATES[type] || [];
    setChecklistItems(
      template.map((task, index) => ({
        id: `item-${index}`,
        task,
        status: 'pending' as const,
      }))
    );
  };

  // Update checklist item status
  const updateChecklistStatus = (id: string, status: 'pending' | 'pass' | 'warning' | 'fail') => {
    setChecklistItems(items =>
      items.map(item =>
        item.id === id ? { ...item, status } : item
      )
    );
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const fileType = file.type.startsWith('image/') ? 'image' : 
                      file.type === 'application/pdf' ? 'pdf' : 'other';
      
      const uploadedFile: UploadedFile = {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: fileType,
        file,
      };

      // Create preview for images
      if (fileType === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => {
          uploadedFile.preview = e.target?.result as string;
          setUploadedFiles(prev => [...prev, uploadedFile]);
        };
        reader.readAsDataURL(file);
      } else {
        setUploadedFiles(prev => [...prev, uploadedFile]);
      }
    });
  };

  // Remove uploaded file
  const removeFile = (id: string) => {
    setUploadedFiles(files => files.filter(f => f.id !== id));
  };

  // Handle save
  const handleSave = () => {
    if (!equipmentType) {
      alert('Please select equipment type');
      return;
    }
    if (!pmResult) {
      alert('Please select PM results');
      return;
    }
    
    const reportData = {
      equipmentType,
      checklistItems,
      uploadedFiles: uploadedFiles.map(f => ({
        name: f.name,
        type: f.type,
      })),
      pmResult,
      comment,
      technicianName,
      pmDate,
      createdAt: new Date().toISOString(),
    };

    console.log('PM Report Data:', reportData);
    alert('บันทึกข้อมูล PM Checklist Report สำเร็จ');
    
    // Reset form
    setEquipmentType('');
    setChecklistItems([]);
    setUploadedFiles([]);
    setPmResult('');
    setComment('');
    setTechnicianName('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-green-500';
      case 'warning': return 'bg-amber-400';
      case 'fail': return 'bg-red-500';
      default: return 'bg-slate-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle2 size={18} className="text-white" />;
      case 'warning': return <AlertCircle size={18} className="text-white" />;
      case 'fail': return <XCircle size={18} className="text-white" />;
      default: return null;
    }
  };

  return (
    <SidebarLayout>
      <DashboardHeader />
      
      <div className="flex flex-col p-6 pt-0 gap-6 bg-slate-50 min-h-screen">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">
              PM Checklist Report
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              PM Checklist Report for equipment
            </p>
          </div>
        </div>

        {/* Main Form */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          {/* Equipment Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Equipment Type *
            </label>
            <select
              value={equipmentType}
              onChange={(e) => handleEquipmentTypeChange(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            >
              <option value="">Select...</option>
              {Object.keys(PM_TEMPLATES).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* PM Information */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Technician *
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="Enter technician name"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
               Preventive Maintenance Date *
              </label>
              <input
                type="date"
                value={pmDate}
                onChange={(e) => setPmDate(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>
          </div>

          {/* Dynamic Checklist */}
          {checklistItems.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-3">
                PM Checklist Items *
              </label>
              <div className="space-y-3">
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {item.task}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(['pending', 'pass', 'warning', 'fail'] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => updateChecklistStatus(item.id, status)}
                          className={`p-2 rounded-lg transition-all ${
                            item.status === status
                              ? `${getStatusColor(status)} shadow-md scale-110`
                              : 'bg-slate-200 hover:bg-slate-300'
                          }`}
                          title={
                            status === 'pass' ? 'Pass' :
                            status === 'warning' ? 'Warning' :
                            status === 'fail' ? 'Fail' : 'Pending'
                          }
                        >
                          {item.status === status && getStatusIcon(status)}
                          {item.status !== status && (
                            <div className={`w-4 h-4 rounded-full ${getStatusColor(status)} opacity-50`} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              Upload Images / Documents / PM Results
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50">
              <input
                type="file"
                id="file-upload"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <Upload size={32} className="text-slate-400 mb-2" />
                <p className="text-sm text-slate-600 font-medium">
                  Click to upload files (PDF/Images)
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports image and PDF files
                </p>
              </label>
            </div>

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    {file.type === 'image' && file.preview ? (
                      <img
                        src={file.preview}
                        alt={file.name}
                        className="w-12 h-12 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        {file.type === 'pdf' ? (
                          <FileText size={20} className="text-blue-600" />
                        ) : (
                          <ImageIcon size={20} className="text-blue-600" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {file.type === 'image' ? 'Image' : file.type === 'pdf' ? 'PDF' : 'File'}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PM Result Selection */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
              PM Result *
            </label>
            <div className="grid grid-cols-3 gap-4">
              {(['pass', 'warning', 'fail'] as const).map((result) => (
                <button
                  key={result}
                  onClick={() => setPmResult(result)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    pmResult === result
                      ? `${result === 'pass' ? 'border-green-500 bg-green-50' : result === 'warning' ? 'border-amber-400 bg-amber-50' : 'border-red-500 bg-red-50'} shadow-md`
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    {result === 'pass' && <CheckCircle2 size={32} className="text-green-500" />}
                    {result === 'warning' && <AlertCircle size={32} className="text-amber-400" />}
                    {result === 'fail' && <XCircle size={32} className="text-red-500" />}
                    <span className="text-sm font-bold text-slate-800 uppercase">
                      {result === 'pass' ? 'Pass' : result === 'warning' ? 'Warning' : 'Fail'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Comment Field */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-3">
             Notes from Technician
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter additional notes..."
              rows={4}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-blue-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200"
            >
              <Save size={18} />
              Save PM Report
            </button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}
