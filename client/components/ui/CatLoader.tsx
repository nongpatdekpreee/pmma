'use client';

import './cat-loader.css';

export type CatLoaderProps = {
  /** ข้อความใต้ animation */
  label?: string;
  className?: string;
  /** page = เต็มจอ, inline = ใน card/section */
  mode?: 'inline' | 'page';
  /** ขนาดเล็กลงสำหรับ dashboard card */
  compact?: boolean;
};

function CatLoaderAnimation() {
  return (
    <div className="loader" aria-hidden>
      <div className="wrapper">
        <div className="catContainer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="wall" src="/loader/wall.svg" alt="" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="catbody" src="/loader/catbody.svg" alt="" draggable={false} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="tail" src="/loader/tail.svg" alt="" draggable={false} />
          <div className="text">
            <span className="zzz">z</span>
            <span className="bigzzz">Z</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CatLoader({
  label,
  className = '',
  mode = 'inline',
  compact = false,
}: CatLoaderProps) {
  const rootClass = [
    'uiverse-cat-loader',
    mode === 'inline' ? 'uiverse-cat-loader-inline' : '',
    compact ? 'uiverse-cat-loader--compact' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const body = (
    <div className={rootClass} role="status" aria-live="polite" aria-busy="true">
      <CatLoaderAnimation />
      {label ? <p className="uiverse-cat-loader-label">{label}</p> : null}
      {!label ? <span className="sr-only">Loading</span> : null}
    </div>
  );

  if (mode === 'page') {
    return <div className="uiverse-cat-loader-page">{body}</div>;
  }

  return body;
}

/** Suspense / โหลดทั้งหน้า */
export function PageCatLoader({ label = 'กำลังโหลด...' }: { label?: string }) {
  return <CatLoader mode="page" label={label} />;
}

/** โหลดใน section / card */
export function InlineCatLoader({
  label,
  compact = true,
  className = 'py-6',
}: {
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  return <CatLoader mode="inline" label={label} compact={compact} className={className} />;
}
