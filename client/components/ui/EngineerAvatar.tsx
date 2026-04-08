'use client';

export function EngineerAvatar({
  photoUrl,
  displayName,
  size = 'sm',
}: {
  photoUrl: string | null | undefined;
  displayName: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dim =
    size === 'lg' ? 'h-9 w-9' : size === 'md' ? 'h-8 w-8' : 'h-5 w-5';
  const initial = (displayName.replace(/\s/g, '')?.[0] || '?').toUpperCase();
  return (
    <span
      className={`flex ${dim} shrink-0 rounded-full overflow-hidden border border-slate-200/80 bg-slate-100 items-center justify-center`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={displayName} className="h-full w-full object-cover" />
      ) : (
        <span
          className={`font-semibold text-slate-500 leading-none ${
            size === 'lg' ? 'text-sm' : size === 'md' ? 'text-xs' : 'text-[10px]'
          }`}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
