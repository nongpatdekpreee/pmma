'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Image as ImageIcon,
  Download,
  Eye,
  Plus,
  Trash2,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { PmWorkOrderDocument } from '@/components/pm-work-order';
import { getContractById, postPmReport, uploadReportFile } from '@/lib/api';
import { parseSiteContact1FromContractContact } from '@/lib/contractSiteContact';
import { compressImageFile } from '@/lib/compressImage';
import { prepareReportUploadFile } from '@/lib/prepareReportUploadFile';
import {
  type PmBackupRecord,
  type PmFullDocument,
  type PmMaintenanceItemDraft,
  type PmTaskContext,
  buildPmFullDocumentMulti,
  buildPmWorkOrderFilename,
  createDefaultMaintenanceDrafts,
  downloadPmWorkOrderPdf,
  deviceNameKey,
  findBackupForDevice,
  generatePmWorkOrderPdfBlob,
  parseBackupFile,
} from '@/lib/pmWorkOrder';

const STEPS = [
  { id: 1, label: 'Backup' },
  { id: 2, label: 'Photos' },
  { id: 3, label: 'Preview' },
] as const;

export type PmSavePhase = 'generating-pdf' | 'uploading-pdf' | 'saving-report' | null;

export type PmReportWizardHandle = {
  canSave: () => boolean;
  save: () => Promise<void>;
  isPdfPreparing: () => boolean;
  isPdfReady: () => boolean;
};

type Device = {
  Did: number;
  CI_Name?: string;
  serial?: string;
  model?: string;
  Location2?: string;
  Sitename?: string;
};

type Props = {
  /** จาก "Tasks to Report" ด้านบน — ไม่เลือก task ซ้ำใน wizard */
  selectedTaskId: number | null;
  technicianName: string;
  pmDate: string;
  siteName?: string;
  /** PM ครั้งที่ (จากลำดับ task PM ของ site ในปี) */
  pmNo?: string;
  /** contract_id จาก task (= SLid) — โหลด site_contact_1 อัตโนมัติ */
  contractId?: number | null;
  allowedDevices: Device[];
  loadingDevices: boolean;
  toastSuccess: (msg: string, ms?: number) => void;
  toastError: (msg: string) => void;
  toastWarning: (msg: string) => void;
  onSavePhase?: (phase: PmSavePhase) => void;
  onPdfPrepareState?: (state: { preparing: boolean; ready: boolean }) => void;
};


