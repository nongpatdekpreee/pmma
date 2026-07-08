'use client';

const INVENTORY_LOGIN_URL =
  process.env.NEXT_PUBLIC_INVENTORY_LOGIN_URL?.trim() || 'http://10.4.102.212/login';

export type AuthSystemChoice = 'inventory' | 'pm';

type Props = {
  value: AuthSystemChoice;
};

export function AuthSystemSwitcher({ value }: Props) {
  const selectInventory = () => {
    if (value === 'inventory') return;
    window.location.assign(INVENTORY_LOGIN_URL);
  };

  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-xl border border-border/70 bg-muted/40 p-1"
      role="tablist"
      aria-label="Select system"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'inventory'}
        onClick={selectInventory}
        className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
          value === 'inventory'
            ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Inventory
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'pm'}
        className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
          value === 'pm'
            ? 'bg-background text-foreground shadow-sm ring-1 ring-border/50'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        PM Maintenance
      </button>
    </div>
  );
}
