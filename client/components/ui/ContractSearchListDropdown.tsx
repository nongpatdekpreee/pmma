'use client';

import { Check, ChevronDown, X } from 'lucide-react';
import type { ReactNode } from 'react';

/** เปลือก control — ให้สอดคล้อง input ชื่อสัญญา (p-3, border-slate-200/90, shadow, focus ring) */
export const contractDropdownShellClass =
  'relative flex w-full min-w-0 items-stretch rounded-xl border border-slate-200/90 bg-white text-sm text-slate-800 shadow-sm shadow-slate-900/[0.03] outline-none transition-all hover:border-sky-300/90 focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-500/15 has-[:disabled]:opacity-50';

export const contractDropdownTextButtonClass =
  'flex min-h-0 min-w-0 flex-1 items-center px-3 py-3 text-left text-sm font-medium text-slate-800 outline-none focus-visible:outline-none disabled:pointer-events-none rounded-l-xl';

export const contractDropdownNativeSelectClass =
  'min-h-0 min-w-0 flex-1 cursor-pointer appearance-none rounded-l-xl border-0 bg-transparent px-3 py-3 text-left text-sm font-medium text-slate-800 outline-none focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed';

export const contractDropdownComboboxInputClass =
  'min-h-0 min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-sm font-medium text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 focus-visible:outline-none rounded-l-xl';

export function contractDropdownTrailingClass(showDivider: boolean) {
  return showDivider
    ? 'flex shrink-0 items-center gap-0.5 self-stretch border-l border-slate-100 py-0 pl-1 pr-1.5'
    : 'flex shrink-0 items-center gap-0.5 self-stretch py-0 pl-0.5 pr-1.5';
}

export const contractDropdownClearBtnClass =
  'flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600';

export const contractDropdownChevronBtnClass =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:pointer-events-none';

export function NativeSelectDropdownShell({ children }: { children: ReactNode }) {
  return (
    <div className={contractDropdownShellClass}>
      {children}
      <div className="pointer-events-none flex shrink-0 items-center self-stretch border-l border-slate-100 py-0 pl-1 pr-2 text-slate-500">
        <ChevronDown size={18} aria-hidden />
      </div>
    </div>
  );
}

export type ContractSearchListItem = { value: string; label: string; description?: string };

const panelClassName =
  'absolute left-0 right-0 top-full z-[300] mt-1 flex max-h-[min(24rem,calc(100vh-8rem))] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/[0.06]';

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
    <div className={panelClassName}>
      <p className="shrink-0 border-b border-slate-100 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {panelTitle}
      </p>
      {betweenTitleAndSearch != null ? (
        <div className="shrink-0 border-b border-slate-100">{betweenTitleAndSearch}</div>
      ) : null}
      <input
        type="text"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full min-w-0 shrink-0 border-b border-slate-100 px-3 py-2 text-sm outline-none focus:bg-slate-50"
        autoFocus
      />
      <div
        className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden py-1 ${listMaxHeightClass}`}
      >
        {showClearOption && (
          <button
            type="button"
            onClick={() => onClear?.()}
            className="flex w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
          >
            — Clear —
          </button>
        )}
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-500">{emptyText}</p>
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
                      selected ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                    aria-hidden
                  >
                    {selected ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                ) : (
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
                      selected ? 'border-sky-600 bg-sky-600' : 'border-slate-300 bg-white'
                    }`}
                    aria-hidden
                  />
                )}
                <span className="min-w-0 flex-1">
                  <span
                    className={`block break-words text-left text-slate-800 ${itemLabelClassName}`}
                  >
                    {item.label}
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>
      {showFilterCountHint && filter.trim() && filtered.length > 0 ? (
        <div className="shrink-0 border-t border-slate-200 bg-slate-50/95 px-3 py-1.5 text-center text-[10px] text-slate-400">
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
}) {
  return (
    <div
      id={rootId}
      className={`relative block w-full min-w-0 align-bottom ${open ? 'z-[200]' : ''} ${className}`}
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
        className={`${contractDropdownShellClass} w-full min-w-0 cursor-pointer gap-0 p-0 text-left outline-none disabled:cursor-not-allowed disabled:opacity-50 ${multiSelect ? 'items-stretch' : 'items-center'}`}
      >
        <span
          className={`flex min-h-0 min-w-0 flex-1 px-3 py-3 text-left text-sm font-medium ${
            multiSelect && displayText
              ? 'items-start overflow-hidden line-clamp-3 break-words leading-snug text-slate-900'
              : 'items-center overflow-hidden truncate'
          } ${displayText ? 'text-slate-900' : 'text-slate-500'}`}
          title={displayText || undefined}
        >
          {displayText || emptyPlaceholder}
        </span>
        <span className="flex shrink-0 items-center self-stretch border-l border-slate-100 py-0 pl-1 pr-2 text-slate-500">
          <ChevronDown
            size={18}
            className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </span>
      </button>
      {open && !disabled && (
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
        />
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
  triggerPlaceholderClassName = 'text-slate-500',
  betweenTitleAndSearch,
  showFilterCountHint,
  countNoun,
  listMaxHeightClass,
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
}) {
  const hasValue =
    Boolean(displayText) ||
    (multiSelect && (selectedValues?.length ?? 0) > 0);
  const showTrailingDivider = Boolean(hasValue && !loading);

  return (
    <div id={rootId} className={`relative w-full min-w-0 ${open ? 'z-[200]' : ''} ${className}`}>
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
                ? `line-clamp-2 break-words leading-snug text-slate-900 ${triggerSelectedClassName}`
                : `truncate ${
                    loading
                      ? 'text-slate-500'
                      : hasValue
                        ? `text-slate-900 ${triggerSelectedClassName}`
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
        />
      )}
    </div>
  );
}