export const PmReportWizard = forwardRef<PmReportWizardHandle, Props>(function PmReportWizard(
  {
    selectedTaskId,
    technicianName,
    pmDate,
    siteName = '',
    pmNo = '1',
    contractId = null,
    allowedDevices,
    loadingDevices,
    toastSuccess,
    toastError,
    toastWarning,
    onSavePhase,
    onPdfPrepareState,
  },
  ref
) {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [contactName, setContactName] = useState('');
  const [contactTel, setContactTel] = useState('');

  const [backupRecords, setBackupRecords] = useState<PmBackupRecord[]>([]);
  const [backupFileName, setBackupFileName] = useState('');
  const [backupError, setBackupError] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupByDid, setBackupByDid] = useState<Map<number, PmBackupRecord | null>>(new Map());
  const [backupMapped, setBackupMapped] = useState(false);
  const [mappedPreviewExpanded, setMappedPreviewExpanded] = useState(false);

  const [maintenanceRows, setMaintenanceRows] = useState<PmMaintenanceItemDraft[]>([]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfPreparing, setPdfPreparing] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const pdfCacheRef = useRef<{ doc: PmFullDocument; blob: Blob } | null>(null);
  const onPdfPrepareStateRef = useRef(onPdfPrepareState);
  onPdfPrepareStateRef.current = onPdfPrepareState;

  const baseTaskContext = useMemo((): PmTaskContext => {
    const site = String(siteName || allowedDevices[0]?.Sitename || '').trim();
    return {
      taskId: selectedTaskId ?? undefined,
      siteName: site,
      pmDate,
      pmNo,
      technicianName,
      contactName: contactName.trim(),
      contactTel: contactTel.trim(),
    };
  }, [selectedTaskId, siteName, allowedDevices, pmDate, pmNo, technicianName, contactName, contactTel]);

  /** เปลี่ยน task ด้านบน → รีเซ็ต backup/photos ใน wizard */
  useEffect(() => {
    setBackupRecords([]);
    setBackupFileName('');
    setBackupError('');
    setBackupByDid(new Map());
    setBackupMapped(false);
    setMappedPreviewExpanded(false);
    setMaintenanceRows([]);
    setStep(1);
  }, [selectedTaskId]);

  /** โหลด Contact Name / Tel จาก site_contact_1 ของสัญญา */
  useEffect(() => {
    let cancelled = false;
    if (selectedTaskId == null || contractId == null || contractId <= 0) {
      setContactName('');
      setContactTel('');
      return;
    }
    void (async () => {
      try {
        const res = await getContractById(contractId);
        if (cancelled) return;
        if (!res.success || !res.data) {
          setContactName('');
          setContactTel('');
          return;
        }
        const { name, tel } = parseSiteContact1FromContractContact(res.data.contact);
        setContactName(name);
        setContactTel(tel.replace(/\D/g, '').slice(0, 15));
      } catch {
        if (!cancelled) {
          setContactName('');
          setContactTel('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTaskId, contractId]);

  const fullDocument = useMemo((): PmFullDocument | null => {
    if (!backupMapped || allowedDevices.length === 0) return null;
    return buildPmFullDocumentMulti(baseTaskContext, allowedDevices, maintenanceRows, backupByDid);
  }, [backupMapped, allowedDevices, baseTaskContext, maintenanceRows, backupByDid]);

  /** Inspection rows ที่ match backup จริง (Device name ตรง) */
  const matchedInspections = useMemo(() => {
    if (!fullDocument) return [];
    return allowedDevices.flatMap((device, idx) => {
      if (!backupByDid.get(device.Did)) return [];
      const inspection = fullDocument.inspections[idx];
      return inspection ? [inspection] : [];
    });
  }, [fullDocument, allowedDevices, backupByDid]);

  const mappedDeviceCount = matchedInspections.length;
  const allDevicesMatched =
    backupMapped && mappedDeviceCount === allowedDevices.length && allowedDevices.length > 0;

  /** Pre-generate PDF ตอน Step 3 — กด Save แล้วไม่ต้องรอสร้างใหม่ */
  useEffect(() => {
    if (step !== 3 || !fullDocument) {
      pdfCacheRef.current = null;
      setPdfPreparing(false);
      setPdfReady(false);
      onPdfPrepareStateRef.current?.({ preparing: false, ready: false });
      return;
    }

    let cancelled = false;
    setPdfPreparing(true);
    setPdfReady(false);
    onPdfPrepareStateRef.current?.({ preparing: true, ready: false });

    generatePmWorkOrderPdfBlob(fullDocument)
      .then((blob) => {
        if (cancelled) return;
        pdfCacheRef.current = { doc: fullDocument, blob };
        setPdfReady(true);
        onPdfPrepareStateRef.current?.({ preparing: false, ready: true });
      })
      .catch((err) => {
        console.error(err);
        if (cancelled) return;
        pdfCacheRef.current = null;
        setPdfReady(false);
        onPdfPrepareStateRef.current?.({ preparing: false, ready: false });
      })
      .finally(() => {
        if (!cancelled) setPdfPreparing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, fullDocument]);

  const handleBackupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!selectedTaskId) {
      toastWarning('Please select a task in Tasks to Report first.');
      return;
    }
    if (allowedDevices.length === 0) {
      toastWarning('No devices linked to this task.');
      return;
    }
    setBackupLoading(true);
    setBackupError('');
    try {
      const records = await parseBackupFile(file);
      if (!records.length) {
        setBackupError('No records found in backup file.');
        setBackupRecords([]);
        setBackupFileName('');
        setBackupByDid(new Map());
        setBackupMapped(false);
        return;
      }

      const nextBackupByDid = new Map<number, PmBackupRecord | null>();
      const unmapped: string[] = [];
      let mappedCount = 0;

      for (const device of allowedDevices) {
        const label = device.CI_Name || device.model || `Device ${device.Did}`;
        let backup: PmBackupRecord | null = null;

        if (!deviceNameKey(device)) {
          unmapped.push(`${label}: no device name (CI_Name) in task`);
        } else {
          backup = findBackupForDevice(records, device) ?? null;
          if (backup) {
            mappedCount += 1;
          } else {
            unmapped.push(`${label}: device name not found in backup (Host Name / hostname column)`);
          }
        }
        nextBackupByDid.set(device.Did, backup);
      }

      setBackupRecords(records);
      setBackupFileName(file.name);
      setBackupByDid(nextBackupByDid);
      setBackupMapped(true);

      setMaintenanceRows(
        allowedDevices.map((d) => {
          const backup = nextBackupByDid.get(d.Did);
          return {
            id: `row-${d.Did}`,
            deviceDid: d.Did,
            deviceLabel: d.CI_Name || d.serial || `Device ${d.Did}`,
            location: '',
            rack: backup?.rackRu || '',
            remark: '',
            technicianNote: '',
          };
        })
      );

      if (unmapped.length) {
        setBackupError(
          `Could not map ${unmapped.length} device(s) — Device name (CI_Name) must match backup Host Name. ${unmapped.slice(0, 5).join('; ')}${unmapped.length > 5 ? `; +${unmapped.length - 5} more` : ''}`
        );
      } else {
        setBackupError('');
      }
      toastSuccess(`Mapped backup for ${mappedCount} of ${allowedDevices.length} device(s)`);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to parse backup');
      setBackupRecords([]);
      setBackupByDid(new Map());
      setBackupMapped(false);
    } finally {
      setBackupLoading(false);
    }
  };

  const updateMaintenanceRow = (id: string, patch: Partial<PmMaintenanceItemDraft>) => {
    setMaintenanceRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleRowPhoto = async (rowId: string, side: 'before' | 'after', file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toastWarning('Please upload an image file.');
      return;
    }
    try {
      const { file: compressed, preview: compressedPreview } = await compressImageFile(file);
      updateMaintenanceRow(rowId, side === 'before'
        ? { beforeFile: compressed, beforePreview: compressedPreview }
        : { afterFile: compressed, afterPreview: compressedPreview });
    } catch {
      toastError('Failed to read image.');
    }
  };

  const canGoStep2 = Boolean(
    selectedTaskId && allowedDevices.length > 0 && backupMapped && allDevicesMatched
  );
  const canGoStep3 = maintenanceRows.length > 0 && maintenanceRows.every((r) => r.beforePreview && r.afterPreview);

  const handleDownloadPdf = async () => {
    if (!fullDocument) return;
    setGeneratingPdf(true);
    try {
      const filename = buildPmWorkOrderFilename({
        site: baseTaskContext.siteName,
        pmDate,
        taskId: selectedTaskId ?? undefined,
      });
      await downloadPmWorkOrderPdf(fullDocument, filename);
      toastSuccess('PDF downloaded');
    } catch (err) {
      console.error(err);
      toastError('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!selectedTaskId || !fullDocument || allowedDevices.length === 0) {
      toastWarning('Complete all steps before saving.');
      return;
    }
    try {
      onSavePhase?.('generating-pdf');
      const site = baseTaskContext.siteName || 'Unknown';
      const primaryDeviceId = String(allowedDevices[0].Did);

      const filesWithPath: Array<{ name: string; type: string; path?: string; slot?: string }> = [];

      let pdfBlob: Blob;
      if (pdfCacheRef.current?.doc === fullDocument) {
        pdfBlob = pdfCacheRef.current.blob;
      } else {
        pdfBlob = await generatePmWorkOrderPdfBlob(fullDocument);
        pdfCacheRef.current = { doc: fullDocument, blob: pdfBlob };
      }

      const pdfFile = new File(
        [pdfBlob],
        buildPmWorkOrderFilename({ site, pmDate, taskId: selectedTaskId }),
        { type: 'application/pdf' }
      );

      onSavePhase?.('uploading-pdf');
      let uploadPdfFile: File;
      try {
        uploadPdfFile = await prepareReportUploadFile(pdfFile, 'pdf');
      } catch (compressErr) {
        console.error(compressErr);
        toastError(
          compressErr instanceof Error
            ? compressErr.message
            : 'Failed to compress PM report PDF before upload.'
        );
        return;
      }
      const pdfUp = await uploadReportFile(uploadPdfFile);
      if (!pdfUp.success || !pdfUp.path) {
        toastError('Failed to upload PM report PDF.');
        return;
      }
      filesWithPath.push({
        name: pdfFile.name,
        type: 'pdf',
        path: pdfUp.path,
        slot: 'pm_report_pdf',
      });

      const combinedComment = maintenanceRows
        .filter((r) => r.technicianNote?.trim())
        .map((r) => {
          const label = r.deviceLabel || 'Device';
          return `${label}: ${r.technicianNote!.trim()}`;
        })
        .join('\n');

      onSavePhase?.('saving-report');
      const res = await postPmReport({
        taskId: selectedTaskId,
        deviceId: primaryDeviceId,
        device: allowedDevices[0] ?? undefined,
        checklistItems: [],
        uploadedFiles: filesWithPath,
        comment: combinedComment,
        technicianName,
        pmDate,
        pmResult: 'pass',
        createdAt: new Date().toISOString(),
      });

      if (res.success) {
        toastSuccess(res.message || 'PM report saved successfully', 3200);
        window.setTimeout(() => router.push('/pmchecklist_report'), 1200);
      } else {
        toastError(res.message || 'Failed to submit report');
      }
    } catch (e) {
      console.error(e);
      toastError('Error submitting report.');
    } finally {
      onSavePhase?.(null);
    }
  }, [
    selectedTaskId,
    fullDocument,
    allowedDevices,
    maintenanceRows,
    baseTaskContext.siteName,
    pmDate,
    technicianName,
    toastSuccess,
    toastError,
    toastWarning,
    onSavePhase,
    router,
  ]);

  const canSaveReport = Boolean(
    selectedTaskId &&
      backupMapped &&
      allDevicesMatched &&
      maintenanceRows.length > 0 &&
      maintenanceRows.every((r) => r.beforePreview && r.afterPreview) &&
      fullDocument
  );

  useImperativeHandle(
    ref,
    () => ({
      canSave: () => canSaveReport,
      save: handleSave,
      isPdfPreparing: () => pdfPreparing,
      isPdfReady: () => pdfReady,
    }),
    [canSaveReport, handleSave, pdfPreparing, pdfReady]
  );

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              if (s.id === 2 && !canGoStep2) return;
              if (s.id === 3 && !canGoStep3) return;
              setStep(s.id);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              step === s.id
                ? 'bg-blue-600 text-white'
                : step > s.id
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-xs">{s.id}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step 1 — Backup (all devices in task) */}
      {step === 1 && (
        <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-6">
          <h2 className="text-lg font-bold">Step 1 — Upload Backup & Map All Devices</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-muted-foreground">Contact Name</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Enter contact name for PM document"
                className="w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-muted-foreground">Tel</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={15}
                value={contactTel}
                onChange={(e) => setContactTel(e.target.value.replace(/\D/g, '').slice(0, 15))}
                placeholder="Numbers only, max 15 digits"
                className="w-full rounded-xl border border-border bg-card p-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {!selectedTaskId ? (
            <p className="text-sm text-muted-foreground">
              Please select a task in <strong>Tasks to Report</strong> above first.
            </p>
          ) : loadingDevices ? (
            <p className="text-sm text-muted-foreground">Loading devices...</p>
          ) : allowedDevices.length === 0 ? (
            <p className="text-sm text-amber-700">No devices linked to this task.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{allowedDevices.length}</strong> device(s) in this task — matched
                when <strong className="text-foreground">Device name</strong> (CI_Name in task ↔ Host Name /
                hostname in backup file) matches.
              </p>
              <div className="rounded-xl border-2 border-dashed border-border bg-muted p-8 text-center">
                <input type="file" id="pm-backup-upload" accept=".json,.csv,.xlsx,.xls" className="sr-only" onChange={handleBackupUpload} disabled={backupLoading} />
                <label htmlFor="pm-backup-upload" className="flex cursor-pointer flex-col items-center gap-2">
                  <Upload size={32} className="text-muted-foreground" />
                  <span className="text-sm font-medium">{backupLoading ? 'Parsing...' : 'Select backup file'}</span>
                  {backupFileName && <span className="text-xs text-muted-foreground">{backupFileName}</span>}
                  {backupMapped && backupRecords.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {backupRecords.length} row(s) in backup file
                    </span>
                  )}
                </label>
              </div>
              {backupError && <p className="text-sm text-amber-700">{backupError}</p>}
              {backupMapped && mappedDeviceCount > 0 && (
                <div
                  className={`rounded-xl border p-4 ${
                    allDevicesMatched
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <p
                    className={`mb-2 flex items-center gap-2 text-sm font-semibold ${
                      allDevicesMatched ? 'text-emerald-800' : 'text-amber-900'
                    }`}
                  >
                    <CheckCircle2 size={18} />
                    Matched {mappedDeviceCount} of {allowedDevices.length} task device(s)
                    {backupRecords.length > 0 && (
                      <span className="font-normal">
                        {' '}
                        — backup file has {backupRecords.length} row(s); at most {backupRecords.length} can match
                      </span>
                    )}
                  </p>
                  {(mappedPreviewExpanded ? matchedInspections : matchedInspections.slice(0, 3)).length >
                    0 && (
                    <div
                      className={`space-y-0 ${mappedPreviewExpanded && matchedInspections.length > 5 ? 'max-h-52 overflow-y-auto' : ''}`}
                    >
                      {(mappedPreviewExpanded
                        ? matchedInspections
                        : matchedInspections.slice(0, 3)
                      ).map((insp, idx) => (
                        <div
                          key={`${insp.serialNumber}-${insp.model}-${idx}`}
                          className={`grid grid-cols-2 gap-2 border-t py-2 text-xs first:border-t-0 first:pt-0 ${
                            allDevicesMatched ? 'border-emerald-200/60' : 'border-amber-200/60'
                          }`}
                        >
                          <span className="col-span-2 font-medium">{insp.serialNumber || '—'}</span>
                          <span>Model: {insp.model || '—'}</span>
                          <span>Hostname: {insp.hostname || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {matchedInspections.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setMappedPreviewExpanded((v) => !v)}
                      className={`mt-2 flex w-full items-center justify-center gap-1 text-xs font-medium hover:underline ${
                        allDevicesMatched ? 'text-emerald-800' : 'text-amber-900'
                      }`}
                    >
                      {mappedPreviewExpanded
                        ? 'Show less'
                        : `Show matched devices (+${matchedInspections.length - 3} more)`}
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${mappedPreviewExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                  )}
                </div>
              )}
              {backupMapped && mappedDeviceCount === 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  No devices matched the backup file. Check Host Name / hostname column vs CI_Name in task.
                </div>
              )}
            </>
          )}
          <div className="flex flex-col items-end gap-1">
            {backupError && (
              <p className="text-xs text-amber-700">Fix backup mapping before continuing to photos.</p>
            )}
            <button
              type="button"
              disabled={!canGoStep2}
              onClick={() => {
                if (!canGoStep2) {
                  toastWarning(
                    backupError
                      ? 'All devices must match the backup file (device name) before continuing.'
                      : 'Upload a backup file and map all devices first.'
                  );
                  return;
                }
                setStep(2);
              }}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Maintenance Photos
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Photos */}
      {step === 2 && (
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Step 2 — Maintenance Items (Before / After)</h2>
            <button
              type="button"
              onClick={() =>
                setMaintenanceRows((rows) => [
                  ...rows,
                  ...createDefaultMaintenanceDrafts(baseTaskContext, 1).map((r) => ({ ...r, id: `row-${Date.now()}` })),
                ])
              }
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm"
            >
              <Plus size={16} /> Add row
            </button>
          </div>
          <div className="space-y-4">
            {maintenanceRows.map((row, idx) => (
              <div key={row.id} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold">
                    {row.deviceLabel ? `${row.deviceLabel}` : `Row ${idx + 1}`}
                  </span>
                  {maintenanceRows.length > allowedDevices.length && (
                    <button type="button" onClick={() => setMaintenanceRows((r) => r.filter((x) => x.id !== row.id))} className="text-red-500">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium">Location</label>
                    <input value={row.location} onChange={(e) => updateMaintenanceRow(row.id, { location: e.target.value })} className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Rack</label>
                    <input value={row.rack} onChange={(e) => updateMaintenanceRow(row.id, { rack: e.target.value })} className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(['before', 'after'] as const).map((side) => {
                    const preview = side === 'before' ? row.beforePreview : row.afterPreview;
                    const inputId = `${row.id}-${side}`;
                    return (
                      <div key={side}>
                        <label className="text-xs font-medium capitalize">{side}</label>
                        <div className="mt-1 flex items-start gap-2">
                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={preview} alt={side} className="h-20 w-20 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted">
                              <ImageIcon size={20} className="text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <input
                              type="file"
                              id={inputId}
                              accept="image/*"
                              className="sr-only"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void handleRowPhoto(row.id, side, f);
                                e.target.value = '';
                              }}
                            />
                            <label htmlFor={inputId} className="cursor-pointer rounded-lg border px-3 py-1.5 text-xs">
                              Upload
                            </label>
                            {preview && (
                              <button type="button" className="ml-2 text-xs text-red-500" onClick={() => updateMaintenanceRow(row.id, side === 'before' ? { beforeFile: null, beforePreview: null } : { afterFile: null, afterPreview: null })}>
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3">
                  <label className="text-xs font-medium">Remark</label>
                  <input value={row.remark} onChange={(e) => updateMaintenanceRow(row.id, { remark: e.target.value })} className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm" />
                </div>
                <div className="mt-3">
                  <label className="text-xs font-medium">Notes from Technician</label>
                  <textarea
                    value={row.technicianNote ?? ''}
                    onChange={(e) => updateMaintenanceRow(row.id, { technicianNote: e.target.value })}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-border bg-muted px-2 py-1.5 text-sm"
                    placeholder="Notes for this device..."
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="rounded-xl border px-4 py-2 text-sm">Back</button>
            <button type="button" disabled={!canGoStep3} onClick={() => setStep(3)} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              Next: Preview
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Preview */}
      {step === 3 && fullDocument && (
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold">Step 3 — Preview & Download PDF</h2>
          <div className="overflow-auto rounded-xl border border-border">
            <PmWorkOrderDocument data={fullDocument} withPreviewShell />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void handleDownloadPdf()} disabled={generatingPdf} className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium disabled:opacity-50">
              <Download size={18} />
              {generatingPdf ? 'Generating...' : 'Download PDF'}
            </button>
            <button type="button" onClick={() => setStep(2)} className="flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm">
              <Eye size={18} /> Edit Photos
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {pdfPreparing
              ? 'Preparing PDF in the background — Save will be ready shortly.'
              : pdfReady
                ? 'PDF is ready. Use Save PM Report at the bottom of the page to upload it.'
                : 'Use Save PM Report at the bottom of the page to upload the PDF automatically — no need to download and re-upload.'}
          </p>
        </div>
      )}
    </div>
  );
});
