import Image from 'next/image';

export function AuthBrandLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const img = size === 'sm' ? 16 : 18;
  return (
    <div className="flex items-center gap-2.5 text-blue-600">
      <div
        className={`${box} flex shrink-0 items-center justify-center rounded-lg bg-card p-2 shadow-md shadow-grey-500/20 ring-1 ring-border/40 transition-shadow`}
      >
        <Image
          src="/date.svg"
          alt="Plan Schedule"
          width={img}
          height={img}
          className="object-contain"
          style={{ width: img, height: img }}
        />
      </div>
      <span className="font-semibold text-sm text-sidebar-foreground">Plan Schedule</span>
    </div>
  );
}
