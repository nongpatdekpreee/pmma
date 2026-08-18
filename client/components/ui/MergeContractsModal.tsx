'use client';

import { useEffect, useMemo, useState } from 'react';
import { GitMerge, Loader2, X } from 'lucide-react';
import {
  getContractMergeCandidates,
  mergeContracts,
  type ContractMergeCandidate,
} from '@/lib/api';
import { isContractMergeEnabled } from '@/lib/featureFlags';
import { getErrorMessage } from '@/lib/unknownUtil';

type Props = {
  open: boolean;
  primaryContractId: number | null;
  onClose: () => void;
  onMerged: () => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  /** Prefer runtime flag from GET /api/features; falls back to NEXT_PUBLIC build flag */
  enabled?: boolean;
};

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function MergeContractsModal({
  open,
  primaryContractId,
  onClose,
  onMerged,
  onError,
  onSuccess,
  enabled,
}: Props) {
  const featureEnabled = enabled ?? isContractMergeEnabled();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [primary, setPrimary] = useState<ContractMergeCandidate | null>(null);
  const [candidates, setCandidates] = useState<ContractMergeCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [nameChoice, setNameChoice] = useState<string>('');

  useEffect(() => {
    if (!featureEnabled || !open || primaryContractId == null) return;
    let cancelled = false;
    setLoading(true);
    setSelectedIds(new Set());
    setNameChoice('');
    setPrimary(null);
    setCandidates([]);
    void (async () => {
      try {
        const res = await getContractMergeCandidates(primaryContractId);
        if (cancelled) return;
        if (!res.success || !res.data) {
          onError(res.message || 'Failed to load merge candidates');
          onClose();
          return;
        }
        setPrimary(res.data.primary);
        setCandidates(res.data.candidates);
        setNameChoice(res.data.primary.suggested_name || res.data.primary.contract_name || '');
        if (res.data.candidates.length === 0) {
          onError('No other active contracts share this SOF');
          onClose();
        }
      } catch (err) {
        if (!cancelled) {
          onError(getErrorMessage(err) || 'Failed to load merge candidates');
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, primaryContractId, onClose, onError]);

  const nameOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    const push = (value: string, label: string) => {
      const v = value.trim();
      if (!v || seen.has(v)) return;
      seen.add(v);
      opts.push({ value: v, label });
    };
    if (primary) {
      push(primary.suggested_name, `Primary site–location: ${primary.suggested_name}`);
      if (primary.contract_name.trim()) {
        push(primary.contract_name, `Primary name: ${primary.contract_name}`);
      }
    }
    for (const c of candidates) {
      if (!selectedIds.has(c.contract_id)) continue;
      push(c.suggested_name, `From #${c.contract_id} site–location: ${c.suggested_name}`);
      if (c.contract_name.trim()) {
        push(c.contract_name, `From #${c.contract_id}: ${c.contract_name}`);
      }
    }
    return opts;
  }, [primary, candidates, selectedIds]);

  useEffect(() => {
    if (nameOptions.length === 0) return;
    if (!nameOptions.some((o) => o.value === nameChoice)) {
      setNameChoice(nameOptions[0].value);
    }
  }, [nameOptions, nameChoice]);

  const selectedDeviceTotal = useMemo(() => {
    let n = 0;
    for (const c of candidates) {
      if (selectedIds.has(c.contract_id)) n += c.device_count;
    }
    return n;
  }, [candidates, selectedIds]);

  const toggleId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(candidates.map((c) => c.contract_id)));
  };

  const clearAll = () => setSelectedIds(new Set());

  const handleConfirm = async () => {
    if (!primary || selectedIds.size === 0) {
      onError('Select at least one contract to merge');
      return;
    }
    const name = nameChoice.trim();
    if (name.length > 0 && name.length < 3) {
      onError('Contract name must be at least 3 characters');
      return;
    }
    setSaving(true);
    try {
      const res = await mergeContracts({
        primary_slid: primary.contract_id,
        source_slids: Array.from(selectedIds),
        contract_name: name || null,
      });
      if (!res.success) {
        onError(res.message || 'Merge failed');
        return;
      }
      const moved = res.data?.devices_moved ?? selectedDeviceTotal;
      const closed = res.data?.closed_slids?.length ?? selectedIds.size;
      onSuccess(
        `Merged ${closed} contract(s) into #${primary.contract_id} · ${moved} device(s) moved`
      );
      onMerged();
      onClose();
    } catch (err) {
      onError(getErrorMessage(err) || 'Merge failed');
    } finally {
      setSaving(false);
    }
  };

  if (!featureEnabled || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="flex max-h-[min(90vh,40rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
              <GitMerge size={18} />
            </span>
            <div>
              <h3 className="text-base font-bold text-foreground">Merge contracts</h3>
              <p className="text-xs text-muted-foreground">Same SOF only · devices move to primary</p>
            </div>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-full bg-muted p-1.5 text-muted-foreground hover:bg-muted/80"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading || !primary ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading candidates…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                  Primary (keep)
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  #{primary.contract_id} · {primary.suggested_name || primary.contract_name || '—'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  SOF {primary.sof_name} · {primary.device_count} device(s) ·{' '}
                  {formatDate(primary.start_date)} – {formatDate(primary.end_date)}
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    Merge into primary ({candidates.length})
                  </p>
                  <div className="flex gap-2 text-xs">
                    <button type="button" className="text-violet-700 hover:underline" onClick={selectAll}>
                      Select all
                    </button>
                    <button type="button" className="text-muted-foreground hover:underline" onClick={clearAll}>
                      Clear
                    </button>
                  </div>
                </div>
                <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {candidates.map((c) => {
                    const checked = selectedIds.has(c.contract_id);
                    return (
                      <li key={c.contract_id}>
                        <label
                          className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                            checked
                              ? 'border-violet-300 bg-violet-50/80'
                              : 'border-border bg-card hover:bg-muted/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleId(c.contract_id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-foreground">
                              #{c.contract_id} · {c.suggested_name || c.contract_name || '—'}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {c.device_count} device(s) · {formatDate(c.start_date)} –{' '}
                              {formatDate(c.end_date)}
                              {c.contract_name && c.contract_name !== c.suggested_name
                                ? ` · name: ${c.contract_name}`
                                : ''}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  Contract name after merge
                </label>
                <select
                  value={nameChoice}
                  onChange={(e) => setNameChoice(e.target.value)}
                  className="w-full rounded-xl border-2 border-border bg-muted px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                >
                  {nameOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={nameChoice}
                  onChange={(e) => setNameChoice(e.target.value)}
                  placeholder="Or type a custom name"
                  className="mt-2 w-full rounded-xl border-2 border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                />
              </div>

              <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Selected sources will be set to <span className="font-semibold">not renewing</span>.{' '}
                {selectedIds.size} contract(s) · {selectedDeviceTotal} device(s) will move to #
                {primary.contract_id}.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading || !primary || selectedIds.size === 0}
            onClick={() => void handleConfirm()}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge size={16} />}
            {saving ? 'Merging…' : 'Confirm merge'}
          </button>
        </div>
      </div>
    </div>
  );
}
