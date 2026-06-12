'use client';
import { Paperclip, ImageIcon, X } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface FileUploadBlockProps {
  filePaths: string[];
  imagePaths: string[];
  uploading: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: 'file' | 'image') => void;
  onRemoveFile: (index: number) => void;
  onRemoveImage: (index: number) => void;
}

export function FileUploadBlock({
  filePaths,
  imagePaths,
  uploading,
  onFileSelect,
  onRemoveFile,
  onRemoveImage,
}: FileUploadBlockProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-gradient-to-r from-slate-50 to-blue-50/30 px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:scale-105 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50">
          <Paperclip size={18} />
          <span>Upload File</span>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf"
            className="sr-only"
            aria-label="Upload File"
            disabled={uploading}
            onChange={(e) => onFileSelect(e, 'file')}
          />
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-gradient-to-r from-slate-50 to-purple-50/30 px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:scale-105 hover:border-purple-300 hover:bg-purple-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50">
          <ImageIcon size={18} />
          <span>Upload Image</span>
          <input
            type="file"
            multiple
            accept="image/*"
            className="sr-only"
            aria-label="Upload Image"
            disabled={uploading}
            onChange={(e) => onFileSelect(e, 'image')}
          />
        </label>
        {uploading && (
          <span className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-600">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <span>Uploading...</span>
          </span>
        )}
      </div>

      {(filePaths.length > 0 || imagePaths.length > 0) && (
        <div className="space-y-3">
          {filePaths.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                <span>📎</span>
                <span>Attached File</span>
              </p>
              <ul className="space-y-2">
                {filePaths.map((p, i) => (
                  <li
                    key={p}
                    className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
                  >
                    <a
                      href={apiUrl(p)}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-[220px] truncate text-blue-600 hover:underline"
                    >
                      {p.split('/').pop()}
                    </a>
                    <button
                      type="button"
                      onClick={() => onRemoveFile(i)}
                      className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {imagePaths.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Image
              </p>
              <ul className="space-y-2">
                {imagePaths.map((p, i) => (
                  <li
                    key={p}
                    className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-sm"
                  >
                    <img src={apiUrl(p)} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    <a
                      href={apiUrl(p)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 flex-1 truncate text-blue-600 hover:underline"
                    >
                      {p.split('/').pop()}
                    </a>
                    <button
                      type="button"
                      onClick={() => onRemoveImage(i)}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
