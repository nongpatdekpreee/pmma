'use client';

import { X, AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

export type AlertType = 'success' | 'error' | 'info' | 'warning';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  /** When set, shows a second button and calls this on primary (then closes). */
  onConfirm?: () => void | Promise<void>;
  cancelText?: string;
  /** Use red primary button for destructive confirm. */
  dangerConfirm?: boolean;
}

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  onConfirm,
  cancelText = 'Cancel',
  dangerConfirm = false,
}: AlertModalProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setBusy(false);
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, busy]);

  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle2 size={48} className="text-green-500" />,
    error: <XCircle size={48} className="text-red-500" />,
    info: <Info size={48} className="text-blue-500" />,
    warning: <AlertCircle size={48} className="text-yellow-500" />,
  };

  const buttonColors = {
    success: 'bg-green-500 hover:bg-green-600 text-white',
    error: 'bg-red-500 hover:bg-red-600 text-white',
    info: 'bg-blue-500 hover:bg-blue-600 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  };

  const defaultTitles = {
    success: 'สำเร็จ',
    error: 'เกิดข้อผิดพลาด',
    info: 'แจ้งเตือน',
    warning: 'คำเตือน',
  };

  const primaryClass = dangerConfirm
    ? 'bg-red-500 hover:bg-red-600 text-white'
    : buttonColors[type];

  const handlePrimary = async () => {
    if (onConfirm) {
      setBusy(true);
      try {
        await onConfirm();
      } finally {
        setBusy(false);
      }
    }
    onClose();
  };

  const isConfirm = Boolean(onConfirm);

  return (
    <div
      className="fixed inset-0 z-[20000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-card text-card-foreground rounded-2xl shadow-2xl max-w-md w-full transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">{icons[type]}</div>
            <h3 className="text-lg font-bold text-foreground">
              {title || defaultTitles[type]}
            </h3>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
            {message}
          </p>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-border">
          {isConfirm && (
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg font-semibold transition-all border border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={handlePrimary}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-60 ${primaryClass}`}
          >
            {busy ? '…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
