'use client';

import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { importSofDetails } from '@/lib/api';
import { getErrorMessage } from '@/lib/unknownUtil';

type ExcelCell = string | number | boolean | Date | null | undefined;
type ExcelRow = ExcelCell[];

export type SofImportPreviewRow = {
  _row: number;
  customer: string;
  location: string;
  service: string;
  sof: string;
  contact: string;
  start_date: string;
  end_date: string;
  province: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
};

function cellToString(value: ExcelCell): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function mapHeaderKey(header: string): string | null {
  const h = header.replace(/\uFEFF/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const map: Record<string, string> = {
    customer: 'customer',
    site: 'customer',
    'site name': 'customer',
    sitename: 'customer',
    location: 'location',
    location2: 'location',
    service: 'service',
    'assigned service': 'service',
    assigned_service: 'service',
    sof: 'sof',
    'sof name': 'sof',
    sof_name: 'sof',
    'new sof': 'sof',
    new_sof: 'sof',
    refer_sof: 'sof',
    contact: 'contact',
    contacts: 'contact',
    start_date: 'start_date',
    startdate: 'start_date',
    'start date': 'start_date',
    end_date: 'end_date',
    enddate: 'end_date',
    'end date': 'end_date',
    province: 'province',
  };
  return map[h] ?? null;
}

function parseSofDetailsWorkbook(file: ArrayBuffer): {
  rows: SofImportPreviewRow[];
  errors: string[];
} {
  const workbook = XLSX.read(new Uint8Array(file), { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Workbook has no sheets');
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as ExcelRow[];
  if (!data.length) throw new Error('File is empty');

  let headerIdx = 0;
  while (headerIdx < data.length) {
    const first = cellToString(data[headerIdx]?.[0]);
    if (first.startsWith('#')) {
      headerIdx += 1;
      continue;
    }
    break;
  }
  if (headerIdx >= data.length) throw new Error('No header row found');

  const headers = (data[headerIdx] || []).map((h) => cellToString(h));
  const colIndex: Partial<Record<keyof SofImportPreviewRow, number>> = {};
  headers.forEach((h, idx) => {
    const key = mapHeaderKey(h);
    if (key) colIndex[key as keyof SofImportPreviewRow] = idx;
  });

  if (colIndex.sof == null) {
    throw new Error('Missing required column: New SOF (or SOF)');
  }
  if (colIndex.location == null) {
    throw new Error('Missing required column: Location');
  }

  const rows: SofImportPreviewRow[] = [];
  const errors: string[] = [];

  for (let r = headerIdx + 1; r < data.length; r++) {
    const raw = data[r] || [];
    if (raw.every((c) => c == null || String(c).trim() === '')) continue;

    const get = (key: keyof SofImportPreviewRow) =>
      colIndex[key] != null ? cellToString(raw[colIndex[key]!]) : '';

    const sof = get('sof');
    const location = get('location');
    if (!sof && !location) continue;

    if (!sof) {
      errors.push(`Row ${r + 1}: New SOF is required`);
      continue;
    }
    if (!location) {
      errors.push(`Row ${r + 1}: Location is required`);
      continue;
    }

    rows.push({
      _row: r + 1,
      customer: get('customer'),
      location,
      service: get('service'),
      sof,
      contact: get('contact'),
      start_date: get('start_date'),
      end_date: get('end_date'),
      province: get('province'),
    });
  }

  return { rows, errors };
}

export function ImportSofDetailsModal({
  open,
  onClose,
  onSuccess,
  onError,
  onInfo,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewRows, setPreviewRows] = useState<SofImportPreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [resultErrors, setResultErrors] = useState<string[]>([]);

  if (!open) return null;

  const reset = () => {
    setPreviewRows([]);
    setParseErrors([]);
    setResultErrors([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      onError('Please upload .xlsx, .xls or .csv');
      return;
    }
    try {
      setParsing(true);
      setParseErrors([]);
      setResultErrors([]);
      const buf = await file.arrayBuffer();
      const { rows, errors } = parseSofDetailsWorkbook(buf);
      setPreviewRows(rows);
      setParseErrors(errors);
      if (rows.length === 0 && errors.length === 0) {
        onError('No data rows found');
      }
    } catch (err: unknown) {
      onError(getErrorMessage(err) || 'Failed to parse file');
      setPreviewRows([]);
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (previewRows.length === 0) return;
    try {
      setSubmitting(true);
      setResultErrors([]);
      const res = await importSofDetails(previewRows);
      if (!res.success) {
        onError(res.message || 'Import failed');
        return;
      }
      const failed = (res.data?.results || []).filter((r) => !r.ok);
      setResultErrors(failed.map((r) => `Row ${r.row}: ${r.reason || 'Failed'}`));
      const updated = res.data?.updated ?? 0;
      if (updated > 0) {
        onInfo(res.message || `Updated ${updated} row(s)`);
        await onSuccess();
        if (failed.length === 0) handleClose();
      } else {
        onError(res.message || 'No rows updated');
      }
    } catch (err: unknown) {
      onError(getErrorMessage(err) || 'Import failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="bg-card w-full max-w-5xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-teal-50 to-cyan-50">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={24} className="text-teal-600" />
            <div>
              <h3 className="text-lg font-bold text-foreground">Import SOF Details</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Match Customer + Location + New SOF, then update contact / dates / province
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 bg-card rounded-full hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-teal-400 transition-colors">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="hidden"
              id="import-sof-details-file-input"
            />
            <label
              htmlFor="import-sof-details-file-input"
              className="cursor-pointer flex flex-col items-center gap-3"
            >
              <div className="p-4 bg-teal-100 rounded-full">
                {parsing ? (
                  <Loader2 size={32} className="text-teal-600 animate-spin" />
                ) : (
                  <Download size={32} className="text-teal-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  {parsing ? 'Parsing file...' : 'Click to upload Excel/CSV'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Columns: Customer, Location, Service, New SOF, contact, start_date, end_date, Province
                </p>
              </div>
            </label>
          </div>

          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-xs text-teal-800 space-y-1">
            <p>
              <strong>Match key:</strong> Location + New SOF (Customer used when multiple matches)
            </p>
            <p>
              <strong>Updates:</strong> contact → <code>sites_location.contact</code>, dates →
              start/end, Province → <code>location.Province</code>
            </p>
            <p>
              <strong>contact cell:</strong> multiline name / phone / email (same as sample sheet)
            </p>
          </div>

          {(parseErrors.length > 0 || resultErrors.length > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-bold text-amber-800 mb-1">Issues</p>
              <ul className="text-xs text-amber-700 space-y-0.5 list-disc ml-4">
                {[...parseErrors, ...resultErrors].slice(0, 30).map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-muted text-xs font-semibold text-muted-foreground">
                Ready: {previewRows.length} row(s)
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Row</th>
                      <th className="px-2 py-1.5 text-left">Customer</th>
                      <th className="px-2 py-1.5 text-left">Location</th>
                      <th className="px-2 py-1.5 text-left">New SOF</th>
                      <th className="px-2 py-1.5 text-left">Start</th>
                      <th className="px-2 py-1.5 text-left">End</th>
                      <th className="px-2 py-1.5 text-left">Province</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => (
                      <tr key={row._row} className="border-t border-border">
                        <td className="px-2 py-1.5">{row._row}</td>
                        <td className="px-2 py-1.5">{row.customer || '—'}</td>
                        <td className="px-2 py-1.5">{row.location}</td>
                        <td className="px-2 py-1.5 font-medium">{row.sof}</td>
                        <td className="px-2 py-1.5">{row.start_date || '—'}</td>
                        <td className="px-2 py-1.5">{row.end_date || '—'}</td>
                        <td className="px-2 py-1.5">{row.province || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl bg-muted px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={previewRows.length === 0 || submitting || parsing}
            onClick={handleSubmit}
            className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Update matched contracts
          </button>
        </div>
      </div>
    </div>
  );
}
