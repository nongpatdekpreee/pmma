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
  FileText,
  X,
} from 'lucide-react';
import { PmWorkOrderDocument } from '@/components/pm-work-order';
import { getContractById, postPmReport, uploadReportFile } from '@/lib/api';
import { parseSiteContact1FromContractContact } from '@/lib/contractSiteContact';
import { compressImageFile } from '@/lib/compressImage';
import { prepareReportUploadFile } from '@/lib/prepareReportUploadFile';
import {
  type PmBackupRecord,
  type PmFullDocument,
  type PmLocationRecord,
  type PmMaintenanceItemDraft,
  type PmMonitoringBackupRecord,
  type PmTaskContext,
  buildPmFullDocumentMulti,
  buildPmWorkOrderFilename,
  buildMaintenanceRowsFromMaps,
  buildRackDisplayText,
  createDefaultMaintenanceDrafts,
  downloadPmWorkOrderPdf,
  generatePmWorkOrderPdfBlob,
  mapLocationRecordsToDevices,
  mapMonitoringBackupToDevices,
  findMonitoringForLocation,
  monitoringToPmBackupRecord,
  parseLocationFile,
  parsePmMonitoringBackupFile,
} from '@/lib/pmWorkOrder';

const STEPS = [
  { id: 1, label: 'Upload PDF' },
  { id: 2, label: 'Location' },
  { id: 3, label: 'Backup' },
  { id: 4, label: 'Photos' },
  { id: 5, label: 'Preview' },
] as const;

export type PmSavePhase = 'generating-pdf' | 'uploading-pdf' | 'saving-report' | null;

