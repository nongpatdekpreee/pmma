'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, HardDrive, Search } from 'lucide-react';

export type TopSitesHeatmapData = {
  sites: Array<{
    slid: number;
    site_name: string;
    location2: string;
    total_devices: number;
    rank: number;
    /** สัญญาที่มี device จริงที่ SLid นี้ (จาก API); ถ้าไม่มีให้ fallback เมทริกซ์ */
    contracts?: Array<{ contract_id: number; short_id: string; title: string; devices: number }>;
  }>;
  contracts: Array<{ contract_id: number; short_id: string; title: string }>;
  matrix: number[][];
  max_value: number;
};

type Metric = 'devices' | 'contracts';
type SortMode = 'total_desc' | 'name_asc' | 'contracts_desc' | 'risk_first';

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}`;
}

/** อันดับในรายการ Top sites — จัดกรอบให้เลขไม่ลอยๆ / จัดแนวเดียวกับเหรียญ */
function RankBadge({ rank }: { rank: number }) {
  const medal = rank <= 3;
  return (
    <span
      className={`inline-flex items-center justify-center size-9 shrink-0 rounded-xl border antialiased shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:shadow-none ${
        medal ? 'text-[17px] leading-none' : 'text-[15px] font-semibold tabular-nums tracking-tight'
      }`}
      style={{
        background: 'var(--color-surface-muted)',
        borderColor: 'var(--color-border-subtle)',
        color: medal ? undefined : 'var(--color-text-primary)',
      }}
      aria-hidden
    >
      {rankMedal(rank)}
    </span>
  );
}

function linkedContractCount(matrixRow: number[]): number {
  return matrixRow.filter((v) => v > 0).length;
}

function siteRowPrimary(
  site: TopSitesHeatmapData['sites'][0],
  matrixRow: number[],
  metric: Metric
): number {
  if (metric === 'devices') return site.total_devices;
  if (Array.isArray(site.contracts)) return site.contracts.length;
  return linkedContractCount(matrixRow);
}

type SiteRowModel = {
  site: TopSitesHeatmapData['sites'][0];
  siteIndex: number;
  matrixRow: number[];
  linkedCount: number;
};

const shellStyle: CSSProperties = {
  background: 'var(--color-background-primary)',
  color: 'var(--color-text-primary)',
  borderColor: 'var(--color-border-subtle)',
};

const mutedStyle: CSSProperties = {
  color: 'var(--color-text-secondary)',
};

export function TopSitesWidget({
  loading,
  error,
  data,
}: {
  loading: boolean;
  error: string | null;
  data: TopSitesHeatmapData;
}) {
  const [metric, setMetric] = useState<Metric>('devices');
  const [sortMode, setSortMode] = useState<SortMode>('total_desc');
  const [expandedSlid, setExpandedSlid] = useState<number | null>(null);
  const [contractQuery, setContractQuery] = useState('');

  const rows: SiteRowModel[] = useMemo(() => {
    const { sites, matrix } = data;
    return sites.map((site, siteIndex) => ({
      site,
      siteIndex,
      matrixRow: matrix[siteIndex] ?? [],
      linkedCount: Array.isArray(site.contracts)
        ? site.contracts.length
        : linkedContractCount(matrix[siteIndex] ?? []),
    }));
  }, [data]);

  const maxPrimary = useMemo(() => {
    let m = 1;
    for (const r of rows) {
      const v = siteRowPrimary(r.site, r.matrixRow, metric);
      if (v > m) m = v;
    }
    return m;
  }, [rows, metric]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    const primary = (r: SiteRowModel) => siteRowPrimary(r.site, r.matrixRow, metric);
    copy.sort((a, b) => {
      switch (sortMode) {
        case 'name_asc':
          return (a.site.site_name || '').localeCompare(b.site.site_name || '', undefined, {
            sensitivity: 'base',
          });
        case 'contracts_desc':
          return b.linkedCount - a.linkedCount;
        case 'risk_first':
          return a.site.total_devices - b.site.total_devices;
        case 'total_desc':
        default:
          return primary(b) - primary(a);
      }
    });
    return copy;
  }, [rows, sortMode, metric]);

  const toggleRow = (slid: number) => {
    setExpandedSlid((cur) => (cur === slid ? null : slid));
    setContractQuery('');
  };

  const accent = metric === 'devices' ? 'var(--color-accent-devices)' : 'var(--color-accent-contracts)';

  return (
    <div
      className="rounded-2xl border p-3 sm:p-4 min-w-0 shadow-sm"
      style={{
        ...shellStyle,
        background: 'var(--color-surface-muted)',
        borderColor: 'var(--color-border-subtle)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="section-heading section-heading-plain text-sm sm:text-base">
          Top sites
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="top-sites-sort">
            Sort sites
          </label>
          <select
            id="top-sites-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="rounded-lg border px-2 py-1.5 text-[11px] font-semibold min-w-[10rem] cursor-pointer bg-[var(--color-background-primary)]"
            style={{ borderColor: 'var(--color-border-subtle)', color: 'var(--color-text-primary)' }}
          >
            <option value="total_desc">Total (high → low)</option>
            <option value="name_asc">Name A–Z</option>
            <option value="contracts_desc">Contract count</option>
            <option value="risk_first">Risk first (fewest devices)</option>
          </select>
          <span className="text-[11px] font-semibold hidden sm:inline" style={mutedStyle}>
            Metric
          </span>
          <div
            className="inline-flex rounded-lg border p-0.5 text-[11px] font-bold"
            style={{ borderColor: 'var(--color-border-subtle)', background: 'var(--color-background-primary)' }}
          >
            <button
              type="button"
              onClick={() => setMetric('devices')}
              className="px-3 py-1.5 rounded-md transition-colors"
              style={{
                background: metric === 'devices' ? 'var(--color-accent-devices)' : 'transparent',
                color: metric === 'devices' ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              Devices
            </button>
            <button
              type="button"
              onClick={() => setMetric('contracts')}
              className="px-3 py-1.5 rounded-md transition-colors"
              style={{
                background: metric === 'contracts' ? 'var(--color-accent-contracts)' : 'transparent',
                color: metric === 'contracts' ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              Contracts
            </button>
          </div>
          <Link
            href="/contract_editer"
            className="text-[11px] font-semibold hover:underline whitespace-nowrap"
            style={{ color: 'var(--color-accent-devices)' }}
          >
            All Contracts
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center">
          <div
            className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-accent-devices)', borderTopColor: 'transparent' }}
            aria-label="Loading"
          />
        </div>
      ) : error ? (
        <div className="py-6 text-center text-sm text-red-600">{error}</div>
      ) : data.sites.length === 0 ? (
        <div className="py-10 flex flex-col items-center gap-2" style={mutedStyle}>
          <HardDrive className="w-10 h-10" strokeWidth={1.25} />
          <span className="text-sm">No site data</span>
        </div>
      ) : (
        <ul className="space-y-2">
          {sortedRows.map(({ site, matrixRow, linkedCount }) => {
            const primary = siteRowPrimary(site, matrixRow, metric);
            const barPct = Math.round((primary / maxPrimary) * 100);
            const open = expandedSlid === site.slid;
            const q = contractQuery.trim().toLowerCase();
            // API ส่ง sites[].contracts = เฉพาะสัญญาที่มี device ที่ SLid นี้; ไม่มีฟิลด์นี้ = fallback เมทริกซ์เดิม
            const contractsAtThisSite = Array.isArray(site.contracts)
              ? site.contracts
              : data.contracts
                  .map((c, j) => ({
                    ...c,
                    devices: matrixRow[j] ?? 0,
                  }))
                  .filter((c) => c.devices > 0);
            const contractsForPanel = contractsAtThisSite.filter((c) => {
              if (!q) return true;
              return (
                String(c.contract_id).includes(q) ||
                (c.short_id || '').toLowerCase().includes(q) ||
                (c.title || '').toLowerCase().includes(q)
              );
            });
            const maxDevicesInPanel = Math.max(
              1,
              ...contractsForPanel.map((c) => c.devices),
              site.total_devices
            );
            const withDevices = contractsForPanel;
            const topContractId =
              withDevices.length > 0
                ? withDevices.reduce((best, cur) => (cur.devices > best.devices ? cur : best), withDevices[0]!)
                    .contract_id
                : null;

            return (
              <li
                key={site.slid}
                className="rounded-xl border overflow-hidden"
                style={{
                  background: 'var(--color-background-primary)',
                  borderColor: 'var(--color-border-subtle)',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleRow(site.slid)}
                  className="w-full text-left px-3 py-3 sm:px-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-colors hover:brightness-[0.98] dark:hover:brightness-110"
                  aria-expanded={open}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <RankBadge rank={site.rank} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold leading-snug line-clamp-2">{site.site_name}</div>
                      {site.location2 ? (
                        <div className="text-[10px] mt-0.5 line-clamp-1" style={mutedStyle}>
                          {site.location2}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0 sm:flex-1 sm:max-w-md">
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--color-surface-muted)' }}
                      title={metric === 'devices' ? `${site.total_devices} devices` : `${linkedCount} contracts with devices`}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${barPct}%`,
                          background: accent,
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] antialiased" style={mutedStyle}>
                      <span className="inline-flex items-baseline gap-1">
                        <span
                          className="text-[12px] font-semibold tabular-nums tracking-tight leading-none"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {metric === 'devices' ? site.total_devices : linkedCount}
                        </span>
                        <span>{metric === 'devices' ? 'devices' : 'contracts'}</span>
                      </span>
                      <span className="inline-flex items-baseline gap-1">
                        {metric === 'devices' ? (
                          <>
                            <span
                              className="text-[12px] font-semibold tabular-nums tracking-tight leading-none"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              {linkedCount}
                            </span>
                            <span>
                              contract{linkedCount === 1 ? '' : 's'} linked
                            </span>
                          </>
                        ) : (
                          <>
                            <span
                              className="text-[12px] font-semibold tabular-nums tracking-tight leading-none"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              {site.total_devices}
                            </span>
                            <span>
                              device{site.total_devices === 1 ? '' : 's'} at site
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 transition-transform self-end sm:self-center ${open ? 'rotate-180' : ''}`}
                    style={{ color: 'var(--color-text-secondary)' }}
                    aria-hidden
                  />
                </button>

                {open && (
                  <div
                    className="border-t px-3 py-3 sm:px-4 sm:py-4 space-y-3"
                    style={{
                      borderColor: 'var(--color-border-subtle)',
                      background: 'var(--color-surface-muted)',
                    }}
                  >
                    <div className="relative">
                      <Search
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                        style={{ color: 'var(--color-text-secondary)' }}
                      />
                      <input
                        type="search"
                        value={contractQuery}
                        onChange={(e) => setContractQuery(e.target.value)}
                        placeholder="Search by contract ID, code, or title…"
                        className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-offset-0"
                        style={{
                          borderColor: 'var(--color-border-subtle)',
                          background: 'var(--color-background-primary)',
                          color: 'var(--color-text-primary)',
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {contractsForPanel.map((c) => {
                        const isTop = c.contract_id === topContractId && c.devices > 0;
                        const share = site.total_devices > 0 ? c.devices / site.total_devices : 0;
                        const bluePct = Math.round((c.devices / maxDevicesInPanel) * 100);
                        const purplePct = Math.round(share * 100);
                        const borderColor = isTop ? accent : 'transparent';
                        return (
                          <Link
                            key={c.contract_id}
                            href={`/contract_editer?contract_id=${encodeURIComponent(String(c.contract_id))}&site_id=${encodeURIComponent(String(site.slid))}`}
                            className="rounded-xl border p-3 block transition-shadow hover:shadow-md relative overflow-hidden"
                            style={{
                              borderColor: 'var(--color-border-subtle)',
                              background: 'var(--color-background-primary)',
                              boxShadow: isTop ? `inset 3px 0 0 0 ${borderColor}` : undefined,
                            }}
                          >
                            {isTop && (
                              <span
                                className="absolute top-2 right-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white"
                                style={{ background: accent }}
                              >
                                Top
                              </span>
                            )}
                            <div className="text-[10px] font-mono mb-0.5" style={mutedStyle}>
                              #{c.contract_id} · {c.short_id}
                            </div>
                            <div className="text-[12px] font-semibold leading-snug line-clamp-2 pr-12">{c.title}</div>
                            <div className="mt-3 space-y-2 antialiased">
                              <div>
                                <div className="flex justify-between items-baseline gap-2 text-[10px] mb-0.5" style={mutedStyle}>
                                  <span>Devices</span>
                                  <span
                                    className="tabular-nums text-[13px] font-semibold tracking-tight leading-none shrink-0"
                                    style={{ color: 'var(--color-text-primary)' }}
                                  >
                                    {c.devices}
                                  </span>
                                </div>
                                <div
                                  className="h-1.5 rounded-full overflow-hidden"
                                  style={{ background: 'var(--color-surface-muted)' }}
                                >
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${bluePct}%`,
                                      background: 'var(--color-accent-devices)',
                                    }}
                                  />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between items-baseline gap-2 text-[10px] mb-0.5" style={mutedStyle}>
                                  <span>Share of site</span>
                                  <span
                                    className="tabular-nums text-[13px] font-semibold tracking-tight leading-none shrink-0"
                                    style={{ color: 'var(--color-text-primary)' }}
                                  >
                                    {Math.round(share * 100)}%
                                  </span>
                                </div>
                                <div
                                  className="h-1.5 rounded-full overflow-hidden"
                                  style={{ background: 'var(--color-surface-muted)' }}
                                >
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${purplePct}%`,
                                      background: 'var(--color-accent-contracts)',
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                    {contractsForPanel.length === 0 && (
                      <p className="text-sm text-center py-4" style={mutedStyle}>
                        {contractsAtThisSite.length === 0
                          ? 'ไม่มีสัญญาที่ผูก device ที่ไซต์นี้'
                          : 'ไม่พบสัญญาที่ตรงกับคำค้น'}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
