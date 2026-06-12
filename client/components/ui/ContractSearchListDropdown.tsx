'use client';

import { Check, ChevronDown, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** เปลือก control — ให้สอดคล้อง input ชื่อสัญญา (p-3, border-border/90, shadow, focus ring) */
export const contractDropdownShellClass =
  'relative flex w-full min-w-0 items-stretch rounded-xl border border-border/90 bg-card text-sm text-foreground shadow-sm shadow-slate-900/[0.03] outline-none transition-all hover:border-sky-300/90 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-500/15 has-[:disabled]:opacity-50';

export const contractDropdownTextButtonClass =
  'flex min-h-0 min-w-0 flex-1 items-center px-3 py-3 text-left text-sm font-medium text-foreground outline-none focus-visible:outline-none disabled:pointer-events-none rounded-l-xl';

export const contractDropdownNativeSelectClass =
  'min-h-0 min-w-0 flex-1 cursor-pointer appearance-none rounded-l-xl border-0 bg-transparent px-3 py-3 text-left text-sm font-medium text-foreground outline-none focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed';

export const contractDropdownComboboxInputClass =
  'min-h-0 min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground focus-visible:outline-none rounded-l-xl';

export function contractDropdownTrailingClass(showDivider: boolean) {
  return showDivider
    ? 'flex shrink-0 items-center gap-0.5 self-stretch border-l border-border py-0 pl-1 pr-1.5'
    : 'flex shrink-0 items-center gap-0.5 self-stretch py-0 pl-0.5 pr-1.5';
}

export const contractDropdownClearBtnClass =
  'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600';

export const contractDropdownChevronBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none';

export function NativeSelectDropdownShell({ children }: { children: ReactNode }) {
  return (
    <div className={contractDropdownShellClass}>
      {children}
      <div className="pointer-events-none flex shrink-0 items-center self-stretch border-l border-border py-0 pl-1 pr-2 text-muted-foreground">
        <ChevronDown size={18} aria-hidden />
      </div>
    </div>
  );
}

export type ContractSearchListItem = { value: string; label: string; description?: string };

/** แผงแบบ absolute ใต้ทริกเกอร์ (z สูงพอให้เหนือ sticky ใน modal) */
const DROPDOWN_PANEL_OUTER_DEFAULT =
  'absolute left-0 right-0 top-full z-[12050] mt-1 flex max-h-[min(24rem,calc(100vh-8rem))] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/90 bg-card shadow-lg shadow-slate-900/[0.06]';

/** แผงใน portal (fixed wrapper ด้านนอก) */
const DROPDOWN_PANEL_OUTER_PORTAL_INNER =
  'flex max-h-[min(24rem,calc(100vh-2rem))] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/90 bg-card shadow-lg shadow-slate-900/[0.06]';

type SearchListPanelProps = {
  panelTitle: string;
  filter: string;
  onFilterChange: (v: string) => void;
  searchPlaceholder: string;
  items: ContractSearchListItem[];
  selectedValue: string;
  onPick: (value: string) => void;
  /** เลือกได้หลายรายการ — คลิกแถวสลับเลือก แผงไม่ปิด */
  multiSelect?: boolean;
  selectedValues?: string[];
  onToggleItem?: (value: string) => void;
  emptyText: string;
  showClearOption?: boolean;
  onClear?: () => void;
  itemLabelClassName?: string;
  panelFooter?: ReactNode;
  /** แทรกระหว่างหัวข้อแผงกับช่องค้นหา (เช่น Role/Type) */
  betweenTitleAndSearch?: ReactNode;
  /** แสดง "Showing x/y …" เมื่อมี filter และมีผลลัพธ์ */
  showFilterCountHint?: boolean;
  countNoun?: string;
  /** ความสูงสูงสุดของรายการ (ค่าเริ่ม max-h-[11rem]) */
  listMaxHeightClass?: string;
  /** ปิดได้เมื่อมีช่องพิมพ์ใน footer — กันโฟกัสไปช่องค้นหาด้านบนโดยไม่ตั้งใจ */
  filterInputAutoFocus?: boolean;
  /** class ของ wrapper แผง (ค่าเริ่มต้น = absolute ใต้ทริกเกอร์) */
  outerClassName?: string;
};

function SearchListDropdownPanel({
  panelTitle,
  filter,
  onFilterChange,
  searchPlaceholder,
  items,
  selectedValue,
  onPick,
  multiSelect = false,
  selectedValues = [],
  onToggleItem,
  emptyText,
  showClearOption,
  onClear,
  itemLabelClassName = '',
  panelFooter,
  betweenTitleAndSearch,
  showFilterCountHint,
  countNoun = 'items',
  listMaxHeightClass = 'max-h-[11rem]',
  filterInputAutoFocus = true,
  outerClassName = DROPDOWN_PANEL_OUTER_DEFAULT,
}: SearchListPanelProps) {
  const q = filter.trim().toLowerCase();
  const filtered = items.filter((i) => {
    const desc = (i.description ?? '').toLowerCase();
    return (
      i.label.toLowerCase().includes(q) ||
      i.value.toLowerCase().includes(q) ||
      (q.length > 0 && desc.includes(q))
    );
  });

  return (
    <div className={outerClassName}>
      <p className="shrink-0 border-b border-border bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {panelTitle}
      </p>
      {betweenTitleAndSearch != null ? (
        <div className="shrink-0 border-b border-border">{betweenTitleAndSearch}</div>
      ) : null}
      <input
        type="text"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full min-w-0 shrink-0 border-b border-border px-3 py-2 text-sm outline-none focus:bg-muted"
        autoFocus={filterInputAutoFocus}
      />
      <div
        className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden py-1 ${listMaxHeightClass}`}
      >
        {showClearOption && (
          <button
            type="button"
            onClick={() => onClear?.()}
            className="flex w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
          >
            — Clear —
          </button>
        )}
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          filtered.map((item) => {
            const selected = multiSelect && onToggleItem
              ? selectedValues.includes(item.value)
              : selectedValue === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() =>
                  multiSelect && onToggleItem ? onToggleItem(item.value) : onPick(item.value)
                }
                className={`flex w-full min-w-0 items-start gap-2.5 px-3 py-2 text-left text-sm hover:bg-sky-50 ${
                  selected ? 'bg-sky-50/90' : ''
                }`}
              >
                {multiSelect && onToggleItem ? (
                  <span
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                      selected ? 'border-sky-600 bg-sky-600 text-white' : 'border-border bg-card'
                    }`}
                    aria-hidden
                  >
                    {selected ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                ) : (
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
                      selected ? 'border-sky-600 bg-sky-600' : 'border-border bg-card'
                    }`}
                    aria-hidden
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block break-words text-left text-foreground ${itemLabelClassName}`}
                  >
                    {item.label}
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>
      {showFilterCountHint && filter.trim() && filtered.length > 0 ? (
        <div className="shrink-0 border-t border-border bg-muted/95 px-3 py-1.5 text-center text-[10px] text-muted-foreground">
          Showing {filtered.length}/{items.length} {countNoun}
        </div>
      ) : null}
      {panelFooter != null ? panelFooter : null}
    </div>
  );
}

