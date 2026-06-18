'use client';

import Image from 'next/image';

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
  const px = size === 'lg' ? 36 : size === 'md' ? 32 : 20;
  const initial = (displayName.replace(/\s/g, '')?.[0] || '?').toUpperCase();
  return (
    <span
      className={`flex ${dim} shrink-0 rounded-full overflow-hidden border border-border bg-muted items-center justify-center`}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={displayName}
          width={px}
          height={px}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className={`font-semibold text-muted-foreground leading-none ${
            size === 'lg' ? 'text-sm' : size === 'md' ? 'text-xs' : 'text-[10px]'
          }`}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