export type PmReportWizardHandle = {
  canSave: () => boolean;
  save: () => Promise<void>;
  isPdfPreparing: () => boolean;
  isPdfReady: () => boolean;
  isExternalPdfMode: () => boolean;
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
  onExternalPdfModeChange?: (active: boolean) => void;
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
    onExternalPdfModeChange,
  },
  ref
) {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [contactName, setContactName] = useState('');
  const [contactTel, setContactTel] = useState('');

  const [locationRecords, setLocationRecords] = useState<PmLocationRecord[]>([]);
  const [locationFileName, setLocationFileName] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationByDid, setLocationByDid] = useState<Map<number, PmLocationRecord | null>>(new Map());
  const [locationMapped, setLocationMapped] = useState(false);

  const [monitoringRecords, setMonitoringRecords] = useState<PmMonitoringBackupRecord[]>([]);
  const [backupFileName, setBackupFileName] = useState('');
  const [backupError, setBackupError] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupByDid, setBackupByDid] = useState<Map<number, PmBackupRecord | null>>(new Map());
  const [backupMapped, setBackupMapped] = useState(false);
  const [mappedPreviewExpanded, setMappedPreviewExpanded] = useState(false);
  const [externalPdfFile, setExternalPdfFile] = useState<File | null>(null);
  const externalPdfInputRef = useRef<HTMLInputElement>(null);

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

  /** เปลี่ยน task ด้านบน → รีเซ็ต location/backup/photos ใน wizard */
  useEffect(() => {
    setLocationRecords([]);
    setLocationFileName('');
    setLocationError('');
    setLocationByDid(new Map());
    setLocationMapped(false);
    setMonitoringRecords([]);
    setBackupFileName('');
    setBackupError('');
    setBackupByDid(new Map());
    setBackupMapped(false);
    setMappedPreviewExpanded(false);
    setExternalPdfFile(null);
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

  useEffect(() => {
    onExternalPdfModeChange?.(Boolean(externalPdfFile));
  }, [externalPdfFile, onExternalPdfModeChange]);

  const fullDocument = useMemo((): PmFullDocument | null => {
    if (!backupMapped || allowedDevices.length === 0) return null;
    return buildPmFullDocumentMulti(baseTaskContext, allowedDevices, maintenanceRows, backupByDid);
  }, [backupMapped, allowedDevices, baseTaskContext, maintenanceRows, backupByDid]);

  /** Inspection rows ที่ match backup จริง (Model + Serial ตรง) */
  const matchedInspections = useMemo(() => {
    if (!fullDocument) return [];
    return allowedDevices.flatMap((device, idx) => {
      if (!backupByDid.get(device.Did)) return [];
      const inspection = fullDocument.inspections[idx];
      return inspection ? [inspection] : [];
    });
  }, [fullDocument, allowedDevices, backupByDid]);

  const locationMappedCount = allowedDevices.filter((d) => locationByDid.get(d.Did)).length;
  const allLocationMatched =
    locationMapped && locationMappedCount === allowedDevices.length && allowedDevices.length > 0;

  const backupMappedCount = matchedInspections.length;
  const allBackupMatched =
    backupMapped && backupMappedCount === allowedDevices.length && allowedDevices.length > 0;

  /** Pre-generate PDF ตอน Step 5 — กด Save แล้วไม่ต้องรอสร้างใหม่ */
  useEffect(() => {
    if (step !== 5 || !fullDocument) {
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

  const handleLocationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    setLocationLoading(true);
    setLocationError('');
    try {
      const records = await parseLocationFile(file);
      if (!records.length) {
        setLocationError('No rows with Serial Number and Model found in location file.');
        setLocationRecords([]);
        setLocationFileName('');
        setLocationByDid(new Map());
        setLocationMapped(false);
        return;
      }

      const { locationByDid: nextLoc, mappedCount, unmapped } = mapLocationRecordsToDevices(
        allowedDevices,
        records
      );

      setLocationRecords(records);
      setLocationFileName(file.name);
      setLocationByDid(nextLoc);
      setLocationMapped(true);
      setMonitoringRecords([]);
      setBackupFileName('');
      setBackupError('');
      setBackupByDid(new Map());
      setBackupMapped(false);
      setMaintenanceRows([]);

      if (unmapped.length) {
        setLocationError(
          `Could not map ${unmapped.length} device(s) — Serial + Model must match location file. ${unmapped.slice(0, 5).join('; ')}${unmapped.length > 5 ? `; +${unmapped.length - 5} more` : ''}`
        );
      } else {
        setLocationError('');
      }
      toastSuccess(`Mapped location for ${mappedCount} of ${allowedDevices.length} device(s)`);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Failed to parse location file');
      setLocationRecords([]);
      setLocationByDid(new Map());
      setLocationMapped(false);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleMonitoringBackupUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!selectedTaskId) {
      toastWarning('Please select a task in Tasks to Report first.');
      return;
    }
    if (!allLocationMatched) {
      toastWarning('Upload and map the location file first.');
      return;
    }
    setBackupLoading(true);
    setBackupError('');
    try {
      const records = await parsePmMonitoringBackupFile(file);
      if (!records.length) {
        setBackupError('No rows found in backup file.');
        setMonitoringRecords([]);
        setBackupFileName('');
        setBackupByDid(new Map());
        setBackupMapped(false);
        return;
      }

      const { backupByDid: nextBackup, mappedCount, unmapped } = mapMonitoringBackupToDevices(
        allowedDevices,
        locationByDid,
        records
      );

      setMonitoringRecords(records);
      setBackupFileName(file.name);
      setBackupByDid(nextBackup);
      setBackupMapped(true);

      const monitoringByDid = new Map<number, PmMonitoringBackupRecord | null>();
      for (const device of allowedDevices) {
        const loc = locationByDid.get(device.Did);
        monitoringByDid.set(
          device.Did,
          loc ? findMonitoringForLocation(records, loc) ?? null : null
        );
      }
      setMaintenanceRows(
        buildMaintenanceRowsFromMaps(allowedDevices, locationByDid, nextBackup, monitoringByDid)
      );

      if (unmapped.length) {
        setBackupError(
          `Could not map ${unmapped.length} device(s) — backup row must match location IP + Model. ${unmapped.slice(0, 5).join('; ')}${unmapped.length > 5 ? `; +${unmapped.length - 5} more` : ''}`
        );
      } else {
        setBackupError('');
      }
      toastSuccess(`Mapped backup for ${mappedCount} of ${allowedDevices.length} device(s)`);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Failed to parse backup file');
      setMonitoringRecords([]);
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

  const canGoStep3 = Boolean(
    selectedTaskId && allowedDevices.length > 0 && locationMapped && allLocationMatched
  );
  const canGoStep4 = Boolean(
    selectedTaskId && backupMapped && allBackupMatched
  );
  const canGoStep5 =
    maintenanceRows.length > 0 && maintenanceRows.every((r) => r.beforePreview && r.afterPreview);

  const handleExternalPdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toastWarning('Please upload a PDF file.');
      return;
    }
    if (!selectedTaskId) {
      toastWarning('Please select a task in Tasks to Report first.');
      return;
    }
    setExternalPdfFile(file);
    toastSuccess('PM PDF ready — click Save PM Report below to submit.');
  };

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
    if (!selectedTaskId || allowedDevices.length === 0) {
      toastWarning('Please select a task with devices before saving.');
      return;
    }

    const site = baseTaskContext.siteName || 'Unknown';
    const primaryDeviceId = String(allowedDevices[0].Did);
    const filesWithPath: Array<{ name: string; type: string; path?: string; slot?: string }> = [];

    if (externalPdfFile) {
      try {
        onSavePhase?.('uploading-pdf');
        let uploadPdfFile: File;
        try {
          uploadPdfFile = await prepareReportUploadFile(externalPdfFile, 'pdf');
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
          name: externalPdfFile.name,
          type: 'pdf',
          path: pdfUp.path,
          slot: 'pm_report_pdf',
        });

        onSavePhase?.('saving-report');
        const res = await postPmReport({
          taskId: selectedTaskId,
          deviceId: primaryDeviceId,
          device: allowedDevices[0] ?? undefined,
          checklistItems: [],
          uploadedFiles: filesWithPath,
          comment: '',
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
      return;
    }

    if (!fullDocument) {
      toastWarning('Upload a finished PDF in Step 1, or complete backup and photos.');
      return;
    }
    try {
      onSavePhase?.('generating-pdf');

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
    externalPdfFile,
  ]);

  const canSaveExternalPdf = Boolean(selectedTaskId && allowedDevices.length > 0 && externalPdfFile);
  const canSaveWizard = Boolean(
    selectedTaskId &&
      locationMapped &&
      allLocationMatched &&
      backupMapped &&
      allBackupMatched &&
      maintenanceRows.length > 0 &&
      maintenanceRows.every((r) => r.beforePreview && r.afterPreview) &&
      fullDocument
  );
  const canSaveReport = canSaveExternalPdf || canSaveWizard;

  const isStepComplete = (id: number) => {
    if (id === 1) return Boolean(externalPdfFile);
    if (id === 2) return allLocationMatched;
    if (id === 3) return allBackupMatched;
    if (id === 4) return canGoStep5;
    if (id === 5) return pdfReady || Boolean(fullDocument);
    return false;
  };

  useImperativeHandle(
    ref,
    () => ({
      canSave: () => canSaveReport,
      save: handleSave,
      isPdfPreparing: () => pdfPreparing,
      isPdfReady: () => pdfReady,
      isExternalPdfMode: () => Boolean(externalPdfFile),
    }),
    [canSaveReport, handleSave, pdfPreparing, pdfReady, externalPdfFile]
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
              if (s.id === 2 && !selectedTaskId) return;
              if (s.id === 3 && !canGoStep3) return;
              if (s.id === 4 && !canGoStep4) return;
              if (s.id === 5 && !canGoStep5) return;
              setStep(s.id);
            }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              step === s.id
                ? 'bg-blue-600 text-white'
                : isStepComplete(s.id)
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-xs">{s.id}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Step 1 — Finished PM PDF (quick submit) */}
      {step === 1 && (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6">
          <h2 className="text-lg font-bold">Step 1 — Upload finished PM PDF</h2>
          <p className="text-sm text-muted-foreground">
            If you already have the PM report PDF, upload it here and click <strong>Save PM Report</strong> below — no
            need to go through backup and photos.
          </p>
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
              <div
                role="button"
                tabIndex={0}
                onClick={() => externalPdfInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    externalPdfInputRef.current?.click();
                  }
                }}
                className="rounded-xl border-2 border-dashed border-border bg-muted p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-muted/80 transition-colors"
              >
                <input
                  ref={externalPdfInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="sr-only"
                  onChange={handleExternalPdfChange}
                  disabled={backupLoading}
                />
                <FileText size={32} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drop PDF here or click to browse</p>
                {externalPdfFile && (
                  <p className="mt-2 text-xs text-emerald-800 font-medium">{externalPdfFile.name}</p>
                )}
              </div>
              {externalPdfFile && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 size={18} />
                    PDF ready — use Save PM Report at the bottom of the page
                  </span>
                  <button
                    type="button"
                    onClick={() => setExternalPdfFile(null)}
                    className="flex items-center gap-1 text-red-600 hover:text-red-800 text-xs font-medium"
                  >
                    <X size={14} /> Remove
                  </button>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end border-t border-emerald-200/60 pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!selectedTaskId || allowedDevices.length === 0}
              className="rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Or create report from location + backup files →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Location Excel */}
      {step === 2 && (
        <div className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-6">
          <h2 className="text-lg font-bold">Step 2 — Upload Location Excel</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-muted-foreground">Contact Name</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Enter contact name for PM document"
                className="w-full rounded-xl border border-border bg-card p-3 text-sm outline-none focus:ring-2 focus:ring-violet-500"
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
                className="w-full rounded-xl border border-border bg-card p-3 text-sm tabular-nums outline-none focus:ring-2 focus:ring-violet-500"
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
                <strong className="text-foreground">{allowedDevices.length}</strong> device(s) in this task — map
                when <strong className="text-foreground">Serial Number</strong> and{' '}
                <strong className="text-foreground">Model</strong> match the location file. Rack and room data
                will auto-fill on the photo step.
              </p>
              <div className="rounded-xl border-2 border-dashed border-border bg-muted p-8 text-center">
                <input
                  type="file"
                  id="pm-location-upload"
                  accept=".json,.csv,.xlsx,.xls"
                  className="sr-only"
                  onChange={handleLocationUpload}
                  disabled={locationLoading}
                />
                <label htmlFor="pm-location-upload" className="flex cursor-pointer flex-col items-center gap-2">
                  <Upload size={32} className="text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {locationLoading ? 'Parsing...' : 'Select location Excel file'}
                  </span>
                  {locationFileName && <span className="text-xs text-muted-foreground">{locationFileName}</span>}
                  {locationMapped && locationRecords.length > 0 && (
                    <span className="text-xs text-muted-foreground">{locationRecords.length} row(s) in file</span>
                  )}
                </label>
              </div>
              {locationError && <p className="text-sm text-amber-700">{locationError}</p>}
              {locationMapped && locationMappedCount > 0 && (
                <div
                  className={`rounded-xl border p-4 ${
                    allLocationMatched ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${allLocationMatched ? 'text-emerald-800' : 'text-amber-900'}`}
                  >
                    <CheckCircle2 size={18} className="mr-1 inline" />
                    Location mapped {locationMappedCount} of {allowedDevices.length} device(s)
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {allowedDevices.slice(0, 5).map((d) => {
                      const loc = locationByDid.get(d.Did);
                      return (
                        <li key={d.Did}>
                          {d.CI_Name || d.model || d.serial || d.Did}:{' '}
                          {loc
                            ? `IP ${loc.ipAddress || '—'} · Rack ${buildRackDisplayText(loc) || '—'}`
                            : 'not matched'}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStep(1)} className="rounded-xl border px-4 py-2.5 text-sm">
              Back
            </button>
            <button
              type="button"
              disabled={!canGoStep3}
              onClick={() => {
                if (!canGoStep3) {
                  toastWarning('Map all devices in the location file before continuing.');
                  return;
                }
                setStep(3);
              }}
              className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Next: Backup file
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Backup / monitoring Excel */}
      {step === 3 && (
        <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-6">
          <h2 className="text-lg font-bold">Step 3 — Upload Backup Excel</h2>
          {!selectedTaskId ? (
            <p className="text-sm text-muted-foreground">Select a task first.</p>
          ) : !allLocationMatched ? (
            <p className="text-sm text-amber-700">Complete Step 2 (location file) first.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Match backup rows to location using <strong className="text-foreground">IP Address + Model</strong>{' '}
                (falls back to Serial + Model if backup has no IP). Temperature and remarks come from this file.
              </p>
              <div className="rounded-xl border-2 border-dashed border-border bg-muted p-8 text-center">
                <input
                  type="file"
                  id="pm-backup-upload"
                  accept=".json,.csv,.xlsx,.xls"
                  className="sr-only"
                  onChange={handleMonitoringBackupUpload}
                  disabled={backupLoading}
                />
                <label htmlFor="pm-backup-upload" className="flex cursor-pointer flex-col items-center gap-2">
                  <Upload size={32} className="text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {backupLoading ? 'Parsing...' : 'Select backup Excel file'}
                  </span>
                  {backupFileName && <span className="text-xs text-muted-foreground">{backupFileName}</span>}
                  {backupMapped && monitoringRecords.length > 0 && (
                    <span className="text-xs text-muted-foreground">{monitoringRecords.length} row(s) in file</span>
                  )}
                </label>
              </div>
              {backupError && <p className="text-sm text-amber-700">{backupError}</p>}
              {backupMapped && backupMappedCount > 0 && (
                <div
                  className={`rounded-xl border p-4 ${
                    allBackupMatched ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <p
                    className={`mb-2 flex items-center gap-2 text-sm font-semibold ${
                      allBackupMatched ? 'text-emerald-800' : 'text-amber-900'
                    }`}
                  >
                    <CheckCircle2 size={18} />
                    Backup matched {backupMappedCount} of {allowedDevices.length} device(s)
                  </p>
                  {(mappedPreviewExpanded ? matchedInspections : matchedInspections.slice(0, 3)).length > 0 && (
                    <div className="space-y-0">
                      {(mappedPreviewExpanded ? matchedInspections : matchedInspections.slice(0, 3)).map(
                        (insp, idx) => (
                          <div
                            key={`${insp.serialNumber}-${insp.model}-${idx}`}
                            className="grid grid-cols-2 gap-2 border-t py-2 text-xs first:border-t-0"
                          >
                            <span className="col-span-2 font-medium">{insp.serialNumber || '—'}</span>
                            <span>Model: {insp.model || '—'}</span>
                            <span>IP: {insp.ipAddress || '—'}</span>
                            <span>Temp: {insp.temperature || '—'}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                  {matchedInspections.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setMappedPreviewExpanded((v) => !v)}
                      className="mt-2 text-xs font-medium hover:underline"
                    >
                      {mappedPreviewExpanded ? 'Show less' : `Show more (+${matchedInspections.length - 3})`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setStep(2)} className="rounded-xl border px-4 py-2.5 text-sm">
              Back
            </button>
            <button
              type="button"
              disabled={!canGoStep4}
              onClick={() => {
                if (!canGoStep4) {
                  toastWarning('Map backup file (IP + Model) for all devices before continuing.');
                  return;
                }
                setStep(4);
              }}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Next: Maintenance Photos
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Photos */}
      {step === 4 && (
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Step 4 — Maintenance Items (Before / After)</h2>
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
          <p className="text-sm text-muted-foreground">
            Location and rack are filled from the location file. Edit if needed, then upload before/after photos.
          </p>
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
            <button type="button" onClick={() => setStep(3)} className="rounded-xl border px-4 py-2 text-sm">Back</button>
            <button type="button" disabled={!canGoStep5} onClick={() => setStep(5)} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              Next: Preview
            </button>
          </div>
        </div>
      )}

      {/* Step 5 — Preview */}
      {step === 5 && fullDocument && (
        <div className="space-y-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-bold">Step 5 — Preview & Download PDF</h2>
          <div className="overflow-auto rounded-xl border border-border">
            <PmWorkOrderDocument data={fullDocument} withPreviewShell />
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void handleDownloadPdf()} disabled={generatingPdf} className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium disabled:opacity-50">
              <Download size={18} />
              {generatingPdf ? 'Generating...' : 'Download PDF'}
            </button>
            <button type="button" onClick={() => setStep(4)} className="flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm">
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