/** ปุ่มทริกเกอร์เต็มความกว้าง + แผงค้นหา — Site / Location ฯลฯ */
export function ContractSimpleSearchListDropdown({
  rootId,
  disabled,
  open,
  onToggle,
  displayText,
  emptyPlaceholder,
  panelTitle,
  filter,
  onFilterChange,
  items,
  selectedValue,
  onPick,
  searchPlaceholder = 'Search...',
  emptyText = 'No matches',
  showClearOption,
  onClear,
  /** แสดงปุ่มกากบาทบนแถวทริกเกอร์ (คู่กับ onClear) */
  showClearButton = false,
  clearButtonTitle = 'ล้าง',
  clearAriaLabel,
  betweenTitleAndSearch,
  showFilterCountHint,
  countNoun,
  listMaxHeightClass,
  className = '',
  multiSelect = false,
  selectedValues,
  onToggleItem,
  panelFooter,
  itemLabelClassName,
  filterInputAutoFocus,
  /** แผงลอยไป document.body (แก้ถูกตัดใน modal / overflow-y-auto) */
  portalPanel = false,
}: {
  rootId: string;
  disabled?: boolean;
  open: boolean;
  onToggle: () => void;
  displayText: string;
  emptyPlaceholder: string;
  panelTitle: string;
  filter: string;
  onFilterChange: (v: string) => void;
  items: ContractSearchListItem[];
  selectedValue: string;
  onPick: (value: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  showClearOption?: boolean;
  onClear?: () => void;
  showClearButton?: boolean;
  clearButtonTitle?: string;
  clearAriaLabel?: string;
  betweenTitleAndSearch?: ReactNode;
  showFilterCountHint?: boolean;
  countNoun?: string;
  listMaxHeightClass?: string;
  className?: string;
  /** หลาย Site — ใช้กับ selectedValues + onToggleItem; ปิดแผงด้วยปุ่มใน panelFooter */
  multiSelect?: boolean;
  selectedValues?: string[];
  onToggleItem?: (value: string) => void;
  panelFooter?: ReactNode;
  itemLabelClassName?: string;
  filterInputAutoFocus?: boolean;
  portalPanel?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [portalBox, setPortalBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!portalPanel || !open || disabled) {
      setPortalBox(null);
      return;
    }
    const measure = () => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPortalBox({ top: r.bottom + 6, left: r.left, width: r.width });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [portalPanel, open, disabled, displayText, items.length, filter]);

  const hasValue =
    Boolean(displayText?.trim()) ||
    (multiSelect && (selectedValues?.length ?? 0) > 0);
  const showTrailingDivider = Boolean(hasValue);

  const panelNode =
    open && !disabled ? (
      <SearchListDropdownPanel
        panelTitle={panelTitle}
        filter={filter}
        onFilterChange={onFilterChange}
        searchPlaceholder={searchPlaceholder}
        items={items}
        selectedValue={selectedValue}
        onPick={onPick}
        multiSelect={multiSelect}
        selectedValues={selectedValues}
        onToggleItem={onToggleItem}
        emptyText={emptyText}
        showClearOption={showClearOption}
        onClear={onClear}
        betweenTitleAndSearch={betweenTitleAndSearch}
        showFilterCountHint={showFilterCountHint}
        countNoun={countNoun}
        listMaxHeightClass={listMaxHeightClass}
        panelFooter={panelFooter}
        itemLabelClassName={itemLabelClassName}
        filterInputAutoFocus={filterInputAutoFocus}
        outerClassName={portalPanel ? DROPDOWN_PANEL_OUTER_PORTAL_INNER : undefined}
      />
    ) : null;

  return (
    <div
      ref={rootRef}
      id={rootId}
      className={`relative block w-full min-w-0 align-bottom ${open && !portalPanel ? 'z-[12050]' : ''} ${className}`}
    >
      <div
        className={`${contractDropdownShellClass} w-full min-w-0 gap-0 p-0 ${multiSelect ? 'items-stretch' : 'items-center'}`}
      >
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-multiselectable={multiSelect || undefined}
          onClick={() => {
            if (disabled) return;
            onToggle();
          }}
          className={`${contractDropdownTextButtonClass} w-full min-w-0 cursor-pointer outline-none disabled:cursor-not-allowed disabled:opacity-50 ${multiSelect ? 'items-start' : 'items-center'}`}
        >
          <span
            className={`min-w-0 flex-1 text-left text-sm font-medium ${
              multiSelect && displayText
                ? 'line-clamp-3 break-words leading-snug text-foreground'
                : 'truncate'
            } ${displayText ? 'text-foreground' : 'text-muted-foreground'}`}
            title={displayText || undefined}
          >
            {displayText || emptyPlaceholder}
          </span>
        </button>
        <div
          className={contractDropdownTrailingClass(showTrailingDivider)}
          onClick={(e) => e.stopPropagation()}
        >
          {hasValue && showClearButton && onClear && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClear();
              }}
              className={contractDropdownClearBtnClass}
              title={clearButtonTitle}
              aria-label={clearAriaLabel ?? clearButtonTitle}
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={(e) => {
              e.preventDefault();
              if (!disabled) onToggle();
            }}
            className={contractDropdownChevronBtnClass}
            aria-hidden
          >
            <ChevronDown
              size={18}
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>
      {!portalPanel && panelNode}
      {portalPanel &&
        portalBox &&
        panelNode &&
        createPortal(
          <div
            data-dropdown-portal-for={rootId}
            style={{
              position: 'fixed',
              top: portalBox.top,
              left: portalBox.left,
              width: portalBox.width,
              zIndex: 10050,
            }}
            className="pointer-events-auto min-w-0"
          >
            {panelNode}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** เปลือกแบบ Refer SOF: ปุ่มข้อความ + ล้าง + chevron + แผง + optional footer */
export function ContractShellSearchListDropdown({
  rootId,
  className = '',
  disabled = false,
  loading = false,
  open,
  onOpenChange,
  displayText,
  emptyPlaceholder,
  loadingText = 'Loading...',
  panelTitle,
  filter,
  onFilterChange,
  items,
  selectedValue,
  onPick,
  multiSelect = false,
  selectedValues,
  onToggleItem,
  searchPlaceholder = 'Search...',
  emptyText = 'No matches',
  showClearButton = false,
  onClear,
  clearButtonTitle = 'ล้าง',
  clearAriaLabel,
  panelFooter,
  itemLabelClassName,
  triggerSelectedClassName = '',
  triggerPlaceholderClassName = 'text-muted-foreground',
  betweenTitleAndSearch,
  showFilterCountHint,
  countNoun,
  listMaxHeightClass,
  filterInputAutoFocus,
}: {
  rootId: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  displayText: string;
  emptyPlaceholder: string;
  loadingText?: string;
  panelTitle: string;
  filter: string;
  onFilterChange: (v: string) => void;
  items: ContractSearchListItem[];
  selectedValue: string;
  onPick: (value: string) => void;
  /** หลายสัญญา — ใช้กับ selectedValues + onToggleItem */
  multiSelect?: boolean;
  selectedValues?: string[];
  onToggleItem?: (value: string) => void;
  searchPlaceholder?: string;
  emptyText?: string;
  showClearButton?: boolean;
  onClear?: () => void;
  clearButtonTitle?: string;
  clearAriaLabel?: string;
  panelFooter?: ReactNode;
  itemLabelClassName?: string;
  triggerSelectedClassName?: string;
  triggerPlaceholderClassName?: string;
  betweenTitleAndSearch?: ReactNode;
  showFilterCountHint?: boolean;
  countNoun?: string;
  listMaxHeightClass?: string;
  filterInputAutoFocus?: boolean;
}) {
  const hasValue =
    Boolean(displayText) ||
    (multiSelect && (selectedValues?.length ?? 0) > 0);
  const showTrailingDivider = Boolean(hasValue && !loading);

  return (
    <div id={rootId} className={`relative w-full min-w-0 ${open ? 'z-[12050]' : ''} ${className}`}>
      <div className={contractDropdownShellClass}>
        <button
          type="button"
          onClick={() => !disabled && !loading && onOpenChange(!open)}
          disabled={disabled || loading}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-multiselectable={multiSelect || undefined}
          className={`${contractDropdownTextButtonClass} ${multiSelect ? 'items-start' : 'items-center'}`}
        >
          <span
            className={`min-w-0 flex-1 text-left ${
              multiSelect && hasValue && !loading
                ? `line-clamp-2 break-words leading-snug text-foreground ${triggerSelectedClassName}`
                : `truncate ${
                    loading
                      ? 'text-muted-foreground'
                      : hasValue
                        ? `text-foreground ${triggerSelectedClassName}`
                        : triggerPlaceholderClassName
                  }`
            }`}
            title={hasValue && !loading && displayText ? displayText : undefined}
          >
            {loading ? loadingText : hasValue ? displayText : emptyPlaceholder}
          </span>
        </button>
        <div
          className={contractDropdownTrailingClass(showTrailingDivider)}
          onClick={(e) => e.stopPropagation()}
        >
          {hasValue && !loading && showClearButton && onClear && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClear();
              }}
              className={contractDropdownClearBtnClass}
              title={clearButtonTitle}
              aria-label={clearAriaLabel ?? clearButtonTitle}
            >
              <X size={16} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || loading}
            onClick={() => !disabled && !loading && onOpenChange(!open)}
            className={contractDropdownChevronBtnClass}
            aria-hidden
          >
            <ChevronDown
              size={18}
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>
      {open && !disabled && !loading && (
        <SearchListDropdownPanel
          panelTitle={panelTitle}
          filter={filter}
          onFilterChange={onFilterChange}
          searchPlaceholder={searchPlaceholder}
          items={items}
          selectedValue={selectedValue}
          onPick={onPick}
          multiSelect={multiSelect}
          selectedValues={selectedValues}
          onToggleItem={onToggleItem}
          emptyText={emptyText}
          itemLabelClassName={itemLabelClassName}
          panelFooter={panelFooter}
          betweenTitleAndSearch={betweenTitleAndSearch}
          showFilterCountHint={showFilterCountHint}
          countNoun={countNoun}
          listMaxHeightClass={listMaxHeightClass}
          filterInputAutoFocus={filterInputAutoFocus}
        />
      )}
    </div>
  );
}
