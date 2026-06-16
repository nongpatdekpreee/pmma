'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { MaWorkOrderData } from '@/lib/maWorkOrder';
import {
  buildMaWorkOrderFilename,
  downloadMaWorkOrderPdf,
  fetchMaWorkOrderFromTask,
} from '@/lib/maWorkOrder';
import { MaWorkOrderDocument } from './MaWorkOrderDocument';

export type MaWorkOrderPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  data: MaWorkOrderData | null;
  task?: Record<string, unknown> | null;
  title?: string;
  loading?: boolean;
};

/** Modal ดู layout ฟอร์มก่อน export PDF */
export function MaWorkOrderPreviewModal({
  isOpen,
  onClose,
  data,
  task,
  title = 'ตัวอย่างใบแจ้งซ่อม/เปลี่ยนอุปกรณ์',
  loading = false,
}: MaWorkOrderPreviewModalProps) {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handleDownload = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const filename = task ? buildMaWorkOrderFilename(task) : 'MA_work_order.pdf';
      await downloadMaWorkOrderPdf(data, filename);
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/50">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-2">
          {data && (
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-60"
            >
              <Download size={14} />
              {downloading ? 'กำลังสร้าง PDF…' : 'ดาวน์โหลด PDF'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            <X size={14} />
            ปิด
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-foreground">กำลังเตรียมข้อมูลฟอร์ม…</p>
        ) : data ? (
          <MaWorkOrderDocument data={data} withPreviewShell />
        ) : (
          <p className="p-8 text-center text-sm text-muted-foreground">ไม่มีข้อมูลสำหรับแสดงฟอร์ม</p>
        )}
      </div>
    </div>
  );
}

/** โหลดข้อมูลเสริม (SOF, device detail) แล้ว map เป็น MaWorkOrderData */
export function useMaWorkOrderFromTask(
  task: Record<string, unknown> | null | undefined,
  enabled: boolean
) {
  const [data, setData] = useState<MaWorkOrderData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !task || String(task.taskType ?? task.task_type ?? '').toUpperCase() !== 'MA') {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const mapped = await fetchMaWorkOrderFromTask(task);
        if (!cancelled) setData(mapped);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, task]);

  return { data, loading };
}
